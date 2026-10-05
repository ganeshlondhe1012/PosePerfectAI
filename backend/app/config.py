from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
MODEL_DIR = ROOT / "models"

MODEL_URLS = {
    "lite": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "full": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "heavy": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
}

@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    pose_model: str = os.getenv("POSE_MODEL", "lite").lower()
    min_detection_confidence: float = float(os.getenv("MIN_DETECTION_CONFIDENCE", "0.5"))
    min_presence_confidence: float = float(os.getenv("MIN_PRESENCE_CONFIDENCE", "0.5"))
    min_tracking_confidence: float = float(os.getenv("MIN_TRACKING_CONFIDENCE", "0.5"))
    frame_target_fps: int = int(os.getenv("FRAME_TARGET_FPS", "6"))
    correct_stable_seconds: float = float(os.getenv("CORRECT_STABLE_SECONDS", "1.2"))
    score_smoothing_window: int = int(os.getenv("SCORE_SMOOTHING_WINDOW", "8"))

    @property
    def model_path(self) -> Path:
        model = self.pose_model if self.pose_model in MODEL_URLS else "lite"
        return MODEL_DIR / f"pose_landmarker_{model}.task"

settings = Settings()
MODEL_DIR.mkdir(parents=True, exist_ok=True)
