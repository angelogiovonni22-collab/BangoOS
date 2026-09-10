from pathlib import Path


def test_runtime_bridge_pins_high_resolution_raster2graph_path():
    text = (Path(__file__).parents[1] / "runtime" / "raster2seq_bridge.py").read_text(encoding="utf-8")
    assert '"hf:raster2graph-512"' in text
    assert '"--image_size", str(model_size)' in text
    assert '"--input_channels", "3"' in text
    assert '"--poly2seq"' in text
    assert '"--save_pred"' in text
    assert '"--device", "cuda"' in text
    assert 'url.startswith("https://")' in text
    assert "30 * 1024 * 1024" in text
