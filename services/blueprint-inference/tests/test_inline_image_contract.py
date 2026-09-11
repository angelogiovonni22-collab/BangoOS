from uuid import UUID

import pytest
from pydantic import ValidationError

from bos_blueprint_inference.schemas import InferenceRequest


BASE = {
    "company_id": UUID("11111111-1111-1111-1111-111111111111"),
    "source_version_id": UUID("22222222-2222-2222-2222-222222222222"),
    "source_page": 2,
}


def test_png_data_uri_is_allowed_for_private_plan_handoff():
    request = InferenceRequest(**BASE, image_url="data:image/png;base64,iVBORw0KGgo=")
    assert request.image_url.startswith("data:image/png;base64,")


def test_https_remains_allowed():
    request = InferenceRequest(**BASE, image_url="https://example.com/plan.png")
    assert request.image_url == "https://example.com/plan.png"


def test_insecure_or_wrong_inline_source_is_rejected():
    with pytest.raises(ValidationError):
        InferenceRequest(**BASE, image_url="http://example.com/plan.png")
    with pytest.raises(ValidationError):
        InferenceRequest(**BASE, image_url="data:image/jpeg;base64,AAAA")
