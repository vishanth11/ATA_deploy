"""Launch both the FastAPI dashboard API and the React Vite frontend concurrently.

Usage:
    python run_dashboard.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend"


def main():
    print("=" * 60)
    print("AI TRAFFIC ADAPTATION — FULL STACK DASHBOARD LAUNCHER")
    print("=" * 60)
    print(f"Backend API:  http://127.0.0.1:8000")
    print(f"Frontend App: http://localhost:5173")
    print("=" * 60)

    # Check if npm dependencies exist in frontend
    node_modules = FRONTEND_DIR / "node_modules"
    if not node_modules.exists():
        print("[Launcher] Installing frontend npm dependencies...")
        subprocess.run(["npm.cmd" if os.name == "nt" else "npm", "install"], cwd=str(FRONTEND_DIR), check=True)

    processes = []
    try:
        # Start Backend API
        print("[Launcher] Starting FastAPI backend on http://127.0.0.1:8000 ...")
        api_proc = subprocess.Popen(
            [sys.executable, "dashboard_api.py"],
            cwd=str(ROOT),
        )
        processes.append(api_proc)

        # Allow API server a moment to bind
        time.sleep(1.5)

        # Start Vite Frontend Dev Server
        print("[Launcher] Starting Vite frontend dev server on http://localhost:5173 ...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        frontend_proc = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=str(FRONTEND_DIR),
        )
        processes.append(frontend_proc)

        print("\n>>> System running! Open http://localhost:5173 in your browser.")
        print(">>> Press CTRL+C to stop both servers.\n")

        # Keep running until interrupt or child process exits
        while True:
            for p in processes:
                code = p.poll()
                if code is not None:
                    print(f"[Launcher] Process {p.pid} exited with code {code}.")
                    return
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n[Launcher] Shutting down servers...")
    finally:
        for p in processes:
            try:
                p.terminate()
                p.wait(timeout=3)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        print("[Launcher] All servers stopped cleanly.")


if __name__ == "__main__":
    main()
