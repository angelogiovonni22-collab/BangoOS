from uuid import UUID

from bos_blueprint_inference.raster2seq_adapter import (
    Raster2SeqAdapter,
    Raster2SeqPolygon,
    Raster2SeqPrediction,
)
from bos_blueprint_inference.schemas import InferenceRequest


class StubBackend:
    def predict(self, image_url: str) -> Raster2SeqPrediction:
        assert image_url == "https://example.com/plan.png"
        return Raster2SeqPrediction(
            image_width_px=1000,
            image_height_px=500,
            model_size_px=512,
            checkpoint="raster2graph-512",
            polygons=[
                Raster2SeqPolygon(
                    points=[(0, 128), (512, 128), (512, 384), (0, 384)],
                    category_id=1,
                    confidence=0.9,
                )
            ],
        )


def request(**overrides):
    values = {
        "company_id": UUID("11111111-1111-1111-1111-111111111111"),
        "source_version_id": UUID("22222222-2222-2222-2222-222222222222"),
        "source_page": 2,
        "image_url": "https://example.com/plan.png",
        "drawing_units_per_meter": 100,
        "source_width_units": 1000,
        "source_height_units": 500,
        "requested_capabilities": ["room_polygons"],
    }
    values.update(overrides)
    return InferenceRequest(**values)


def test_inverse_letterbox_mapping_preserves_source_coordinate_frame():
    response = Raster2SeqAdapter(StubBackend()).infer(request())
    assert response.model_runs[0].status == "succeeded"
    assert response.consensus_confidence == 0.9
    assert len(response.rooms) == 1
    room = response.rooms[0]
    # 1000 drawing units / 100 units-per-meter = 10 m wide.
    # The 2:1 image is letterboxed vertically in a 512 square, so y=128..384 maps to 0..500 px.
    assert room.points[0] == (0.0, 0.0)
    assert room.points[1] == (10.0, 0.0)
    assert room.points[2] == (10.0, 5.0)
    assert room.points[3] == (0.0, 5.0)
    assert room.evidence[0].model == "raster2seq:raster2graph-512"


def test_adapter_refuses_untrusted_coordinate_frame_before_backend_call():
    class MustNotRun:
        def predict(self, image_url: str):
            raise AssertionError("backend must not run")

    response = Raster2SeqAdapter(MustNotRun()).infer(request(drawing_units_per_meter=None))
    assert response.rooms == []
    assert response.consensus_confidence == 0
    assert response.model_runs[0].status == "failed"
    assert response.model_runs[0].detail == "coordinate_frame_untrusted"
