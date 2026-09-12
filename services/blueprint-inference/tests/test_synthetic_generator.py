from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "training"))

from synthetic_generator import DATASET_VERSION, generate_dataset  # noqa: E402


class SyntheticGeneratorTest(unittest.TestCase):
    def test_dataset_is_deterministic_and_self_describing(self) -> None:
        with tempfile.TemporaryDirectory() as left_dir, tempfile.TemporaryDirectory() as right_dir:
            left = Path(left_dir)
            right = Path(right_dir)
            first = generate_dataset(left, count=24, seed=731)
            second = generate_dataset(right, count=24, seed=731)
            self.assertEqual(first, second)
            self.assertEqual(first["dataset_version"], DATASET_VERSION)
            self.assertEqual({sample["split"] for sample in first["samples"]}, {"train", "validation", "test"})
            for sample in first["samples"]:
                image = left / sample["image"]
                geometry = left / sample["geometry"]
                self.assertEqual(image.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
                self.assertEqual(hashlib.sha256(image.read_bytes()).hexdigest(), sample["image_sha256"])
                self.assertEqual(hashlib.sha256(geometry.read_bytes()).hexdigest(), sample["geometry_sha256"])
                payload = json.loads(geometry.read_text(encoding="utf-8"))
                self.assertFalse(payload["provenance"]["contains_customer_data"])
                self.assertEqual(payload["provenance"]["license"], "B.O.S.-owned synthetic data")
                self.assertGreaterEqual(len(payload["rooms"]), 4)
                self.assertGreaterEqual(len(payload["walls"]), 8)
                self.assertGreaterEqual(
                    len([opening for opening in payload["openings"] if opening["type"] == "window"]),
                    2,
                )
                self.assertIn("scan_noise_probability", payload["render_style"])

    def test_refuses_to_overwrite_a_nonempty_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "keep.txt").write_text("preserve", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must be empty"):
                generate_dataset(root, count=1, seed=1)

    def test_dataset_contains_multiple_blueprint_render_styles(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = generate_dataset(root, count=80, seed=20260912)
            styles = []
            for sample in manifest["samples"]:
                geometry = json.loads((root / sample["geometry"]).read_text(encoding="utf-8"))
                styles.append(geometry["render_style"])
            self.assertGreaterEqual(len({style["ink"] for style in styles}), 10)
            self.assertEqual({style["footprint"] for style in styles}, {"rectangle", "attached_garage"})
            self.assertIn(True, {style["dimension_lines"] for style in styles})
            self.assertIn(False, {style["dimension_lines"] for style in styles})
            self.assertGreaterEqual(len({style["scan_noise_probability"] for style in styles}), 4)


if __name__ == "__main__":
    unittest.main()
