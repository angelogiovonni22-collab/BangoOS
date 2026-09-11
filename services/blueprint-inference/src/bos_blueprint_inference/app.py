from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException

from .pipeline import InferencePipeline
from .raster2seq_adapter import raster2seq_adapter_from_env
from .schemas import InferenceRequest, InferenceResponse

app = FastAPI(title="B.O.S. Blueprint Inference", version="0.2.0")


def build_pipeline() -> InferencePipeline:
    adapters = []
    raster2seq = raster2seq_adapter_from_env()
    if raster2seq is not None:
        adapters.append(raster2seq)
    return InferencePipeline(adapters)


pipeline = build_pipeline()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "protocol": "bos-blueprint-inference-v1"}


@app.get("/v1/capabilities")
def capabilities() -> dict[str, object]:
    return {"protocol": "bos-blueprint-inference-v1", "models": pipeline.capabilities()}


@app.post("/v1/infer", response_model=InferenceResponse)
def infer(
    request: InferenceRequest,
    x_bos_inference_token: str | None = Header(default=None),
) -> InferenceResponse:
    # Authentication is intentionally fail-closed. The deployment injects the
    # expected token; callers never send Supabase service-role credentials here.
    import os

    expected = os.environ.get("BOS_BLUEPRINT_INFERENCE_TOKEN")
    if not expected or x_bos_inference_token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized inference request")
    return pipeline.infer(request)
