from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

CATEGORIES = {
    "unknown": 0,
    "living": 1,
    "living_room": 1,
    "kitchen": 2,
    "bedroom": 3,
    "bathroom": 4,
    "restroom": 5,
    "balcony": 6,
    "closet": 7,
    "hall": 8,
    "corridor": 8,
    "utility": 9,
    "washing_room": 9,
    "dining": 10,
    "office": 10,
    "stair": 10,
    "service": 10,
    "outside": 11,
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _polygon_pixels(points: list[list[float]], width: int, height: int) -> list[float]:
    return [coordinate for x, y in points for coordinate in (round(x * width, 3), round(y * height, 3))]


def _area(points: list[list[float]], width: int, height: int) -> float:
    pixels = [(x * width, y * height) for x, y in points]
    return abs(sum(
        pixels[index][0] * pixels[(index + 1) % len(pixels)][1]
        - pixels[(index + 1) % len(pixels)][0] * pixels[index][1]
        for index in range(len(pixels))
    )) / 2


def _bbox(points: list[list[float]], width: int, height: int) -> list[float]:
    xs = [point[0] * width for point in points]
    ys = [point[1] * height for point in points]
    return [min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)]


def export_dataset(dataset_root: Path, output_root: Path) -> dict[str, Any]:
    manifest_path = dataset_root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if output_root.exists() and any(output_root.iterdir()):
        raise ValueError("output directory must be empty")
    output_root.mkdir(parents=True, exist_ok=True)
    splits: dict[str, dict[str, list[dict[str, Any]]]] = {
        name: {"images": [], "annotations": []} for name in ("train", "validation", "test")
    }
    annotation_id = 1
    for image_id, sample in enumerate(manifest.get("samples", []), start=1):
        image_path = dataset_root / sample["image"]
        geometry_path = dataset_root / sample["geometry"]
        if sha256_file(image_path) != sample["image_sha256"] or sha256_file(geometry_path) != sample["geometry_sha256"]:
            raise ValueError(f"dataset integrity check failed for {sample['sample_id']}")
        geometry = json.loads(geometry_path.read_text(encoding="utf-8"))
        provenance = geometry.get("provenance", {})
        if provenance.get("contains_customer_data") is not False:
            raise ValueError(f"customer data is not cleared for {sample['sample_id']}")
        if provenance.get("license") != "B.O.S.-owned synthetic data":
            raise ValueError(f"training rights are not approved for {sample['sample_id']}")
        split = sample["split"]
        if split not in splits or geometry.get("split") != split:
            raise ValueError(f"invalid split for {sample['sample_id']}")
        width = int(geometry["canvas"]["width"])
        height = int(geometry["canvas"]["height"])
        splits[split]["images"].append({
            "id": image_id,
            "file_name": sample["image"],
            "width": width,
            "height": height,
            "sample_id": sample["sample_id"],
        })
        rooms = list(geometry.get("rooms", []))
        garage = geometry.get("attached_garage")
        if garage:
            rooms.append(garage)
        for room in rooms:
            points = room["polygon"]
            label = str(room.get("label", "unknown"))
            segmentation = _polygon_pixels(points, width, height)
            splits[split]["annotations"].append({
                "id": annotation_id,
                "image_id": image_id,
                "category_id": CATEGORIES.get(label, 0),
                "segmentation": [segmentation],
                "polygon_sequence": segmentation,
                "bbox": _bbox(points, width, height),
                "area": _area(points, width, height),
                "iscrowd": 0,
            })
            annotation_id += 1
    categories = [{"id": category_id, "name": name} for name, category_id in {
        "unknown": 0, "living_room": 1, "kitchen": 2, "bedroom": 3,
        "bathroom": 4, "restroom": 5, "balcony": 6, "closet": 7,
        "corridor": 8, "washing_room": 9, "service": 10, "outside": 11,
    }.items()]
    outputs: dict[str, str] = {}
    for split, payload in splits.items():
        destination = output_root / f"{split}.coco.json"
        destination.write_text(json.dumps({**payload, "categories": categories}, indent=2) + "\n", encoding="utf-8")
        outputs[split] = sha256_file(destination)
    receipt = {
        "schema_version": 1,
        "source_dataset_version": manifest["dataset_version"],
        "source_manifest_sha256": sha256_file(manifest_path),
        "format": "coco-instance-polygons+raster2seq-polygon-sequence",
        "counts": {split: len(payload["images"]) for split, payload in splits.items()},
        "outputs_sha256": outputs,
        "contains_customer_data": False,
        "commercial_use_status": "allowed",
    }
    (output_root / "export-receipt.json").write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and export a B.O.S. synthetic dataset for Raster2Seq training")
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    export_dataset(args.dataset, args.output)


if __name__ == "__main__":
    main()
