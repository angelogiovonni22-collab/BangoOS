import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { associateRasterDimensionEvidence } from "./raster-dimension-evidence-associator";

const dimension: BosDimension = {
  id: "dimension-1",
  levelId: "level-1",
  page: 1,
  value: 8,
  unit: "m",
  rawText: "26'-3\"",
  confidence: 0.9,
  evidence: [{ id: "dimension-text-1", page: 1, kind: "pdf_text", bbox: { x: 460, y: 185, width: 80, height: 20 }, score: 0.9 }],
};
const unsupported: BosDimension = {
  ...dimension,
  id: "dimension-2",
  value: 5,
  rawText: "16'-5\"",
  evidence: [{ id: "dimension-text-2", page: 1, kind: "pdf_text", bbox: { x: 350, y: 785, width: 70, height: 20 }, score: 0.9 }],
};
const segments: BosRawSegment[] = [
  { sourcePage: 1, sourceObjectId: "actual-dimension-line", start: { x: 1, y: 2 }, end: { x: 9, y: 2 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "witness-left", start: { x: 1, y: 1.8 }, end: { x: 1, y: 4 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "witness-right", start: { x: 9, y: 1.8 }, end: { x: 9, y: 4 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "wall-like-line-without-witnesses", start: { x: 1, y: 5 }, end: { x: 9, y: 5 }, confidence: 0.95 },
  { sourcePage: 1, sourceObjectId: "unsupported-five-meter-line", start: { x: 1, y: 8 }, end: { x: 6, y: 8 }, confidence: 0.9 },
];

const result = associateRasterDimensionEvidence({ segments, dimensions: [dimension, unsupported], drawingUnitsPerMeter: 100 });
assert.equal(result.associations.length, 1, "only a uniquely supported dimension line with witnesses at both ends should resolve");
assert.equal(result.associations[0].dimensionId, "dimension-1");
assert.equal(result.associations[0].sourceSegmentId, "actual-dimension-line", "the source-supported dimension line must beat an equally long wall-like line without witness support");
assert.equal(result.dimensions[0].start?.x, 1);
assert.equal(result.dimensions[0].end?.x, 9);
assert(result.unresolvedDimensionIds.includes("dimension-2"), "text plus a same-length line without two-ended witness support must remain unresolved");
assert(result.diagnostics.some((item) => item.includes("does not move wall geometry")), "diagnostics must make the read-only evidence stage explicit");
console.log("Blueprint raster dimension evidence associator contract passed.");
