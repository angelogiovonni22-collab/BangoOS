from __future__ import annotations

import base64
import binascii
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image

MAX_IMAGE_BYTES = 30 * 1024 * 1024
PNG_DATA_URI_PREFIX = "data:image/png;base64,"


def _read_image(source: str, destination: Path) -> tuple[int, int]:
    if source.startswith(PNG_DATA_URI_PREFIX):
        encoded = source[len(PNG_DATA_URI_PREFIX) :]
        try:
            data = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Invalid Blueprint PNG data URI") from exc
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("Blueprint inference image exceeded 30 MB")
    elif source.startswith("https://"):
        request = urllib.request.Request(source, headers={"User-Agent": "BOS-Blueprint-Inference/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            content_type = (response.headers.get("content-type") or "").lower()
            if content_type and not content_type.startswith("image/"):
                raise ValueError(f"Expected image content, received {content_type}")
            data = response.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("Blueprint inference image exceeded 30 MB")
    else:
        raise ValueError("Raster2Seq image source must use HTTPS or a PNG data URI")

    destination.write_bytes(data)
    with Image.open(destination) as image:
        if image.format != "PNG":
            image.convert("RGB").save(destination, format="PNG")
        width, height = image.size
    if width <= 0 or height <= 0:
        raise ValueError("Invalid blueprint inference image dimensions")
    return width, height


def _prediction_json(output_dir: Path) -> Path:
    matches = sorted(output_dir.rglob("jsons/*.json"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly one Raster2Seq JSON result, found {len(matches)}")
    return matches[0]


def main() -> None:
    payload = json.loads(sys.stdin.read())
    image_url = str(payload["image_url"])
    repo_path = Path(os.environ.get("BOS_RASTER2SEQ_REPO_PATH", "/opt/Raster2Seq")).resolve()
    predict_path = repo_path / "predict.py"
    if not predict_path.is_file():
        raise RuntimeError(f"Raster2Seq predict.py not found at {predict_path}")

    checkpoint = os.environ.get("BOS_RASTER2SEQ_CHECKPOINT", "hf:raster2graph-512")
    model_size = int(os.environ.get("BOS_RASTER2SEQ_IMAGE_SIZE", "512"))
    if model_size not in (256, 512):
        raise ValueError("BOS_RASTER2SEQ_IMAGE_SIZE must be 256 or 512")

    with tempfile.TemporaryDirectory(prefix="bos-r2s-") as temp:
        root = Path(temp)
        input_dir = root / "input"
        output_dir = root / "output"
        input_dir.mkdir()
        output_dir.mkdir()
        image_path = input_dir / "sheet.png"
        width, height = _read_image(image_url, image_path)

        command = [
            sys.executable,
            str(predict_path),
            "--dataset_name=r2g",
            f"--dataset_root={input_dir}",
            f"--checkpoint={checkpoint}",
            f"--output_dir={output_dir}",
            "--semantic_classes=13",
            "--input_channels", "3",
            "--poly2seq",
            "--image_size", str(model_size),
            "--seq_len", "512",
            "--num_bins", "32",
            "--disable_poly_refine",
            "--dec_attn_concat_src",
            "--ema4eval",
            "--use_anchor",
            "--per_token_sem_loss",
            "--save_pred",
            "--batch_size", "1",
            "--device", "cuda",
        ]
        completed = subprocess.run(
            command,
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
        if completed.returncode != 0:
            detail = completed.stderr[-1500:] or completed.stdout[-1500:]
            raise RuntimeError(f"Raster2Seq prediction failed: {detail}")

        raw = json.loads(_prediction_json(output_dir).read_text(encoding="utf-8"))
        polygons = [
            {
                "points": item["segmentation"],
                "category_id": int(item.get("category_id", 0)),
                "confidence": 0.8,
            }
            for item in raw
            if isinstance(item, dict) and isinstance(item.get("segmentation"), list) and len(item["segmentation"]) >= 3
        ]
        print(json.dumps({
            "image_width_px": width,
            "image_height_px": height,
            "model_size_px": model_size,
            "checkpoint": checkpoint.removeprefix("hf:"),
            "polygons": polygons,
        }))


if __name__ == "__main__":
    main()
