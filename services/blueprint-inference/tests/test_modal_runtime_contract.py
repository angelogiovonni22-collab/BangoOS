from pathlib import Path

ROOT = Path(__file__).parents[3]
SERVICE = ROOT / "services" / "blueprint-inference"


def test_modal_runtime_is_cost_bounded_and_pinned():
    modal_app = (SERVICE / "modal_app.py").read_text(encoding="utf-8")
    dockerfile = (SERVICE / "Dockerfile.modal").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "blueprint-modal-deploy.yml").read_text(encoding="utf-8")

    assert 'APP_NAME = "bos-blueprint-inference"' in modal_app
    assert 'GPU_TYPE = "A10G"' in modal_app
    assert "min_containers=0" in modal_app
    assert "max_containers=2" in modal_app
    assert "buffer_containers=0" in modal_app
    assert "scaledown_window=30" in modal_app
    assert 'modal.Secret.from_name(SECRET_NAME)' in modal_app

    assert "a6c4e27a68d11d7a459f6e4a2601fd887227dd1a" in dockerfile
    assert "torch==2.3.1" in dockerfile
    assert "torchvision==0.18.1" in dockerfile
    assert "https://download.pytorch.org/whl/cu118" in dockerfile
    assert "hf:raster2graph-512" in dockerfile
    assert "BOS_RASTER2SEQ_IMAGE_SIZE=512" in dockerfile

    assert "workflow_dispatch:" in workflow
    assert "MODAL_TOKEN_ID" in workflow
    assert "MODAL_TOKEN_SECRET" in workflow
    assert "modal deploy services/blueprint-inference/modal_app.py" in workflow
