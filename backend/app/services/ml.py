"""Computer vision pipeline. Mock when YOLO_MODEL_PATH empty."""
from __future__ import annotations
import hashlib
import io
import logging
from typing import Tuple
from PIL import Image
from app.core.config import settings

logger = logging.getLogger(__name__)

CANONICAL_CATEGORIES = [
    "pothole", "water_leak", "blocked_drain", "downed_power_line",
    "uncollected_waste", "broken_streetlight", "damaged_road_sign", "other",
]

class ModelPipeline:
    def __init__(self) -> None:
        self.model = None
        self._load_model()

    def _load_model(self) -> None:
        path = (settings.yolo_model_path or "").strip()
        if not path:
            logger.info("YOLO_MODEL_PATH empty – using mock classifier")
            return
        try:
            from ultralytics import YOLO
            self.model = YOLO(path)
            logger.info("Loaded YOLO model from %s", path)
        except Exception as exc:
            logger.warning("Failed to load YOLO model (%s). Falling back to mock.", exc)
            self.model = None

    def predict_category(self, image_bytes: bytes) -> Tuple[str, float]:
        if self.model is not None:
            return self._predict_yolo(image_bytes)
        return self._predict_mock(image_bytes)

    def _predict_yolo(self, image_bytes: bytes) -> Tuple[str, float]:
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            results = self.model(image, verbose=False)
            if not results or len(results[0].boxes) == 0:
                return "other", 0.0
            box = results[0].boxes[0]
            class_id = int(box.cls[0])
            conf = float(box.conf[0])
            name = results[0].names.get(class_id, "other")
            normalized = name.lower().replace(" ", "_")
            if normalized not in CANONICAL_CATEGORIES:
                normalized = "other"
            return normalized, conf
        except Exception as exc:
            logger.exception("YOLO inference failed: %s", exc)
            return "other", 0.0

    def _predict_mock(self, image_bytes: bytes) -> Tuple[str, float]:
        digest = hashlib.sha256(image_bytes).hexdigest()
        idx = int(digest[:8], 16) % len(CANONICAL_CATEGORIES)
        conf = 0.55 + (int(digest[8:12], 16) % 40) / 100.0
        return CANONICAL_CATEGORIES[idx], round(conf, 3)

pipeline = ModelPipeline()
