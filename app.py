"""Hugging Face Gradio entry point with the React dashboard mounted in-app."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import gradio as gr
from starlette.routing import Mount

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "src" / "near_miss"))

try:
    import src.near_miss as near_miss

    sys.modules["near_miss"] = near_miss
except Exception:
    pass

from dashboard_api import app as fastapi_app

try:
    import spaces
except ImportError:
    class spaces:
        @staticmethod
        def GPU(fn=None, duration=120):
            if fn is None:
                return lambda function: function
            return fn


@spaces.GPU(duration=120)
def zero_gpu_pipeline_worker(value: str = "") -> str:
    """Register the Space's ZeroGPU worker with Hugging Face's supervisor."""
    return value


with gr.Blocks(title="AI Traffic Adaptation System") as demo:
    gr.HTML(
        """
        <style>
          .gradio-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          footer { display: none !important; }
        </style>
        <div style="width:100%;height:96vh;margin:0;padding:0;overflow:hidden;background:#020617">
          <iframe src="/dashboard/" title="AI Traffic Adaptation Dashboard"
            style="width:100%;height:100%;border:0;display:block"></iframe>
        </div>
        """
    )

# Gradio registers catch-all routes during Blocks construction. Put the mounted
# application first so its API, static files, and WebSocket routes are matched.
demo.app.router.routes.insert(
    0,
    Mount("/dashboard", app=fastapi_app, name="traffic_dashboard"),
)
app = demo.app


if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        server_port=int(os.environ.get("PORT", "7860")),
        theme=gr.themes.Soft(primary_hue="indigo"),
        _app=app,
    )
