import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { associateRasterDimensionEvidence } from "./raster-dimension-evidence-associator";

function dimension(id: string, value: number, bbox: { x: number; y: number; width: number; height: number }): BosDimension {
  return {
    id,
    levelId: "level-1",
    page: 1,
    value,
    unit: "m",
    rawText: `${value.toFixed(2)} m`,
    confidence: 0.9,
    evidence: [{ id: `${id}-text`, page: 1, kind: "pdf_text", bbox, score: 0.9 }],
  };
}

const singleDimension = dimension("dimension-single", 8, { x: 460, y: 185, width: 80, height: 20 });
const splitDimension = dimension("dimension-split", 8, { x: 460, y: 385, width: 80, height: 20 });
const unrelatedGapDimension = dimension("dimension-unrelated-gap", 8, { x: 700, y: 585, width: 80, height: 20 });
const missingWitnessDimension = dimension("dimension-missing-witness", 8, { x: 460, y: 785, width: 80, height: 20 });
const fragmentDimension = dimension("dimension-fragment", 8, { x: 460, y: 985, width: 80, height: 20 });

const segments: BosRawSegment[] = [
  { sourcePage: 1, sourceObjectId: "single-line", start: { x: 1, y: 2 }, end: { x: 9, y: 2 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "single-witness-left", start: { x: 1, y: 1.8 }, end: { x: 1, y: 2.8 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "single-witness-right", start: { x: 9, y: 1.8 }, end: { x: 9, y: 2.8 }, confidence: 0.9 },

  { sourcePage: 1, sourceObjectId: "split-left", start: { x: 1, y: 4 }, end: { x: 4.55, y: 4 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "split-right", start: { x: 5.45, y: 4 }, end: { x: 9, y: 4 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "split-witness-left", start: { x: 1, y: 3.8 }, end: { x: 1, y: 4.8 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "split-witness-right", start: { x: 9, y: 3.8 }, end: { x: 9, y: 4.8 }, confidence: 0.9 },

  { sourcePage: 1, sourceObjectId: "unrelated-left", start: { x: 1, y: 6 }, end: { x: 4, y: 6 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "unrelated-right", start: { x: 6, y: 6 }, end: { x: 9, y: 6 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "unrelated-witness-left", start: { x: 1, y: 5.8 }, end: { x: 1, y: 6.8 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "unrelated-witness-right", start: { x: 9, y: 5.8 }, end: { x: 9, y: 6.8 }, confidence: 0.9 },

  { sourcePage: 1, sourceObjectId: "missing-witness-left", start: { x: 1, y: 8 }, end: { x: 4.55, y: 8 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "missing-witness-right", start: { x: 5.45, y: 8 }, end: { x: 9, y: 8 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "missing-witness-only-left", start: { x: 1, y: 7.8 }, end: { x: 1, y: 8.8 }, confidence: 0.9 },

  { sourcePage: 1, sourceObjectId: "fragment-a", start: { x: 1, y: 10 }, end: { x: 3.8, y: 10 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "fragment-b", start: { x: 3.92, y: 10 }, end: { x: 4.55, y: 10 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "fragment-c", start: { x: 5.45, y: 10 }, end: { x: 7, y: 10 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "fragment-d", start: { x: 7.12, y: 10 }, end: { x: 9, y: 10 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "fragment-witness-left", start: { x: 1, y: 9.8 }, end: { x: 1, y: 10.8 }, confidence: 0.9 },
  { sourcePage: 1, sourceObjectId: "fragment-witness-right", start: { x: 9, y: 9.8 }, end: { x: 9, y: 10.8 }, confidence: 0.9 },
];

const result = associateRasterDimensionEvidence({
  segments,
  dimensions: [singleDimension, splitDimension, unrelatedGapDimension, missingWitnessDimension, fragmentDimension],
  drawingUnitsPerMeter: 100,
});

const single = result.associations.find((item) => item.dimensionId === "dimension-single");
assert(single, "an intact source dimension line with witnesses at both ends should resolve");
assert.equal(single.evidenceMode, "single_segment");
assert.deepEqual(single.sourceSegmentIds, ["single-line"]);

const split = result.associations.find((item) => item.dimensionId === "dimension-split");
assert(split, "a dimension rule split only by its printed label should resolve as one source-supported chain");
assert.equal(split.evidenceMode, "label_gap_chain");
assert.deepEqual(new Set(split.sourceSegmentIds), new Set(["split-left", "split-right"]));

const fragmented = result.associations.find((item) => item.dimensionId === "dimension-fragment");
assert(fragmented, "a rule broken by tiny raster gaps plus one printed-label gap should resolve when the whole chain is source supported");
assert.equal(fragmented.evidenceMode, "fragment_chain");
assert.deepEqual(fragmented.sourceSegmentIds, ["fragment-a", "fragment-b", "fragment-c", "fragment-d"]);
assert.equal(fragmented.start.x, 1);
assert.equal(fragmented.end.x, 9);

assert(result.unresolvedDimensionIds.includes("dimension-unrelated-gap"), "collinear fragments must not bridge when the printed label does not occupy the larger gap");
assert(result.unresolvedDimensionIds.includes("dimension-missing-witness"), "a chain missing an outer witness must remain unresolved");
assert.equal(result.singleSegmentAssociationCount, 1);
assert.equal(result.labelGapChainAssociationCount, 1);
assert.equal(result.fragmentChainAssociationCount, 1);
assert(result.diagnostics.some((item) => item.includes("Arbitrary geometric gaps are never bridged")), "diagnostics must make fail-closed chain behavior explicit");
assert(result.diagnostics.some((item) => item.includes("do not move wall geometry")), "diagnostics must make the read-only evidence stage explicit");
console.log("Blueprint raster dimension evidence associator contract passed.");
