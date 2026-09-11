from __future__ import annotations

import modal

APP_NAME = "bos-blueprint-inference"
SECRET_NAME = "bos-blueprint-inference"
GPU_TYPE = "A10G"

app = modal.App(APP_NAME)
image = modal.Image.from_dockerfile(
    "services/blueprint-inference/Dockerfile.modal",
    context_dir=".",
)


@app.function(
    image=image,
    gpu=GPU_TYPE,
    timeout=300,
    startup_timeout=600,
    min_containers=0,
    max_containers=2,
    buffer_containers=0,
    scaledown_window=30,
    secrets=[modal.Secret.from_name(SECRET_NAME)],
)
@modal.asgi_app()
def api():
    from bos_blueprint_inference.app import app as inference_app

    return inference_app
