"""ASGI entry point for local and Hugging Face Spaces deployments."""

from __future__ import annotations

import os

import uvicorn

from dashboard_api import app


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "7860")),
        reload=False,
    )
