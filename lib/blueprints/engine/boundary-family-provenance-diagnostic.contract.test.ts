import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import { diagnoseBoundaryFamilyProvenance } from "./boundary-family-provenance-diagnostic";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

function wall(id: string, x: number, primitiveSuffix: string): BosWallSystemCandidate {
  const start = { x, y: 0 };
  const end = { x, y: 5 };
  return {
    id,
    sourcePage: 1,
    centerline: { start, end },
    thickness: 0.1524,
    length: 5,
    orientationRadians: Math.PI / 2,
    faceA: { id: `${id}-a`, primitiveId: `face-a-${primitiveSuffix}`, sourcePage: 1, line: { start, end }, confidence: 0.91 },
    faceB: { id: `${id}-b`, primitiveId: `face-b-${primitiveSuffix}`, sourcePage: 1, line: { start, end }, confidence: 0.9 },
    overlapRatio: 0.96,
    confidence: 0.9,
  };
}

const dimension: BosDimension = {
  id: "dimension-probe",
  levelId: "level-1",
  page: 1,
  start: { x: 1, y: -1 },
  end: { x: 5, y: -1 },
  value: 4,
  unit: "m",
  rawText: "13'-1 1/2\"",
  confidence: 0.9,
  evidence: [],
};
const association: BosRasterDimensionEvidenceAssociation = {
  dimensionId: dimension.id,
  sourceSegmentId: "dimension-source",
  sourceSegmentIds: ["dimension-source"],
  start: { ...dimension.start! },
  end: { ...dimension.end! },
  orientation: "horizontal",
  evidenceMode: "single_segment",
  relativeLengthError: 0,
  labelDistanceMeters: 0.1,
  startWitnessSupport: true,
  endWitnessSupport: true,
  confidence: 0.9,
};

const result = diagnoseBoundaryFamilyProvenance({
  wallSystems: [wall("left", 1.03, "left"), wall("right-a", 4.96, "right-a"), wall("right-b", 5.08, "right-b"), wall("far", 8, "far")],
  dimensions: [dimension],
  associations: [association],
  matchedDimensionIds: new Set(),
});
assert.equal(result.dimensions.length, 1);
assert.equal(result.dimensions[0].startCandidates.length, 1);
assert.equal(result.dimensions[0].startCandidates[0].wallId, "left");
assert.equal(result.dimensions[0].endCandidates.length, 2);
assert.deepEqual(result.dimensions[0].endCandidates.map((item) => item.wallId), ["right-a", "right-b"]);
assert.equal(result.ambiguousEndpointCount, 1);
assert.equal(result.emptyEndpointCount, 0);
assert.equal(result.dimensions[0].endCandidates[0].faceAPrimitiveId, "face-a-right-a");
assert(result.diagnostics.some((item) => item.includes("read-only")));

const empty = diagnoseBoundaryFamilyProvenance({
  wallSystems: [wall("far", 9, "far")],
  dimensions: [dimension],
  associations: [association],
  matchedDimensionIds: new Set(),
});
assert.equal(empty.emptyEndpointCount, 2);
console.log("Blueprint boundary family provenance diagnostic contract passed.");
