"""
Vision pipeline: YOLOv8 person/phone detection + MediaPipe face mesh.
Returns RawSignals for the state engine to decide on.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RawSignals:
    """Raw sensor data extracted from a single webcam frame."""
    person_count: int = 1  # assume 1 person by default
    phone_detected: bool = False
    phone_conf: float = 0.0
    brightness: float = 120.0
    face_found: bool = False
    face_count: int = 0
    ear: float = 0.35       # eye aspect ratio (lower = more closed)
    mar: float = 0.15       # mouth aspect ratio (higher = more open / yawn)
    inference_ms: float = 0.0
    errors: list[str] = field(default_factory=list)


# MediaPipe face-mesh landmark indices for EAR / MAR
LEFT_EYE  = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]
MOUTH     = [61, 291, 39, 181, 0, 17, 269, 405]  # outer-lip contour


def _ear(landmarks: list[tuple[float, float]], idxs: list[int]) -> float:
    import numpy as np
    pts = [landmarks[i] for i in idxs]
    a = np.linalg.norm(np.array(pts[1]) - np.array(pts[5]))
    b = np.linalg.norm(np.array(pts[2]) - np.array(pts[4]))
    c = np.linalg.norm(np.array(pts[0]) - np.array(pts[3]))
    return float((a + b) / (2.0 * c + 1e-6))


def _mar(landmarks: list[tuple[float, float]]) -> float:
    import numpy as np
    pts = [landmarks[i] for i in MOUTH]
    vert = np.linalg.norm(np.array(pts[3]) - np.array(pts[7]))
    horz = np.linalg.norm(np.array(pts[0]) - np.array(pts[4]))
    return float(vert / (horz + 1e-6))


class VisionEngine:
    """Wraps YOLO (person/phone) and MediaPipe (face/eyes/mouth)."""

    def __init__(self) -> None:
        self._yolo: Any = None
        self._face_mesh: Any = None
        self._ready: list[str] = []

    def load(self) -> None:
        """Load models (called once at startup)."""
        # ── YOLO ──────────────────────────────────────────────────────
        try:
            from ultralytics import YOLO
            self._yolo = YOLO("yolov8n.pt")
            _ = self._yolo.model  # force parameter loading
            self._ready.append("yolo")
        except Exception as e:
            print(f"[Vision] YOLO load failed: {e}")

        # ── MediaPipe Face Landmarker (tasks API) ─────────────────────
        try:
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision as mp_vision
            model_path = "face_landmarker.task"
            if not os.path.exists(model_path):
                import urllib.request
                url = ("https://storage.googleapis.com/mediapipe-models/"
                       "face_landmarker/face_landmarker/float16/latest/"
                       "face_landmarker.task")
                print(f"[Vision] Downloading {url} …")
                urllib.request.urlretrieve(url, model_path)
                print("[Vision] Face landmarker model downloaded.")
            options = mp_vision.FaceLandmarkerOptions(
                base_options=mp_python.BaseOptions(model_asset_path=model_path),
                running_mode=mp_vision.RunningMode.IMAGE,
                num_faces=3,
                min_face_detection_confidence=0.4,
            )
            self._face_mesh = mp_vision.FaceLandmarker.create_from_options(options)
            self._ready.append("mediapipe")
        except Exception as e:
            print(f"[Vision] MediaPipe load failed: {e}")

        print(f"[Vision] Ready modules: {self._ready or 'NONE'}")

    @property
    def is_ready(self) -> bool:
        return len(self._ready) > 0

    # ------------------------------------------------------------------
    def analyze(self, frame):  # frame: numpy array (BGR)
        """Run the full pipeline on a BGR frame and return RawSignals."""
        import cv2
        import numpy as np
        t0 = time.perf_counter()
        signals = RawSignals()

        # 1) Brightness
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        signals.brightness = float(gray.mean())

        # 2) YOLO
        if self._yolo is not None:
            try:
                results = self._yolo(frame, verbose=False)
                if results and len(results) > 0:
                    boxes = results[0].boxes
                    if boxes is not None and boxes.cls is not None:
                        cls_ids = boxes.cls.cpu().numpy().tolist()
                        confs   = boxes.conf.cpu().numpy().tolist()
                        persons = sum(1 for c, s in zip(cls_ids, confs) if int(c) == 0 and s > 0.4)
                        phones  = sum(1 for c, s in zip(cls_ids, confs) if int(c) == 77 and s > 0.15)
                        phone_confs = [s for c, s in zip(cls_ids, confs) if int(c) == 77]
                        if persons > 0:
                            signals.person_count = persons
                        signals.phone_detected = phones > 0
                        if phone_confs:
                            signals.phone_conf = max(phone_confs)
            except Exception as e:
                signals.errors.append(f"yolo:{e}")

        # 3) MediaPipe Face Landmarker (tasks API)
        if self._face_mesh is not None:
            try:
                import mediapipe as mp
                h, w = frame.shape[:2]
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                results = self._face_mesh.detect(mp_img)
                if results.face_landmarks:
                    signals.face_found = True
                    signals.face_count = len(results.face_landmarks)
                    lm = results.face_landmarks[0]
                    landmarks = [(lm[i].x * w, lm[i].y * h) for i in range(min(len(lm), 468))]
                    if len(landmarks) >= 468:
                        signals.ear = _ear(landmarks, LEFT_EYE)
                        signals.mar = _mar(landmarks)
            except Exception as e:
                signals.errors.append(f"mediapipe:{e}")

        signals.inference_ms = (time.perf_counter() - t0) * 1000.0
        return signals
