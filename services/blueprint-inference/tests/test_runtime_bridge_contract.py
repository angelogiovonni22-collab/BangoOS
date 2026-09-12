from pathlib import Path


def test_runtime_bridge_pins_high_resolution_raster2graph_path():
    text = (Path(__file__).parents[1] / "runtime" / "raster2seq_bridge.py").read_text(encoding="utf-8")
    assert 'os.environ.get("BOS_RASTER2SEQ_CHECKPOINT", "")' in text
    assert 'os.environ.get("BOS_RASTER2SEQ_CHECKPOINT_MANIFEST", "")' in text
    assert "checkpoint SHA-256 does not match its approved manifest" in text
    assert "hashlib.sha256(checkpoint_path.read_bytes()).hexdigest()" in text
    assert '"--image_size", str(model_size)' in text
    assert '"--input_channels", "3"' in text
    assert '"--poly2seq"' in text
    assert '"--save_pred"' in text
    assert '"--device", "cuda"' in text
    assert 'source.startswith("https://")' in text
    assert 'PNG_DATA_URI_PREFIX = "data:image/png;base64,"' in text
    assert "base64.b64decode(encoded, validate=True)" in text
    assert "MAX_IMAGE_BYTES = 30 * 1024 * 1024" in text
