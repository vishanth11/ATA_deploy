"""Hugging Face Spaces Full-Stack Production Application.

Serves the exact full-featured React 19 + Tailwind CSS dark-mode dashboard
at root URL `/`, backed by FastAPI REST & WebSocket APIs, and mounts a
Gradio endpoint at `/gradio` for SDK compatibility.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "src" / "near_miss"))

try:
    import src.near_miss as near_miss
    sys.modules["near_miss"] = near_miss
except Exception:
    pass

import gradio as gr
import uvicorn
from dashboard_api import app as fastapi_app

# Minimal Gradio block for Hugging Face Spaces SDK compatibility
with gr.Blocks(title="AI Traffic Adaptation System") as demo:
    gr.Markdown("# 🚦 AI Traffic Adaptation Backend Active")
    gr.Markdown("The primary interactive React 19 dashboard is served on root: [Open Dashboard](/)")

app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
