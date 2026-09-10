from __future__ import annotations

import json
import os
import shlex
import subprocess
from dataclasses import dataclass
from time import perf_counter
from typing import Protocol

from .schemas import Evidence, InferenceRequest, InferenceResponse, ModelRun, RoomPolygon


R2G_LABELS: dict[int, str] = {
    0: "unknown",
    1: "living_room",
    2: "kitchen",
    3: "bedroom",
    4: "bathroom",
    5: "restroom",
    6: "balcony",
    7: "closet",
    8: "corridor",
    9: "washing_room",
    10: "service",
    11: "outside",
}


@dataclass(frozen=True)
class Raster2SeqPolygon:
    points: list[tuple[float, float]]
    category_id: int
    confidence: float = 0.8


@dataclass(frozen=True)
class Raster2SeqPrediction:
    image_width_px: int
    image_height_px: int
    model_size_px: int
    polygons: list[Raster2SeqPolygon]
    checkpoint: str


class Raster2SeqBackend(Protocol):
    def predict(self, image_url: str) -> Raster2SeqPrediction:
        ...


class SubprocessRaster2SeqBackend:
    """Calls a separately isolated Raster2Seq GPU runtime over a JSON stdio bridge."""

    def __init__(self, command: str, timeout_seconds: int = 120) -> None:
        self._command = shlex.split(command)
        if not self._command:
            raise ValueError("Raster2Seq bridge command cannot be empty")
        self._timeout_seconds = timeout_seconds

    def predict(self, image_url: str) -> Raster2SeqPrediction:
        completed = subprocess.run(
            self._command,
            input=json.dumps({"image_url": image_url}),
            text=True,
            capture_output=True,
            timeout=self._timeout_seconds,
            check=False,
        )
        if completed.returncode != 0:
            detail = completed.stderr.strip()[-500:] or f"exit_{completed.returncode}"
            raise RuntimeError(f"Raster2Seq bridge failed: {detail}")
        payload = json.loads(completed.stdout)
        polygons = [
            Raster2SeqPolygon(
                points=[(float(point[0]), float(point[1])) for point in item["points"]],
                category_id=int(item.get("category_id", 0)),
                confidence=float(item.get("confidence", 0.8)),
            )
            for item in payload.get("polygons", [])
            if isinstance(item.get("points"), list) and len(item["points"]) >= 3
        ]
        return Raster2SeqPrediction(
            image_width_px=int(payload["image_width_px"]),
            image_height_px=int(payload["image_height_px"]),
            model_size_px=int(payload.get("model_size_px", 512)),
            polygons=polygons,
            checkpoint=str(payload.get("checkpoint", "raster2graph-512")),
        )


def _inverse_resize_and_pad(
    point: tuple[float, float], *, image_width: int, image_height: int, model_size: int
) -> tuple[float, float]:
    scale = min(model_size / image_height, model_size / image_width)
    new_height = int(image_height * scale)
    new_width = int(image_width * scale)
    top = (model_size - new_height) // 2
    left = (model_size - new_width) // 2
    x = (point[0] - left) / scale
    y = (point[1] - top) / scale
    return (
        max(0.0, min(float(image_width), x)),
        max(0.0, min(float(image_height), y)),
    )


def _to_meters(
    point: tuple[float, float], *, request: InferenceRequest, prediction: Raster2SeqPrediction
) -> tuple[float, float]:
    if not request.drawing_units_per_meter or not request.source_width_units or not request.source_height_units:
        raise ValueError("trusted drawing scale and source page dimensions are required")
    source_px = _inverse_resize_and_pad(
        point,
        image_width=prediction.image_width_px,
        image_height=prediction.image_height_px,
        model_size=prediction.model_size_px,
    )
    source_x_units = source_px[0] * (request.source_width_units / prediction.image_width_px)
    source_y_units = source_px[1] * (request.source_height_units / prediction.image_height_px)
    return (
        source_x_units / request.drawing_units_per_meter,
        source_y_units / request.drawing_units_per_meter,
    )


class Raster2SeqAdapter:
    capability = "room_polygons"
    model = "raster2seq"
    model_version = "siggraph-2026"

    def __init__(self, backend: Raster2SeqBackend) -> None:
        self._backend = backend

    def infer(self, request: InferenceRequest) -> InferenceResponse:
        started = perf_counter()
        if not request.drawing_units_per_meter or not request.source_width_units or not request.source_height_units:
            return InferenceResponse(
                source_version_id=request.source_version_id,
                source_page=request.source_page,
                consensus_confidence=0,
                warnings=["Raster2Seq geometry was withheld because the source coordinate frame is not trusted."],
                model_runs=[ModelRun(
                    capability=self.capability,
                    model=self.model,
                    model_version=self.model_version,
                    status="failed",
                    latency_ms=0,
                    detail="coordinate_frame_untrusted",
                )],
            )

        try:
            prediction = self._backend.predict(str(request.image_url))
            rooms: list[RoomPolygon] = []
            for polygon in prediction.polygons:
                points = [_to_meters(point, request=request, prediction=prediction) for point in polygon.points]
                rooms.append(RoomPolygon(
                    points=points,
                    label=R2G_LABELS.get(polygon.category_id, "unknown"),
                    confidence=max(0.0, min(1.0, polygon.confidence)),
                    evidence=[Evidence(
                        source="model",
                        page=request.source_page,
                        confidence=max(0.0, min(1.0, polygon.confidence)),
                        model=f"raster2seq:{prediction.checkpoint}",
                    )],
                ))
            confidence = sum(room.confidence for room in rooms) / len(rooms) if rooms else 0.0
            return InferenceResponse(
                source_version_id=request.source_version_id,
                source_page=request.source_page,
                rooms=rooms,
                consensus_confidence=confidence,
                warnings=[] if rooms else ["Raster2Seq completed but returned no room polygons."],
                model_runs=[ModelRun(
                    capability=self.capability,
                    model=self.model,
                    model_version=self.model_version,
                    status="succeeded",
                    latency_ms=int((perf_counter() - started) * 1000),
                    confidence=confidence,
                    detail=prediction.checkpoint,
                )],
            )
        except Exception as exc:
            return InferenceResponse(
                source_version_id=request.source_version_id,
                source_page=request.source_page,
                consensus_confidence=0,
                warnings=["Raster2Seq inference failed closed; deterministic B.O.S. geometry remains authoritative."],
                model_runs=[ModelRun(
                    capability=self.capability,
                    model=self.model,
                    model_version=self.model_version,
                    status="failed",
                    latency_ms=int((perf_counter() - started) * 1000),
                    detail=str(exc)[:300],
                )],
            )


def raster2seq_adapter_from_env() -> Raster2SeqAdapter | None:
    command = os.environ.get("BOS_RASTER2SEQ_BRIDGE_COMMAND", "").strip()
    if not command:
        return None
    return Raster2SeqAdapter(SubprocessRaster2SeqBackend(command))
