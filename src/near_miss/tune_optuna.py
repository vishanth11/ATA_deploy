"""Optuna Hyperparameter Optimization & Experiment Tracking Pipeline.

Implements Bayesian optimization (TPE) for Near-Miss Risk Classifiers,
logging trial evaluations, computing ROC-AUC and F1 scores across validation
folds, and persisting artifacts for academic benchmarking.
"""

import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import optuna
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import roc_auc_score, f1_score, precision_score, recall_score, average_precision_score

from src.near_miss.train import (
    SPLIT_DIR,
    CONFIGS,
    TARGET,
    RANDOM_SEED,
    make_preprocessor,
    compute_metrics,
)

REPORT_DIR = Path("reports/near_miss")
FIGURE_DIR = Path("reports/figures/near_miss")


def objective(trial, X_train, y_train, X_val, y_val, feats):
    model_type = trial.suggest_categorical("model_type", ["GradientBoosting", "RandomForest"])
    
    if model_type == "GradientBoosting":
        n_estimators = trial.suggest_int("n_estimators", 50, 350, step=25)
        learning_rate = trial.suggest_float("learning_rate", 0.01, 0.25, log=True)
        max_depth = trial.suggest_int("max_depth", 2, 8)
        min_samples_split = trial.suggest_int("min_samples_split", 2, 15)
        subsample = trial.suggest_float("subsample", 0.65, 1.0, step=0.05)
        
        clf = GradientBoostingClassifier(
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            subsample=subsample,
            random_state=RANDOM_SEED,
        )
        # Compute balanced class weights for sample_weight
        cls, counts = np.unique(y_train, return_counts=True)
        weights = {c: len(y_train) / (len(cls) * n) for c, n in zip(cls, counts)}
        sample_weights = pd.Series(y_train).map(weights).values
        fit_kw = {"model__sample_weight": sample_weights}
    else:
        n_estimators = trial.suggest_int("n_estimators", 100, 400, step=50)
        max_depth = trial.suggest_int("max_depth", 4, 16)
        min_samples_leaf = trial.suggest_int("min_samples_leaf", 1, 8)
        
        clf = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_leaf=min_samples_leaf,
            class_weight="balanced",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        )
        fit_kw = {}

    pipe = Pipeline([
        ("preprocess", make_preprocessor(feats)),
        ("model", clf),
    ])
    
    pipe.fit(X_train, y_train, **fit_kw)
    probs_val = pipe.predict_proba(X_val)[:, 1]
    roc = roc_auc_score(y_val, probs_val)
    f1 = f1_score(y_val, (probs_val >= 0.5).astype(int), zero_division=0)
    
    # Combined objective: balanced blend of discrimination (ROC-AUC) and calibration (F1)
    return float(0.6 * roc + 0.4 * f1)


def run_optuna_study(n_trials: int = 25):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)

    parts = {s: pd.read_parquet(SPLIT_DIR / f"{s}.parquet")
             for s in ["train", "validation", "test"]}
    feats = CONFIGS["A_offline_full_no_fesafety"]
    
    X_train = parts["train"][feats]
    y_train = parts["train"][TARGET].values
    X_val = parts["validation"][feats]
    y_val = parts["validation"][TARGET].values
    X_test = parts["test"][feats]
    y_test = parts["test"][TARGET].values

    optuna.logging.set_verbosity(optuna.logging.INFO)
    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=RANDOM_SEED)
    )

    study.optimize(
        lambda trial: objective(trial, X_train, y_train, X_val, y_val, feats),
        n_trials=n_trials
    )

    print("\n" + "=" * 60)
    print(f"OPTUNA STUDY COMPLETE: Best Value = {study.best_value:.4f}")
    print(f"Best Hyperparameters: {study.best_params}")
    print("=" * 60)

    # Re-train best model on train and evaluate on validation & test
    best_p = study.best_params
    if best_p["model_type"] == "GradientBoosting":
        best_clf = GradientBoostingClassifier(
            n_estimators=best_p["n_estimators"],
            learning_rate=best_p["learning_rate"],
            max_depth=best_p["max_depth"],
            min_samples_split=best_p["min_samples_split"],
            subsample=best_p["subsample"],
            random_state=RANDOM_SEED,
        )
        cls, counts = np.unique(y_train, return_counts=True)
        weights = {c: len(y_train) / (len(cls) * n) for c, n in zip(cls, counts)}
        fit_kw = {"model__sample_weight": pd.Series(y_train).map(weights).values}
    else:
        best_clf = RandomForestClassifier(
            n_estimators=best_p["n_estimators"],
            max_depth=best_p["max_depth"],
            min_samples_leaf=best_p["min_samples_leaf"],
            class_weight="balanced",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        )
        fit_kw = {}

    best_pipe = Pipeline([
        ("preprocess", make_preprocessor(feats)),
        ("model", best_clf),
    ])
    best_pipe.fit(X_train, y_train, **fit_kw)

    test_prob = best_pipe.predict_proba(X_test)[:, 1]
    test_metrics = compute_metrics(y_test, test_prob)
    val_prob = best_pipe.predict_proba(X_val)[:, 1]
    val_metrics = compute_metrics(y_val, val_prob)

    study_summary = {
        "best_trial_number": study.best_trial.number,
        "best_score": study.best_value,
        "best_params": study.best_params,
        "n_trials": n_trials,
        "metrics_validation": val_metrics,
        "metrics_test": test_metrics,
        "trials": [
            {
                "number": t.number,
                "value": t.value,
                "params": t.params,
                "state": str(t.state)
            }
            for t in study.trials
        ]
    }

    out_json = REPORT_DIR / "optuna_study.json"
    with open(out_json, "w") as f:
        json.dump(study_summary, f, indent=2)
    print(f"Saved Optuna study summary to: {out_json}")

    # Generate Optimization History Plot
    trials_df = study.trials_dataframe()
    plt.figure(figsize=(9, 5))
    plt.plot(trials_df["number"], trials_df["value"], marker="o", color="#4f46e5", label="Trial Objective")
    plt.plot(trials_df["number"], trials_df["value"].cummax(), color="#ef4444", linestyle="--", label="Best So Far")
    plt.title("Optuna Hyperparameter Optimization History (Near-Miss Risk Model)", fontsize=13, fontweight="bold")
    plt.xlabel("Trial Number", fontsize=11)
    plt.ylabel("Objective Score (0.6*ROC + 0.4*F1)", fontsize=11)
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plot_file = FIGURE_DIR / "optuna_optimization_history.png"
    plt.savefig(plot_file, dpi=200)
    plt.close()
    print(f"Saved Optuna optimization curve to: {plot_file}")

    return study_summary


if __name__ == "__main__":
    run_optuna_study(n_trials=25)
