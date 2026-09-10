from uuid import uuid4

from bos_blueprint_inference.model_governance import governance_for, production_model_allowed
from bos_blueprint_inference.pipeline import InferencePipeline, MODEL_CAPABILITIES
from bos_blueprint_inference.schemas import InferenceRequest


def test_foundation_fails_closed_without_model_adapters() -> None:
    pipeline = InferencePipeline()
    request = InferenceRequest(
        company_id=uuid4(),
        project_id=uuid4(),
        source_version_id=uuid4(),
        source_page=2,
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
    assert production_model_allowed("raster2seq") is True
    assert production_model_allowed("sam2.1") is True
    assert production_model_allowed("roomformer") is True
    assert production_model_allowed("cage") is False
    assert governance_for("cage").commercial_status == "blocked"
    assert production_model_allowed("mitunet") is False
    assert governance_for("made-up-model").commercial_status == "blocked"
