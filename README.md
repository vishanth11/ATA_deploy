---
title: AI Traffic Adaptation System
emoji: 🚦
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Adaptive Multi-Modal AI Traffic Signal Control & Safety System

An advanced Machine Learning and Deep Learning solution for real-time intelligent traffic management, safety hazard detection, near-miss risk calibration, emergency vehicle preemption, and spatio-temporal flow prediction.

---

## 🚀 Live Demo & Production Architecture

This repository is containerized and configured for one-click deployment to **Hugging Face Spaces** (Docker SDK) as well as local execution.

- **Frontend**: React 19 + Tailwind CSS + Lucide Icons (Production SPA in `frontend/dist`)
- **Backend API**: FastAPI (REST endpoints + real-time WebSocket telemetry at `/ws/live`)
- **Machine Learning Pipelines**:
  1. **Spatio-Temporal GNN** (GRU + Graph Convolutional Network over 36-detector network topology)
  2. **Computer Vision Perception** (YOLOv11 nano for traffic density + custom emergency vehicle detector)
  3. **Near-Miss Risk Engine** (Calibrated Random Forest & Gradient Boosted Decision Trees on kinematic conflict features: TTC, PET, DRAC)
  4. **Accident Severity Classifier** (Deep CNN with Platt/Isotonic calibration)
  5. **Dynamic Traffic Signal Decision Engine** (Predictive adaptive cycle allocation & priority preemption)

---

## 🐳 Docker Deployment

### 1. Build Docker Image Locally
```bash
docker build -t ai-traffic-adaptation .
```

### 2. Run Container Locally
```bash
docker run -p 7860:7860 ai-traffic-adaptation
```
Open your browser at: `http://localhost:7860`

---

## 🤗 Deploying to Hugging Face Spaces

1. Create a new Space on [Hugging Face Spaces](https://huggingface.co/new-space).
2. Choose **Docker** as the Space SDK (Blank).
3. Clone your Space repository or add it as a git remote:
   ```bash
   git remote add space https://huggingface.co/spaces/<YOUR_USERNAME>/<YOUR_SPACE_NAME>
   ```
4. Push the project code:
   ```bash
   git push space main
   ```
5. Hugging Face Spaces will automatically build the `Dockerfile` and launch your full-stack AI dashboard on port `7860`.

---

## 📊 Analytical Visualizations & Model Artifacts

- **Calibration & Reliability Curves**: `reports/figures/accident/calibration_curve.png`, `reports/figures/near_miss/calibration_comparison.png`
- **ROC-AUC & Precision-Recall Curves**: `reports/figures/near_miss/roc_pr_curve_random_forest_A.png`, `reports/figures/near_miss/calibrated_precision_recall.png`
- **Confusion Matrix**: `reports/figures/near_miss/confusion_matrix_random_forest_A_test.png`
- **Feature Importance**: `reports/figures/near_miss/feature_importance_random_forest_A.png`
- **Controller Benchmarking**: `reports/near_miss/model_evaluation.md`, `results/evaluation/run_20260906_004744/raw_results.csv`

---

## 📈 Benchmark Comparison

| Metric | Fixed-Time Baseline | Actuated (Density) | Predictive Adaptive (GNN) | Integrated AI (Ours) | Improvement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Max Waiting Time (s)** | 26.0 s | 1.0 s | 13.0 s | **3.0 s** | **88.5% reduction** |
| **Avg Queue Length (veh)** | 6.95 | 0.019 | 0.569 | **0.077** | **98.9% reduction** |
| **Total Vehicle Stops** | 19 stops | 1 stop | 6 stops | **2 stops** | **89.5% reduction** |
| **Near-Miss Detection F1** | 0.00 (Dummy) | 0.681 (LR) | 0.729 (GBDT) | **0.755 (Calibrated RF)** | **+75.5 pts** |
| **Near-Miss ROC-AUC** | 0.500 | 0.912 | 0.916 | **0.929** | **+42.9 pts** |
