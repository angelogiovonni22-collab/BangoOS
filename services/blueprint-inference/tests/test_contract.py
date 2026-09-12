from uuid import uuid4

from bos_blueprint_inference.model_governance import (
    checkpoint_manifest_errors,
    governance_for,
    production_model_allowed,
)
from bos_blueprint_inference.pipeline import InferencePipeline, MODEL_CAPABILITIES
from bos_blueprint_inference.schemas import InferenceRequest


def test_foundation_fails_closed_without_model_adapters() -> None:
    pipeline = InferencePipeline()
    request = InferenceRequest(
        company_id=uuid4(),
        project_id=uuid4(),
        source_version_id=uuid4(),
        source_page=1,
        image_url="https://example.com/signed-plan.png",
    )
    result = pipeline.infer(request)
    assert result.protocol_version == "bos-blueprint-inference-v1"
    assert result.consensus_confidence == 0
    assert result.walls == []
    assert result.rooms == []
    assert result.openings == []
    assert result.model_runs
    assert all(item.status == "unavailable" for item in result.model_runs)


def test_research_model_registry_has_distinct_consensus_roles() -> None:
    models = {item.model for item in MODEL_CAPABILITIES}
    assert {"raster2seq", "sam2.1", "mitunet", "cage", "roomformer"}.issubset(models)


def test_commercial_model_governance_fails_closed() -> None:
    assert governance_for("raster2seq").license_name == "MIT"
    assert governance_for("sam2.1").license_name == "Apache-2.0"
    assert governance_for("roomformer").license_name == "MIT"
    assert production_model_allowed("raster2seq") is False
    assert production_model_allowed("sam2.1") is False
    assert production_model_allowed("roomformer") is False
    assert production_model_allowed("cage") is False
    assert governance_for("cage").commercial_status == "blocked"
    assert production_model_allowed("mitunet") is False
    assert governance_for("made-up-model").commercial_status == "blocked"


def approved_manifest() -> dict[str, object]:
    return {
        "schema_version": 1,
        "architecture": {
            "model": "raster2seq",
            "source_url": "https://github.com/Cornell-VAILab/Raster2Seq",
            "code_revision": "0123456789abcdef",
            "license": "MIT",
        },
        "checkpoint": {
            "id": "bos-raster2seq-v1",
            "version": "1.0.0",
            "sha256": "a" * 64,
        },
        "training_datasets": [{
            "id": "bos-synthetic-floorplans-v1",
            "manifest_sha256": "b" * 64,
            "license": "B.O.S.-owned synthetic data",
            "contains_customer_data": False,
            "commercial_use_status": "allowed",
        }],
        "commercial_approval": {
            "status": "approved",
            "approved_by": "Bango Construction LLC",
            "approved_at": "2026-09-12T00:00:00Z",
        },
        "held_out_benchmarks": ["mitchell-a4-first-floor"],
    }


def test_checkpoint_governance_requires_complete_approved_provenance() -> None:
    manifest = approved_manifest()
    assert checkpoint_manifest_errors("raster2seq", manifest) == []
    assert production_model_allowed("raster2seq", manifest) is True
    manifest["commercial_approval"] = {"status": "pending"}
    assert production_model_allowed("raster2seq", manifest) is False
    assert "commercial_approval_missing" in checkpoint_manifest_errors("raster2seq", manifest)


def test_mitchell_a4_cannot_enter_training_data() -> None:
    manifest = approved_manifest()
    manifest["training_datasets"][0]["id"] = "mitchell-a4-first-floor"  # type: ignore[index]
    assert "held_out_benchmark_in_training_data" in checkpoint_manifest_errors("raster2seq", manifest)
