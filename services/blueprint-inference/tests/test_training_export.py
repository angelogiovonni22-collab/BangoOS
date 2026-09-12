from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "training"))

from export_raster2seq import export_dataset  # noqa: E402
from prepare_training_job import prepare_job  # noqa: E402
from synthetic_generator import generate_dataset  # noqa: E402


def test_export_is_integrity_checked_and_training_ready() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        dataset = root / "dataset"
        exported = root / "exported"
        generate_dataset(dataset, count=24, seed=731)
        receipt = export_dataset(dataset, exported)
        assert receipt["format"] == "coco-instance-polygons+raster2seq-polygon-sequence"
        assert receipt["contains_customer_data"] is False
        assert sum(receipt["counts"].values()) == 24
        train = json.loads((exported / "train.coco.json").read_text(encoding="utf-8"))
        assert train["images"]
        assert train["annotations"]
        assert all(annotation["polygon_sequence"] for annotation in train["annotations"])
        assert len(receipt["outputs_sha256"]["train"]) == 64
        job = prepare_job(exported, root / "training-job.json", "a6c4e27a68d11d7a459f6e4a2601fd887227dd1a")
        assert job["dataset_manifest_sha256"] == receipt["source_manifest_sha256"]
        assert job["paid_gpu_enabled"] is False
        assert job["epochs"] == 0
        assert job["held_out_benchmarks"] == ["mitchell-page-2"]


def test_export_refuses_tampered_source() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        dataset = root / "dataset"
        generate_dataset(dataset, count=1, seed=9)
        manifest = json.loads((dataset / "manifest.json").read_text(encoding="utf-8"))
        image = dataset / manifest["samples"][0]["image"]
        image.write_bytes(image.read_bytes() + b"tampered")
        with pytest.raises(ValueError, match="integrity check failed"):
            export_dataset(dataset, root / "exported")
