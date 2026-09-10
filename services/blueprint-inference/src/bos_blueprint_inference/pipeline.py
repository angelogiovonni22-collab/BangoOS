from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Protocol

from .schemas import InferenceRequest, InferenceResponse, ModelRun


@dataclass(frozen=True)
class CapabilitySpec:
    capability: str
    model: str
    model_version: str
    priority: int
    purpose: str


# Research-backed candidates are registered here, but a model is never reported as
# active until a concrete adapter is installed and returns evidence. This keeps the
# B.O.S. geometry path fail-closed instead of inventing AI geometry.
MODEL_CAPABILITIES: tuple[CapabilitySpec, ...] = (
    CapabilitySpec(
        capability="room_polygons",
        model="raster2seq",
        model_version="siggraph-2026",
        priority=100,
        purpose="semantic closed-loop room polygon reconstruction from raster floor plans",
    ),
    CapabilitySpec(
        capability="segmentation",
        model="sam2.1",
        model_version="2.1",
        priority=90,
        purpose="promptable segmentation support for ambiguous architectural regions",
    ),
    CapabilitySpec(
        capability="wall_mask",
        model="mitunet",
        model_version="2025-paper",
        priority=85,
        purpose="thin-wall semantic segmentation and boundary recovery",
    ),
    CapabilitySpec(
        capability="wall_edges",
        model="cage",
        model_version="continuity-aware-edge",
        priority=80,
        purpose="continuity-aware topology proposal for wall networks",
    ),
    CapabilitySpec(
        capability="room_polygons",
        model="roomformer",
        model_version="reference",
        priority=70,
        purpose="secondary structured polygon proposal for consensus and fallback",
    ),
)


class ModelAdapter(Protocol):
    capability: str
    model: str
    model_version: str

    def infer(self, request: InferenceRequest) -> InferenceResponse:
        ...


class InferencePipeline:
    def __init__(self, adapters: list[ModelAdapter] | None = None) -> None:
        self._adapters = adapters or []

    def capabilities(self) -> list[dict[str, object]]:
        available = {(item.capability, item.model, item.model_version) for item in self._adapters}
        return [
            {
                "capability": spec.capability,
                "model": spec.model,
                "model_version": spec.model_version,
                "priority": spec.priority,
                "purpose": spec.purpose,
                "available": (spec.capability, spec.model, spec.model_version) in available,
            }
            for spec in MODEL_CAPABILITIES
        ]

    def infer(self, request: InferenceRequest) -> InferenceResponse:
        requested = set(request.requested_capabilities)
        selected = [adapter for adapter in self._adapters if adapter.capability in requested]
        if not selected:
            return InferenceResponse(
                source_version_id=request.source_version_id,
                source_page=request.source_page,
                consensus_confidence=0,
                warnings=[
                    "No GPU/model adapter is installed for the requested capabilities. "
                    "B.O.S. must retain deterministic geometry and mark learned inference unavailable."
                ],
                model_runs=[
                    ModelRun(
                        capability=spec.capability,
                        model=spec.model,
                        model_version=spec.model_version,
                        status="unavailable",
                        latency_ms=0,
                        detail="adapter_not_installed",
                    )
                    for spec in MODEL_CAPABILITIES
                    if spec.capability in requested
                ],
            )

        # Adapter fusion is intentionally not guessed here. Concrete adapters must
        # emit geometry with evidence; the next layer will score agreement against
        # vector/dimension evidence before promotion into BosBuildingGraph.
        started = perf_counter()
        responses = [adapter.infer(request) for adapter in selected]
        elapsed_ms = int((perf_counter() - started) * 1000)
        best = max(responses, key=lambda item: item.consensus_confidence)
        best.warnings.append(
            f"Foundation pipeline selected the strongest adapter response across {len(responses)} run(s) in {elapsed_ms} ms; "
            "cross-model geometry fusion remains gated until the consensus scorer is enabled."
        )
        return best
