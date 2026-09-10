from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

CommercialStatus = Literal["allowed", "review_required", "blocked"]


@dataclass(frozen=True)
class ModelGovernance:
    model: str
    license_name: str
    commercial_status: CommercialStatus
    source_url: str
    note: str


MODEL_GOVERNANCE: dict[str, ModelGovernance] = {
    "raster2seq": ModelGovernance(
        model="raster2seq",
        license_name="MIT",
        commercial_status="allowed",
        source_url="https://github.com/Cornell-VAILab/Raster2Seq",
        note="Primary learned raster-to-room-polygon candidate; repository license verified MIT.",
    ),
    "sam2.1": ModelGovernance(
        model="sam2.1",
        license_name="Apache-2.0",
        commercial_status="allowed",
        source_url="https://github.com/facebookresearch/sam2",
        note="Supporting segmentation evidence only; repository license verified Apache-2.0.",
    ),
    "roomformer": ModelGovernance(
        model="roomformer",
        license_name="MIT",
        commercial_status="allowed",
        source_url="https://github.com/ywyue/RoomFormer",
        note="Secondary polygon proposal / benchmark fallback; repository license verified MIT.",
    ),
    "cage": ModelGovernance(
        model="cage",
        license_name="MIT + Commons Clause commercial restriction",
        commercial_status="blocked",
        source_url="https://github.com/ee-Liu/CAGE",
        note="Do not load in B.O.S. commercial inference without a separate commercial license from the author.",
    ),
    "mitunet": ModelGovernance(
        model="mitunet",
        license_name="unverified implementation/checkpoint license",
        commercial_status="review_required",
        source_url="research-paper-only",
        note="Research candidate only until a concrete implementation and checkpoint license are verified.",
    ),
}


def governance_for(model: str) -> ModelGovernance:
    return MODEL_GOVERNANCE.get(
        model,
        ModelGovernance(
            model=model,
            license_name="unknown",
            commercial_status="blocked",
            source_url="unknown",
            note="Unknown models fail closed until license and provenance are explicitly reviewed.",
        ),
    )


def production_model_allowed(model: str) -> bool:
    return governance_for(model).commercial_status == "allowed"
