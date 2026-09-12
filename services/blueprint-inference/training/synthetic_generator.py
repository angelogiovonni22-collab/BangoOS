from __future__ import annotations

import argparse
import hashlib
import json
import random
import struct
import zlib
from dataclasses import dataclass
from pathlib import Path

CANVAS_SIZE = 512
DATASET_VERSION = "bos-synthetic-floorplans-v2"


@dataclass(frozen=True)
class Rect:
    x: int
    y: int
    width: int
    height: int
    label: str

    @property
    def right(self) -> int:
        return self.x + self.width

    @property
    def bottom(self) -> int:
        return self.y + self.height


def _png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def _write_grayscale_png(path: Path, pixels: bytearray) -> None:
    rows = b"".join(b"\x00" + bytes(pixels[y * CANVAS_SIZE:(y + 1) * CANVAS_SIZE]) for y in range(CANVAS_SIZE))
    header = struct.pack(">IIBBBBB", CANVAS_SIZE, CANVAS_SIZE, 8, 0, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", header) + _png_chunk(b"IDAT", zlib.compress(rows, 9)) + _png_chunk(b"IEND", b""))


def _paint(pixels: bytearray, x: int, y: int, value: int = 20, radius: int = 2) -> None:
    for py in range(max(0, y - radius), min(CANVAS_SIZE, y + radius + 1)):
        for px in range(max(0, x - radius), min(CANVAS_SIZE, x + radius + 1)):
            pixels[py * CANVAS_SIZE + px] = value


def _line(pixels: bytearray, start: tuple[int, int], end: tuple[int, int], value: int = 20, radius: int = 2) -> None:
    x1, y1 = start
    x2, y2 = end
    steps = max(abs(x2 - x1), abs(y2 - y1), 1)
    for step in range(steps + 1):
        ratio = step / steps
        _paint(pixels, round(x1 + (x2 - x1) * ratio), round(y1 + (y2 - y1) * ratio), value, radius)


def _dimension_line(pixels: bytearray, start: tuple[int, int], end: tuple[int, int], value: int) -> None:
    _line(pixels, start, end, value=value, radius=0)
    if start[1] == end[1]:
        for x in (start[0], end[0]):
            _line(pixels, (x, start[1] - 4), (x, start[1] + 4), value=value, radius=0)
    else:
        for y in (start[1], end[1]):
            _line(pixels, (start[0] - 4, y), (start[0] + 4, y), value=value, radius=0)


def _add_scan_artifacts(pixels: bytearray, rng: random.Random, probability: float) -> None:
    for index, value in enumerate(pixels):
        if rng.random() < probability:
            drift = rng.randint(-22, 22)
            pixels[index] = max(0, min(255, value + drift))


def _split(value: int) -> str:
    bucket = int(hashlib.sha256(f"{DATASET_VERSION}:{value}".encode()).hexdigest()[:8], 16) % 100
    return "train" if bucket < 80 else "validation" if bucket < 90 else "test"


def _normalized_polygon(room: Rect) -> list[list[float]]:
    return [[round(x / CANVAS_SIZE, 6), round(y / CANVAS_SIZE, 6)] for x, y in [
        (room.x, room.y), (room.right, room.y), (room.right, room.bottom), (room.x, room.bottom)
    ]]


def _make_rooms(rng: random.Random) -> tuple[list[Rect], Rect, Rect | None]:
    x, y = rng.randint(44, 70), rng.randint(44, 70)
    width, height = rng.randint(285, 345), rng.randint(300, 360)
    columns, rows = rng.choice([2, 3]), rng.choice([2, 3])
    x_edges = [x] + sorted(rng.sample(range(x + 85, x + width - 70), columns - 1)) + [x + width]
    y_edges = [y] + sorted(rng.sample(range(y + 85, y + height - 70), rows - 1)) + [y + height]
    labels = ["living", "kitchen", "bedroom", "bathroom", "dining", "office", "hall", "utility", "stair"]
    rng.shuffle(labels)
    rooms: list[Rect] = []
    for row in range(rows):
        for column in range(columns):
            rooms.append(Rect(x_edges[column], y_edges[row], x_edges[column + 1] - x_edges[column], y_edges[row + 1] - y_edges[row], labels[len(rooms) % len(labels)]))
    footprint = Rect(x, y, width, height, "main")
    garage = None
    if rng.random() < 0.72:
        garage_width = min(rng.randint(90, 125), CANVAS_SIZE - footprint.right - 18)
        garage_height = rng.randint(135, min(220, footprint.height - 25))
        if garage_width >= 70:
            garage = Rect(footprint.right, footprint.bottom - garage_height, garage_width, garage_height, "garage")
    return rooms, footprint, garage


def generate_sample(output_root: Path, sample_index: int, seed: int) -> dict[str, object]:
    rng = random.Random((seed << 32) ^ sample_index)
    rooms, footprint, garage = _make_rooms(rng)
    split = _split(sample_index)
    sample_id = f"bos-synth-{sample_index:08d}"
    directory = output_root / split / sample_id
    directory.mkdir(parents=True, exist_ok=False)

    background = rng.randint(238, 255)
    ink = rng.randint(5, 42)
    exterior_radius = rng.choice([2, 3, 3, 4])
    interior_radius = rng.choice([1, 2, 2, 3])
    scan_noise = rng.choice([0.0, 0.001, 0.003, 0.007, 0.012])
    pixels = bytearray([background]) * (CANVAS_SIZE * CANVAS_SIZE)
    wall_segments: set[tuple[int, int, int, int]] = set()
    for room in rooms + ([garage] if garage else []):
        assert room is not None
        for x1, y1, x2, y2 in [
            (room.x, room.y, room.right, room.y),
            (room.right, room.y, room.right, room.bottom),
            (room.right, room.bottom, room.x, room.bottom),
            (room.x, room.bottom, room.x, room.y),
        ]:
            canonical = (x1, y1, x2, y2) if (x1, y1) <= (x2, y2) else (x2, y2, x1, y1)
            wall_segments.add(canonical)
    for x1, y1, x2, y2 in wall_segments:
        exterior = x1 in (footprint.x, footprint.right) or y1 in (footprint.y, footprint.bottom)
        _line(pixels, (x1, y1), (x2, y2), value=ink, radius=exterior_radius if exterior else interior_radius)

    openings: list[dict[str, object]] = []
    for index, room in enumerate(rooms[: max(2, len(rooms) // 2)]):
        width = min(24, max(14, room.width // 5))
        x1 = room.x + room.width // 2 - width // 2
        y1 = room.bottom
        _line(pixels, (x1, y1), (x1 + width, y1), value=background, radius=exterior_radius + 1)
        openings.append({"id": f"opening-{index + 1}", "type": "door", "segment": [[x1 / CANVAS_SIZE, y1 / CANVAS_SIZE], [(x1 + width) / CANVAS_SIZE, y1 / CANVAS_SIZE]]})

    window_count = rng.randint(2, 6)
    for index in range(window_count):
        horizontal = rng.random() < 0.65
        if horizontal:
            y1 = footprint.y if rng.random() < 0.5 else footprint.bottom
            width = rng.randint(18, 38)
            x1 = rng.randint(footprint.x + 18, footprint.right - width - 18)
            start, end = (x1, y1), (x1 + width, y1)
            _line(pixels, start, end, value=background, radius=exterior_radius + 1)
            _line(pixels, start, end, value=min(120, ink + 55), radius=0)
        else:
            x1 = footprint.x if rng.random() < 0.5 else footprint.right
            height = rng.randint(18, 38)
            y1 = rng.randint(footprint.y + 18, footprint.bottom - height - 18)
            start, end = (x1, y1), (x1, y1 + height)
            _line(pixels, start, end, value=background, radius=exterior_radius + 1)
            _line(pixels, start, end, value=min(120, ink + 55), radius=0)
        openings.append({
            "id": f"opening-{len(openings) + 1}",
            "type": "window",
            "segment": [[start[0] / CANVAS_SIZE, start[1] / CANVAS_SIZE], [end[0] / CANVAS_SIZE, end[1] / CANVAS_SIZE]],
        })

    dimensions = rng.random() < 0.78
    if dimensions:
        _dimension_line(pixels, (footprint.x, footprint.y - 18), (footprint.right, footprint.y - 18), min(155, ink + 85))
        _dimension_line(pixels, (footprint.x - 18, footprint.y), (footprint.x - 18, footprint.bottom), min(155, ink + 85))
    _add_scan_artifacts(pixels, rng, scan_noise)

    image_path = directory / "plan.png"
    _write_grayscale_png(image_path, pixels)
    geometry = {
        "schema_version": 1,
        "dataset_version": DATASET_VERSION,
        "sample_id": sample_id,
        "split": split,
        "canvas": {"width": CANVAS_SIZE, "height": CANVAS_SIZE},
        "rooms": [{"id": f"room-{index + 1}", "label": room.label, "polygon": _normalized_polygon(room)} for index, room in enumerate(rooms)],
        "attached_garage": None if garage is None else {"label": garage.label, "polygon": _normalized_polygon(garage)},
        "openings": openings,
        "walls": [{"start": [x1 / CANVAS_SIZE, y1 / CANVAS_SIZE], "end": [x2 / CANVAS_SIZE, y2 / CANVAS_SIZE]} for x1, y1, x2, y2 in sorted(wall_segments)],
        "render_style": {
            "background": background,
            "ink": ink,
            "exterior_wall_radius": exterior_radius,
            "interior_wall_radius": interior_radius,
            "scan_noise_probability": scan_noise,
            "dimension_lines": dimensions,
            "footprint": "attached_garage" if garage else "rectangle",
        },
        "provenance": {"generator": DATASET_VERSION, "seed": seed, "sample_index": sample_index, "license": "B.O.S.-owned synthetic data", "contains_customer_data": False},
    }
    geometry_path = directory / "geometry.json"
    geometry_path.write_text(json.dumps(geometry, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {
        "sample_id": sample_id,
        "split": split,
        "image": str(image_path.relative_to(output_root)),
        "geometry": str(geometry_path.relative_to(output_root)),
        "image_sha256": hashlib.sha256(image_path.read_bytes()).hexdigest(),
        "geometry_sha256": hashlib.sha256(geometry_path.read_bytes()).hexdigest(),
    }


def generate_dataset(output_root: Path, count: int, seed: int) -> dict[str, object]:
    if count < 1:
        raise ValueError("count must be positive")
    if output_root.exists() and any(output_root.iterdir()):
        raise ValueError("output directory must be empty")
    output_root.mkdir(parents=True, exist_ok=True)
    samples = [generate_sample(output_root, index, seed) for index in range(count)]
    manifest = {"dataset_version": DATASET_VERSION, "seed": seed, "count": count, "samples": samples}
    (output_root / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate B.O.S.-owned synthetic floor-plan training pairs")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--count", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=20260912)
    arguments = parser.parse_args()
    generate_dataset(arguments.output, arguments.count, arguments.seed)


if __name__ == "__main__":
    main()
