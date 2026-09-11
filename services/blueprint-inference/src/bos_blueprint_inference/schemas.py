from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

Point = tuple[float, float]
MAX_INLINE_IMAGE_URI_CHARS = 42_000_000


class Evidence(BaseModel):
    source: Literal["raster", "vector", "dimension", "model"]
    page: int = Field(ge=1)
    confidence: float = Field(ge=0, le=1)
    model: str | None = None


class WallCandidate(BaseModel):
    start: Point
    end: Point
    thickness_m: float | None = Field(default=None, gt=0)
    confidence: float = Field(ge=0, le=1)
    evidence: list[Evidence] = Field(default_factory=list)


class RoomPolygon(BaseModel):
    points: list[Point] = Field(min_length=3)
    label: str | None = None
    confidence: float = Field(ge=0, le=1)
    evidence: list[Evidence] = Field(default_factory=list)


class OpeningCandidate(BaseModel):
    kind: Literal["door", "window", "opening"]
    center: Point
    width_m: float | None = Field(default=None, gt=0)
    confidence: float = Field(ge=0, le=1)
    evidence: list[Evidence] = Field(default_factory=list)


class InferenceRequest(BaseModel):
    company_id: UUID
    project_id: UUID | None = None
    source_version_id: UUID
    source_page: int = Field(ge=1)
    image_url: str = Field(min_length=1, max_length=MAX_INLINE_IMAGE_URI_CHARS)
    drawing_units_per_meter: float | None = Field(default=None, gt=0)
    source_width_units: float | None = Field(default=None, gt=0)
    source_height_units: float | None = Field(default=None, gt=0)
    requested_capabilities: list[
        Literal["room_polygons", "wall_mask", "wall_edges", "openings", "segmentation"]
    ] = Field(default_factory=lambda: ["room_polygons", "wall_edges", "openings"])

    @field_validator("image_url")
    @classmethod
    def validate_image_source(cls, value: str) -> str:
        if value.startswith("https://"):
            return value
        if value.startswith("data:image/png;base64,"):
            return value
        raise ValueError("image_url must be HTTPS or a PNG data URI")


class ModelRun(BaseModel):
    capability: str
    model: str
    model_version: str
    status: Literal["succeeded", "unavailable", "failed"]
    latency_ms: int = Field(ge=0)
    confidence: float | None = Field(default=None, ge=0, le=1)
    detail: str | None = None


class InferenceResponse(BaseModel):
    protocol_version: Literal["bos-blueprint-inference-v1"] = "bos-blueprint-inference-v1"
    source_version_id: UUID
    source_page: int
    walls: list[WallCandidate] = Field(default_factory=list)
    rooms: list[RoomPolygon] = Field(default_factory=list)
    openings: list[OpeningCandidate] = Field(default_factory=list)
    model_runs: list[ModelRun] = Field(default_factory=list)
    consensus_confidence: float = Field(ge=0, le=1)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_model_evidence_for_geometry(self) -> "InferenceResponse":
        geometry = [*self.walls, *self.rooms, *self.openings]
        for item in geometry:
            if not item.evidence:
                raise ValueError("Every inferred geometry object must carry provenance evidence")
        return self
