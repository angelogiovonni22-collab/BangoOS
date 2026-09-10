from uuid import uuid4

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
