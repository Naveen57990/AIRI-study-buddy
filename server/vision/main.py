"""
FastAPI server that receives webcam frames, runs the vision pipeline,
and returns structured detection results.
"""
from __future__ import annotations

import base64
import io
import time

import cv2
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from state_engine import StateEngine
from vision_engine import VisionEngine

# ── App ────────────────────────────────────────────────────────────────
app = FastAPI(title="AIRI Vision Server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Globals (lazy-loaded) ──────────────────────────────────────────────
_vision: VisionEngine | None = None
_state: StateEngine | None = None


def _ensure_loaded() -> tuple[VisionEngine, StateEngine]:
    global _vision, _state
    if _vision is None:
        v = VisionEngine()
        v.load()
        _vision = v
    if _state is None:
        s = StateEngine()
        s.load()
        _state = s
    return _vision, _state


# ── Schemas ────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    image_base64: str = Field(..., description="data URI or raw base64 JPEG")


class AnalyzeResponse(BaseModel):
    detection: str
    comment: str
    debug: dict = Field(default_factory=dict)


# ── Endpoint ───────────────────────────────────────────────────────────
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    t0 = time.perf_counter()

    # 1) Decode base64 → OpenCV BGR
    raw = req.image_base64
    if "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        buf = base64.b64decode(raw)
        arr = np.frombuffer(buf, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            return AnalyzeResponse(
                detection="FOCUSED",
                comment="",
                debug={"error": "bad image data", "ms": 0},
            )
    except Exception as e:
        return AnalyzeResponse(
            detection="FOCUSED",
            comment="",
            debug={"error": str(e), "ms": 0},
        )

    # 2) Run vision pipeline
    vision, state = _ensure_loaded()
    signals = vision.analyze(frame)

    # 3) Run state engine
    result = state.decide(signals)

    total_ms = (time.perf_counter() - t0) * 1000.0

    result["debug"] = {
        "inference_ms": round(signals.inference_ms, 1),
        "total_ms": round(total_ms, 1),
        "persons": signals.person_count,
        "phones": signals.phone_detected,
        "phone_conf": round(signals.phone_conf, 3),
        "faces": signals.face_count,
        "brightness": round(signals.brightness, 1),
        "ear": round(signals.ear, 3),
        "mar": round(signals.mar, 3),
    }
    if signals.errors:
        result["debug"]["errors"] = signals.errors

    return AnalyzeResponse(**result)


# ── Health ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    vision, _ = _ensure_loaded()
    return {"status": "ok", "vision_ready": vision.is_ready}


# ── Startup ────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    print("[Vision] Loading models…")
    _ensure_loaded()
    print("[Vision] Server ready on :3001")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001, log_level="warning")
