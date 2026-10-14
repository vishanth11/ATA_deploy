"""FastAPI dashboard API — REST + WebSocket.

Start with:
    uvicorn dashboard_api:app --host 0.0.0.0 --port 8000 --reload

Or run alongside the traffic controller:
    python dashboard_api.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
for p in (str(SRC), str(ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from dashboard_state import state
from dashboard_runner import start_simulation, stop_simulation, is_simulation_running
from video_analysis import (
    get_sample_videos,
    process_video,
    is_video_processing_active,
    get_current_job_status,
    UPLOADS_DIR,
    analyze_perception_frames,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_from_latest_jsonl()
    broadcast_task = asyncio.create_task(_broadcast_loop())
    yield
    broadcast_task.cancel()


app = FastAPI(title="AI Traffic Adaptation Dashboard API", version="1.0.0", lifespan=lifespan)


# -----------------------------------------------------------------------
# Seed state from the most recent JSONL run log (so dashboard is never empty)
# -----------------------------------------------------------------------

def _seed_from_latest_jsonl():
    """Load the most recent runtime.jsonl into DashboardState."""
    runs_dir = ROOT / "results" / "final_runs"
    if not runs_dir.exists():
        return

    # Find newest runtime.jsonl
    jsonl_files = sorted(runs_dir.glob("*/runtime.jsonl"), key=lambda p: p.stat().st_mtime)
    if not jsonl_files:
        return
    latest = jsonl_files[-1]

    decisions = []
    junctions: dict = {}
    logs = []
    max_time = 0.0
    mode = "normal"
    has_emergency = False

    with open(latest, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            event = record.get("event")
            logs.append(record)

            if event == "system_start":
                mode = record.get("mode", "normal")

            elif event == "decision":
                decisions.append(record)
                sim_time = float(record.get("time", 0))
                if sim_time > max_time:
                    max_time = sim_time

                jid = record.get("junction")
                if jid:
                    safety = record.get("safety", {})
                    executed = record.get("executed", {})
                    if record.get("emergency_active"):
                        has_emergency = True
                    junctions[jid] = {
                        "junction_id": jid,
                        "current_phase_index": executed.get("phase"),
                        "current_phase_state": executed.get("state"),
                        "remaining_time": None,
                        "last_decision": record.get("selected"),
                        "decision_method": record.get("method"),
                        "safety_approved": safety.get("approved"),
                        "safety_checks": safety.get("checks"),
                        "emergency_active": record.get("emergency_active", False),
                        "emergency_vehicle_id": record.get("emergency_vehicle_id"),
                        "simulation_time": sim_time,
                    }

    # Populate state (most recent first)
    for record in reversed(decisions):
        state.add_decision(record)
    for jid, jdata in junctions.items():
        state.update_junction(jid, jdata)
    for log in reversed(logs):
        state.logs.appendleft(log)

    # Derive summary stats from decisions
    emergency_count = sum(1 for d in decisions if d.get("emergency_active"))
    state.update_system(
        status="stopped",
        sim_time=max_time,
        mode=mode,
        prediction_available=True,
    )
    state.emergency_vehicles = (
        [{"vehicle_id": "ambulance (historical)", "source": "log"}]
        if has_emergency else []
    )
    state.started_at = logs[0].get("timestamp") if logs else None
    print(f"[dashboard] Seeded from {latest.name}: {len(decisions)} decisions, "
          f"{len(junctions)} junctions, sim_time={max_time}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------
# WebSocket connection manager
# -----------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self._clients: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._clients.append(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            if ws in self._clients:
                self._clients.remove(ws)

    async def broadcast(self, data: dict):
        message = json.dumps(data)
        async with self._lock:
            dead = []
            for ws in self._clients:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self._clients.remove(ws)


manager = ConnectionManager()


# -----------------------------------------------------------------------
# Background task — push live state to all WebSocket clients
# -----------------------------------------------------------------------

async def _broadcast_loop():
    while True:
        await asyncio.sleep(1.0)
        if manager._clients:
            payload = {
                "type": "live_update",
                "status": state.snapshot(),
                "junctions": state.junctions_snapshot(),
                "emergencies": state.emergencies_snapshot(),
                "safety": state.safety_snapshot(),
                "latest_decision": state.decisions_snapshot()[:1],
                "logs": state.logs_snapshot()[:20],
            }
            await manager.broadcast(payload)


# Lifespan context manager is registered at app instantiation.


# -----------------------------------------------------------------------
# REST endpoints
# -----------------------------------------------------------------------

@app.get("/api/status")
def get_status():
    return state.snapshot()


@app.get("/api/junctions")
def get_junctions():
    return state.junctions_snapshot()


@app.get("/api/junctions/{junction_id}")
def get_junction(junction_id: str):
    data = state.junction_snapshot(junction_id)
    if data is None:
        return JSONResponse(status_code=404, content={"detail": "Junction not found"})
    return data


@app.get("/api/decisions")
def get_decisions():
    return state.decisions_snapshot()


@app.get("/api/safety")
def get_safety():
    return state.safety_snapshot()


@app.get("/api/emergencies")
def get_emergencies():
    return state.emergencies_snapshot()


@app.get("/api/metrics")
def get_metrics():
    return state.metrics_snapshot()


@app.get("/api/logs")
def get_logs():
    return state.logs_snapshot()


@app.get("/api/comparison")
def get_comparison():
    return state.comparison_snapshot()


# -----------------------------------------------------------------------
# Perception & Simulation Control endpoints
# -----------------------------------------------------------------------

_perception_data = None
_perception_mtime = 0.0


def _get_perception_data():
    global _perception_data, _perception_mtime
    path = ROOT / "outputs" / "perception_output.json"
    if not path.exists():
        return None
    try:
        mtime = path.stat().st_mtime
        if _perception_data is None or mtime != _perception_mtime:
            with open(path, "r", encoding="utf-8") as f:
                _perception_data = json.load(f)
            _perception_mtime = mtime
    except Exception as exc:
        print(f"[dashboard_api] Error loading perception data: {exc}")
        return None
    return _perception_data


@app.get("/api/perception")
def get_perception(frame: Optional[int] = Query(None, description="Optional frame number")):
    data = _get_perception_data()
    if data is None:
        return JSONResponse(status_code=404, content={"detail": "Perception data not found"})

    total_frames = len(data)
    active_frames = [f for f in data if f.get("detections")]
    active_frame_numbers = [f["frame"] for f in active_frames]

    unique_ids = set()
    emergency_count = 0
    total_detections = 0
    for f in active_frames:
        for d in f.get("detections", []):
            total_detections += 1
            if "vehicle_id" in d:
                unique_ids.add(d["vehicle_id"])
            if d.get("emergency"):
                emergency_count += 1

    summary = {
        "total_frames": total_frames,
        "active_frames_count": len(active_frames),
        "unique_vehicles": len(unique_ids),
        "total_detections": total_detections,
        "emergency_detections": emergency_count,
    }

    if frame is not None:
        target = next((f for f in data if f.get("frame") == frame), None)
        if target is None:
            return JSONResponse(status_code=404, content={"detail": f"Frame {frame} not found"})
        return {
            "frame": frame,
            "total_frames": total_frames,
            "detections": target.get("detections", []),
            "summary": summary,
        }

    sample_frame = active_frames[-1] if active_frames else (data[0] if data else {"frame": 0, "detections": []})
    return {
        "summary": summary,
        "active_frame_numbers": active_frame_numbers[:100],
        "sample_frame": sample_frame,
    }


class SimulationStartRequest(BaseModel):
    steps: int = 200
    emergency: bool = False
    gui: bool = False


@app.get("/api/simulation/status")
def get_simulation_status():
    return {
        "is_running": is_simulation_running(),
        "system_status": state.system_status,
        "simulation_time": state.simulation_time,
        "simulation_mode": state.simulation_mode,
    }


@app.post("/api/simulation/start")
def post_simulation_start(req: SimulationStartRequest = SimulationStartRequest()):
    if is_simulation_running():
        return JSONResponse(status_code=400, content={"detail": "Simulation is already running"})
    started = start_simulation(emergency=req.emergency, steps=req.steps, gui=req.gui)
    return {"started": started, "steps": req.steps, "emergency": req.emergency, "gui": req.gui}


@app.post("/api/simulation/stop")
def post_simulation_stop():
    stopped = stop_simulation()
    return {"stopped": stopped}


# -----------------------------------------------------------------------
# Video Upload & Pipeline Analysis Endpoints
# -----------------------------------------------------------------------

_latest_video_analysis: dict | None = None


class AnalyzeSampleRequest(BaseModel):
    sample_path: str


@app.get("/api/video/samples")
def get_video_samples():
    """Return available footage from data/real_footage_test."""
    return get_sample_videos()


@app.get("/api/video/status")
def get_video_status():
    """Return current video pipeline processing status."""
    return {
        "is_processing": is_video_processing_active(),
        "job": get_current_job_status(),
        "has_analysis": _latest_video_analysis is not None,
    }


@app.get("/api/video/latest-analysis")
def get_latest_video_analysis():
    """Return the most recently computed video analysis."""
    global _latest_video_analysis
    if _latest_video_analysis is None:
        # Fall back to analyzing whatever is currently in outputs/perception_output.json
        data = _get_perception_data()
        if data:
            _latest_video_analysis = {
                "status": "cached",
                "filename": "outputs/perception_output.json",
                "analysis": analyze_perception_frames(data),
            }
    if _latest_video_analysis is None:
        return JSONResponse(status_code=404, content={"detail": "No video analysis available yet"})
    return _latest_video_analysis


@app.post("/api/video/analyze-sample")
def post_analyze_sample(req: AnalyzeSampleRequest):
    """Run perception pipeline on a selected sample video."""
    global _latest_video_analysis
    if is_video_processing_active():
        return JSONResponse(status_code=409, content={"detail": "Another video is currently being processed"})

    target = ROOT / req.sample_path
    if not target.exists():
        return JSONResponse(status_code=404, content={"detail": f"Sample file not found: {req.sample_path}"})

    try:
        result = process_video(target)
        _latest_video_analysis = result
        return result
    except Exception as exc:
        return JSONResponse(status_code=500, content={"detail": f"Video analysis failed: {str(exc)}"})


@app.post("/api/video/upload-and-analyze")
async def post_upload_and_analyze(file: UploadFile = File(...)):
    """Upload a video file from the browser, process it, and return full telemetry."""
    global _latest_video_analysis
    if is_video_processing_active():
        return JSONResponse(status_code=409, content={"detail": "Another video is currently being processed"})

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in [".mp4", ".avi", ".mov", ".mkv"]:
        return JSONResponse(status_code=400, content={"detail": "Invalid video format. Use MP4, AVI, MOV, or MKV."})

    destination = UPLOADS_DIR / file.filename
    try:
        content = await file.read()
        with open(destination, "wb") as f:
            f.write(content)

        result = process_video(destination)
        _latest_video_analysis = result
        return result
    except Exception as exc:
        return JSONResponse(status_code=500, content={"detail": f"Video processing failed: {str(exc)}"})



# -----------------------------------------------------------------------
# WebSocket endpoint
# -----------------------------------------------------------------------

@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    await manager.connect(ws)
    # Send initial full state immediately on connect
    await ws.send_text(json.dumps({
        "type": "initial_state",
        "status": state.snapshot(),
        "junctions": state.junctions_snapshot(),
        "decisions": state.decisions_snapshot(),
        "emergencies": state.emergencies_snapshot(),
        "safety": state.safety_snapshot(),
        "metrics": state.metrics_snapshot(),
        "logs": state.logs_snapshot()[:50],
    }))
    try:
        while True:
            # Keep connection alive; client can send pings
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:
        await manager.disconnect(ws)


# -----------------------------------------------------------------------
# Static Frontend Serving (Single-Port & Cloud Container Deployment)
# -----------------------------------------------------------------------

DIST_DIR = ROOT / "frontend" / "dist"
if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Never intercept API or WebSocket paths
        if full_path.startswith("api/") or full_path.startswith("ws/") or full_path == "api" or full_path == "ws":
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        target = DIST_DIR / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        index_file = DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"detail": "Frontend build not found"})


# -----------------------------------------------------------------------
# Entry point for standalone run
# -----------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("dashboard_api:app", host="0.0.0.0", port=port, reload=False)
