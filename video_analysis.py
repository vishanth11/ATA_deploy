"""Video perception analysis service.

Executes the unified YOLO perception pipeline on uploaded or sample video files,
and computes comprehensive telemetry statistics matching terminal commands.
"""

from __future__ import annotations

import json
import os
import statistics
import threading
import time
from collections import Counter
from pathlib import Path
from typing import Any

from unified_pipeline import ROOT, OUTPUT_DIR, run_pipeline

UPLOADS_DIR = OUTPUT_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

_video_processing_lock = threading.Lock()
_current_processing_job: dict[str, Any] | None = None


def is_video_processing_active() -> bool:
    return _video_processing_lock.locked()


def get_current_job_status() -> dict[str, Any] | None:
    return _current_processing_job


def get_sample_videos() -> list[dict[str, Any]]:
    """Scan data/real_footage_test for available sample test videos."""
    base = ROOT / "data" / "real_footage_test"
    if not base.exists():
        return []

    samples = []
    for path in sorted(base.rglob("*.mp4")):
        category = path.parent.name.replace("near miss", "near_miss")
        samples.append({
            "category": category,
            "filename": path.name,
            "relative_path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "size_mb": round(path.stat().st_size / (1024 * 1024), 2),
        })
    return samples


def analyze_perception_frames(frames: list[dict]) -> dict[str, Any]:
    """Compute structured telemetry metrics matching user analysis commands."""
    if not frames:
        return {
            "summary": {
                "total_frames": 0,
                "active_frames": 0,
                "total_detections": 0,
                "unique_vehicles": 0,
                "emergency_detections": 0,
            },
            "vehicle_types": {},
            "emergency_analysis": {
                "emergency_detections": 0,
                "emergency_vehicle_ids": [],
                "sample_emergency_records": [],
            },
            "frame_statistics": {
                "total_frames": 0,
                "average_detections": 0.0,
                "max_detections": 0,
                "min_detections": 0,
                "total_detections": 0,
            },
            "confidence_statistics": {
                "total_detections": 0,
                "average_confidence": 0.0,
                "min_confidence": 0.0,
                "max_confidence": 0.0,
            },
            "tracking_check": {
                "total_frames": 0,
                "first_frame_keys": [],
                "first_frame_detections": 0,
                "detection_fields": [],
            },
            "active_frame_numbers": [],
            "sample_detections": [],
        }

    total_frames = len(frames)
    active_frames = [f for f in frames if f.get("detections")]
    active_frame_numbers = [f.get("frame", i + 1) for i, f in enumerate(frames) if f.get("detections")]

    all_detections = [d for f in frames for d in f.get("detections", [])]
    total_detections = len(all_detections)

    # 1. Perception summary & Vehicle Types Counter
    type_counts = Counter(d.get("type", "unknown") for d in all_detections)
    unique_ids = sorted({d.get("vehicle_id") for d in all_detections if d.get("vehicle_id") is not None})
    emergency_dets = [d for d in all_detections if d.get("emergency", False) or d.get("type") == "emergency_vehicle"]

    # 2. Emergency analysis
    emergency_ids = sorted({d.get("vehicle_id") for d in emergency_dets if d.get("vehicle_id") is not None})
    emergency_samples = [
        {
            "vehicle_id": d.get("vehicle_id"),
            "type": d.get("type"),
            "confidence": round(float(d.get("confidence", 0.0)), 2),
            "speed": d.get("speed"),
            "direction": d.get("direction"),
            "position": d.get("position"),
        }
        for d in emergency_dets[:25]
    ]

    # 3. Frame statistics
    counts_per_frame = [len(f.get("detections", [])) for f in frames]
    avg_per_frame = round(statistics.mean(counts_per_frame), 2) if counts_per_frame else 0.0
    max_per_frame = max(counts_per_frame) if counts_per_frame else 0
    min_per_frame = min(counts_per_frame) if counts_per_frame else 0

    # 4. Confidence statistics
    confs = [float(d.get("confidence", 0.0)) for d in all_detections if d.get("confidence") is not None]
    avg_conf = round(statistics.mean(confs), 3) if confs else 0.0
    min_conf = round(min(confs), 3) if confs else 0.0
    max_conf = round(max(confs), 3) if confs else 0.0

    # 5. Tracking check
    first_frame = frames[0] if frames else {}
    first_frame_dets = first_frame.get("detections", [])
    first_det = all_detections[0] if all_detections else {}

    return {
        "summary": {
            "total_frames": total_frames,
            "active_frames": len(active_frames),
            "total_detections": total_detections,
            "unique_vehicles": len(unique_ids),
            "emergency_detections": len(emergency_dets),
        },
        "vehicle_types": dict(type_counts),
        "emergency_analysis": {
            "emergency_detections": len(emergency_dets),
            "emergency_vehicle_ids": emergency_ids,
            "sample_emergency_records": emergency_samples,
        },
        "frame_statistics": {
            "total_frames": total_frames,
            "average_detections": avg_per_frame,
            "max_detections": max_per_frame,
            "min_detections": min_per_frame,
            "total_detections": total_detections,
        },
        "confidence_statistics": {
            "total_detections": len(confs),
            "average_confidence": avg_conf,
            "min_confidence": min_conf,
            "max_confidence": max_conf,
        },
        "tracking_check": {
            "total_frames": total_frames,
            "first_frame_keys": list(first_frame.keys()),
            "first_frame_detections": len(first_frame_dets),
            "detection_fields": list(first_det.keys()),
        },
        "active_frame_numbers": active_frame_numbers[:100],
        "sample_detections": all_detections[:50],
    }


def process_video(video_path: str | Path, output_json: str | Path = None) -> dict[str, Any]:
    """Execute pipeline and return full analysis."""
    global _current_processing_job
    video_path = Path(video_path).resolve()
    if not video_path.exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    with _video_processing_lock:
        start_time = time.time()
        _current_processing_job = {
            "status": "processing",
            "video_path": str(video_path),
            "filename": video_path.name,
            "started_at": start_time,
        }
        try:
            frames = run_pipeline(str(video_path), mode="video", output_path=str(output_json) if output_json else None)
            analysis = analyze_perception_frames(frames)
            elapsed = round(time.time() - start_time, 2)
            _current_processing_job = {
                "status": "completed",
                "video_path": str(video_path),
                "filename": video_path.name,
                "elapsed_seconds": elapsed,
            }
            return {
                "status": "success",
                "filename": video_path.name,
                "elapsed_seconds": elapsed,
                "analysis": analysis,
                "frames": frames,
            }
        except Exception as exc:
            _current_processing_job = {
                "status": "failed",
                "video_path": str(video_path),
                "filename": video_path.name,
                "error": str(exc),
            }
            raise
