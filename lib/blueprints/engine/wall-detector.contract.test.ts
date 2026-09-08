import assert from "node:assert/strict";
import type { BosRawSegment } from "./geometry";
import { suppressDimensionAnnotationDetections, suppressNestedWallDetections } from "./wall-detector";

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

const annotationFiltered = suppressDimensionAnnotationDetections([
  {
    sourcePage: 2,
    sourceObjectId: "dimension-glyph-pair",
    start: { x: 10.05, y: 3.05 },
    end: { x: 10.85, y: 3.05 },
    strokeWidth: 0.12,
    confidence: 0.9,
  },
  {
    sourcePage: 2,
    sourceObjectId: "thin-dimension-witness-pair",
    start: { x: 10.75, y: 3.1 },
    end: { x: 10.75, y: 4.15 },
    strokeWidth: 0.075,
    confidence: 0.9,
  },
  {
    sourcePage: 2,
    sourceObjectId: "normal-thickness-short-wall-near-label",
    start: { x: 10.7, y: 3.1 },
    end: { x: 10.7, y: 4.2 },
    strokeWidth: 0.15,
    confidence: 0.93,
  },
  {
    sourcePage: 2,
    sourceObjectId: "long-thin-wall-crossing-label-zone",
    start: { x: 10.5, y: 1 },
    end: { x: 10.5, y: 5 },
    strokeWidth: 0.075,
    confidence: 0.94,
  },
  {
    sourcePage: 2,
    sourceObjectId: "long-wall-crossing-label-zone",
    start: { x: 8, y: 3.1 },
    end: { x: 12, y: 3.1 },
    strokeWidth: 0.15,
    confidence: 0.95,
  },
  {
    sourcePage: 2,
    sourceObjectId: "short-wall-away-from-label",
    start: { x: 15, y: 6 },
    end: { x: 15.9, y: 6 },
    strokeWidth: 0.15,
    confidence: 0.92,
  },
  {
    sourcePage: 2,
    sourceObjectId: "thin-short-wall-away-from-label",
    start: { x: 15, y: 7 },
    end: { x: 15.9, y: 7 },
    strokeWidth: 0.075,
    confidence: 0.9,
  },
], [
  { x: 10, y: 3, width: 0.9, height: 0.2, padding: 0.2 },
]);

assert.equal(annotationFiltered.length, 5, "Dimension-label glyphs and thin witness-line pairs anchored to the evidence corridor must be suppressed without deleting protected wall geometry");
assert(!annotationFiltered.some((segment) => segment.sourceObjectId === "dimension-glyph-pair"), "Dimension-label linework must not survive as wall geometry");
assert(!annotationFiltered.some((segment) => segment.sourceObjectId === "thin-dimension-witness-pair"), "Thin witness-line pairs anchored to dimension evidence must not survive as wall geometry");
assert(annotationFiltered.some((segment) => segment.sourceObjectId === "normal-thickness-short-wall-near-label"), "Normal-thickness short wall geometry near a dimension label must survive filtering");
assert(annotationFiltered.some((segment) => segment.sourceObjectId === "long-thin-wall-crossing-label-zone"), "Long thin architectural geometry must not be removed solely because it crosses a dimension-label corridor");
assert(annotationFiltered.some((segment) => segment.sourceObjectId === "long-wall-crossing-label-zone"), "A real long wall crossing a dimension-label zone must survive filtering");
assert(annotationFiltered.some((segment) => segment.sourceObjectId === "short-wall-away-from-label"), "Short wall geometry outside annotation zones must survive filtering");
assert(annotationFiltered.some((segment) => segment.sourceObjectId === "thin-short-wall-away-from-label"), "Thin geometry away from annotation evidence must survive filtering");

console.log("B.O.S. wall detector nested/annotation filtering regression: PASS");
