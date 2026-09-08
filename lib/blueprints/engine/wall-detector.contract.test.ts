import assert from "node:assert/strict";
import type { BosRawSegment } from "./geometry";
import { suppressNestedWallDetections } from "./wall-detector";

const candidate = (y: number, thickness: number, id: string): BosRawSegment => ({
  sourcePage: 2,
  sourceObjectId: id,
  start: { x: 0, y },
  end: { x: 8, y },
  strokeWidth: thickness,
  confidence: 0.94,
});

const filtered = suppressNestedWallDetections([
  candidate(0.075, 0.15, "preferred-wall-pair"),
  candidate(0.165, 0.33, "nested-wide-pair"),
  candidate(0.24, 0.18, "nested-inner-pair"),
  candidate(1.0, 0.15, "separate-parallel-wall"),
]);

assert.equal(filtered.length, 2, "Nested parallel detections from one wall assembly must collapse without removing a genuinely separate wall");
assert(filtered.some((segment) => segment.sourceObjectId === "preferred-wall-pair"), "Duplicate suppression should prefer the plausible standard-thickness wall pair");
assert(filtered.some((segment) => segment.sourceObjectId === "separate-parallel-wall"), "A separate parallel wall outside the centerline tolerance must survive filtering");

console.log("B.O.S. nested wall detection regression: PASS");