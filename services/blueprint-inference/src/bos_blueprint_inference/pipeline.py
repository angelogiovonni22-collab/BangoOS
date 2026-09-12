from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Protocol

from .model_governance import governance_for, production_model_allowed
from .schemas import InferenceRequest, InferenceResponse, ModelRun


@dataclass(frozen=True)
class CapabilitySpec:
    capability: str
    model: str
    model_version: str
    priority: int
    purpose: str


# Research-backed candidates are registered here, but a model is never reported as
# Production-available until both a concrete adapter and an approved commercial
# license policy are present. Geometry remains evidence-backed and fail-closed.
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
    checkpoint_manifest: object

    def infer(self, request: InferenceRequest) -> InferenceResponse:
        ...


class InferencePipeline:
    def __init__(self, adapters: list[ModelAdapter] | None = None) -> None:
        self._adapters = adapters or []

    def capabilities(self) -> list[dict[str, object]]:
        installed = {(item.capability, item.model, item.model_version) for item in self._adapters}
        return [
            {
                "capability": spec.capability,
                "model": spec.model,
                "model_version": spec.model_version,
                "priority": spec.priority,
                "purpose": spec.purpose,
                "installed": (spec.capability, spec.model, spec.model_version) in installed,
                "available": any(
                    item.capability == spec.capability
                    and item.model == spec.model
                    and item.model_version == spec.model_version
                    and production_model_allowed(item.model, getattr(item, "checkpoint_manifest", None))
                    for item in self._adapters
                ),
                "license": governance_for(spec.model).license_name,
                "commercial_status": governance_for(spec.model).commercial_status,
                "governance_note": governance_for(spec.model).note,
            }
            for spec in MODEL_CAPABILITIES
        ]

    def infer(self, request: InferenceRequest) -> InferenceResponse:
        requested = set(request.requested_capabilities)
        selected = [
            adapter
            for adapter in self._adapters
            if adapter.capability in requested
            and production_model_allowed(adapter.model, getattr(adapter, "checkpoint_manifest", None))
        ]
        blocked_installed = [
            adapter
            for adapter in self._adapters
            if adapter.capability in requested
            and not production_model_allowed(adapter.model, getattr(adapter, "checkpoint_manifest", None))
        ]
        if not selected:
            warnings = [
                "No commercially-approved GPU/model adapter is installed for the requested capabilities. "
                "B.O.S. must retain deterministic geometry and mark learned inference unavailable."
            ]
            if blocked_installed:
                warnings.append(
                    "Installed adapters were blocked by B.O.S. model-governance policy: "
                    + ", ".join(sorted({item.model for item in blocked_installed}))
                )
            return InferenceResponse(
                source_version_id=request.source_version_id,
                source_page=request.source_page,
                consensus_confidence=0,
                warnings=warnings,
                model_runs=[
                    ModelRun(
                        capability=spec.capability,
                        model=spec.model,
                        model_version=spec.model_version,
                        status="unavailable",
                        latency_ms=0,
                        detail=(
                            "license_policy_blocked"
                            if any(item.model == spec.model for item in blocked_installed)
                            else "adapter_not_installed"
                        ),
                    )
                    for spec in MODEL_CAPABILITIES
                    if spec.capability in requested
                ],
            )

        started = perf_counter()
        responses = [adapter.infer(request) for adapter in selected]
        elapsed_ms = int((perf_counter() - started) * 1000)
        best = max(responses, key=lambda item: item.consensus_confidence)
        best.warnings.append(
            f"Foundation pipeline selected the strongest commercially-approved adapter response across {len(responses)} run(s) in {elapsed_ms} ms; "
            "B.O.S. must still pass TypeScript deterministic-consensus gating before any learned geometry can be promoted."
        )
        return best
