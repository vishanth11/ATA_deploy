"""Hugging Face Spaces Full-Stack Production Application.

Serves the exact full-featured React 19 + Tailwind CSS dark-mode dashboard
directly embedded into Hugging Face Spaces with FastAPI REST and WebSocket
telemetry, and registers ZeroGPU workers to prevent startup errors.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST_DIR = ROOT / "frontend" / "dist"

sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "src" / "near_miss"))

try:
    import src.near_miss as near_miss
    sys.modules["near_miss"] = near_miss
except Exception:
    pass

import gradio as gr
from fastapi.staticfiles import StaticFiles
from dashboard_api import app as fastapi_app

# ---------------------------------------------------------------------------
# ZeroGPU registration to satisfy Hugging Face supervisor
# ---------------------------------------------------------------------------

try:
    import spaces
except ImportError:
    class spaces:
        @staticmethod
        def GPU(fn=None, duration=120):
            if fn is None:
                return lambda f: f
            return fn

@spaces.GPU(duration=120)
def zero_gpu_pipeline_worker(x: str = "") -> str:
    """Pre-registered GPU function for Hugging Face ZeroGPU runtime."""
    return x

# ---------------------------------------------------------------------------
# Build Gradio UI with full-viewport React 19 Localhost Dashboard
# ---------------------------------------------------------------------------

with gr.Blocks(
    title="AI Traffic Adaptation System",
    theme=gr.themes.Soft(primary_hue="indigo"),
    css="""
    .gradio-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
    footer { display: none !important; }
    """
) as demo:
    gr.HTML(
        """
        <div style="width: 100%; height: 96vh; margin: 0; padding: 0; overflow: hidden; background: #020617;">
            <iframe
                id="react-dashboard-frame"
                src="/dashboard/"
                style="width: 100%; height: 100%; border: none; display: block;"
                title="AI Traffic Adaptation Dashboard"
            ></iframe>
        </div>
        """
    )

# ---------------------------------------------------------------------------
# Mount FastAPI REST endpoints, WebSocket telemetry, and React Build
# ---------------------------------------------------------------------------

for route in fastapi_app.routes:
    demo.app.routes.append(route)

if DIST_DIR.exists():
    demo.app.mount("/dashboard", StaticFiles(directory=str(DIST_DIR), html=True), name="react_dashboard")

# ---------------------------------------------------------------------------
# Launch
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0")
