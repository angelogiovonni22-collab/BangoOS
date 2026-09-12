from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def prepare_job(export_root: Path, destination: Path, architecture_revision: str) -> dict[str, Any]:
    receipt_path = export_root / "export-receipt.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    if receipt.get("commercial_use_status") != "allowed":
        raise ValueError("dataset export is not approved for commercial use")
    if receipt.get("contains_customer_data") is not False:
        raise ValueError("dataset export contains uncleared customer data")
    if len(architecture_revision) < 7 or architecture_revision.startswith("PIN_"):
        raise ValueError("an exact architecture revision is required")
    job = {
        "schema_version": 1,
        "model": "raster2seq",
        "architecture_source": "https://github.com/Cornell-VAILab/Raster2Seq",
        "architecture_revision": architecture_revision,
        "dataset_manifest_sha256": receipt["source_manifest_sha256"],
        "dataset_export_receipt_sha256": hashlib.sha256(receipt_path.read_bytes()).hexdigest(),
        "dataset_outputs_sha256": receipt["outputs_sha256"],
        "image_size": 512,
        "seed": 20260912,
        "epochs": 0,
        "paid_gpu_enabled": False,
        "output_checkpoint": "bos-raster2seq-v1",
        "held_out_benchmarks": ["mitchell-a4-first-floor"],
    }
    destination.write_text(json.dumps(job, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return job


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a hash-pinned, GPU-disabled B.O.S. training job")
    parser.add_argument("--export", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--architecture-revision", required=True)
    args = parser.parse_args()
    prepare_job(args.export, args.output, args.architecture_revision)


if __name__ == "__main__":
    main()
