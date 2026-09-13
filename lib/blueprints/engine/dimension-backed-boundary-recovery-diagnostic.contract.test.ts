import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import { diagnoseDimensionBackedBoundaryRecovery } from "./dimension-backed-boundary-recovery-diagnostic";
import type { BosMissingBoundaryProbe } from "./missing-boundary-provenance-diagnostic";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

function wall(id: string, x: number, y0 = 0, y1 = 5): BosWallSystemCandidate {
  const start = { x, y: y0 };
  const end = { x, y: y1 };
  return {
    id,
    sourcePage: 1,
    centerline: { start, end },
    thickness: 0.1524,
    length: Math.abs(y1 - y0),
    orientationRadians: Math.PI / 2,
    faceA: { id: `${id}-a`, primitiveId: `${id}-pa`, sourcePage: 1, line: { start, end }, confidence: 0.94 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-pb`, sourcePage: 1, line: { start, end }, confidence: 0.94 },
    overlapRatio: 1,
    confidence: 0.94,
  };
}

const dimension: BosDimension = {
  id: "dim-recover",
  levelId: "level-1",
  page: 1,
  start: { x: 0, y: -1 },
  end: { x: 8.1, y: -1 },
  value: 8,
  unit: "m",
  rawText: "26'-3\"",
  confidence: 0.95,
  evidence: [],
};
const association: BosRasterDimensionEvidenceAssociation = {
  dimensionId: dimension.id,
  sourceSegmentId: "axis",
  sourceSegmentIds: ["axis"],
  start: { x: 0, y: -1 },
  end: { x: 8.1, y: -1 },
  orientation: "horizontal",
  evidenceMode: "single_segment",
  relativeLengthError: 0,
  labelDistanceMeters: 0.1,
  startWitnessSupport: true,
  endWitnessSupport: true,
  confidence: 0.95,
};
const selectedLeft = wall("selected-left", 0);
const rejectedRight = wall("rejected-right", 8.04, 0, 5);
const selectedConnector: BosWallSystemCandidate = {
  ...wall("connector-template", 0),
  id: "selected-connector",
  centerline: { start: { x: 0, y: 0 }, end: { x: 8.04, y: 0 } },
  length: 8.04,
  orientationRadians: 0,
  faceA: { id: "ca", primitiveId: "cpa", sourcePage: 1, line: { start: { x: 0, y: -0.08 }, end: { x: 8.04, y: -0.08 } }, confidence: 0.94 },
  faceB: { id: "cb", primitiveId: "cpb", sourcePage: 1, line: { start: { x: 0, y: 0.08 }, end: { x: 8.04, y: 0.08 } }, confidence: 0.94 },
};
const probe: BosMissingBoundaryProbe = {
  dimensionId: dimension.id,
  rawText: dimension.rawText || "",
  sourceAssociationMode: association.evidenceMode,
  axis: "horizontal",
  missingEndpoint: "end",
  endpointCoordinate: association.end.x,
  candidates: [{
    wallId: rejectedRight.id,
    coordinate: 8.04,
    endpointDistanceMeters: 0.06,
    thicknessMeters: rejectedRight.thickness,
    lengthMeters: rejectedRight.length,
    confidence: rejectedRight.confidence,
    overlapRatio: rejectedRight.overlapRatio,
    faceAPrimitiveId: rejectedRight.faceA.primitiveId,
    faceBPrimitiveId: rejectedRight.faceB.primitiveId,
    stage: "structural_rejected",
  }],
};

const result = diagnoseDimensionBackedBoundaryRecovery({
  dimensions: [dimension],
  associations: [association],
  missingBoundaryProbes: [probe],
  explicitSystems: [selectedLeft, selectedConnector, rejectedRight],
  selectedWallSystems: [selectedLeft, selectedConnector],
});
assert.equal(result.recommendedRecoveryCount, 1);
assert.equal(result.dimensions[0].reason, "unique_source_supported_recovery");
assert.equal(result.dimensions[0].recommendedWallId, rejectedRight.id);
assert(result.dimensions[0].candidates[0].relativeSpanError < 0.01);
assert(result.dimensions[0].candidates[0].connectedSelectedWallCount >= 1);

const disconnected = wall("disconnected-right", 8.04, 20, 25);
const disconnectedProbe: BosMissingBoundaryProbe = {
  ...probe,
  candidates: [{ ...probe.candidates[0], wallId: disconnected.id }],
};
const rejected = diagnoseDimensionBackedBoundaryRecovery({
  dimensions: [dimension],
  associations: [association],
  missingBoundaryProbes: [disconnectedProbe],
  explicitSystems: [selectedLeft, selectedConnector, disconnected],
  selectedWallSystems: [selectedLeft, selectedConnector],
});
assert.equal(rejected.recommendedRecoveryCount, 0);
assert.equal(rejected.dimensions[0].reason, "no_eligible_rejected_boundary");
assert(rejected.diagnostics.some((item) => item.includes("read-only")));

console.log("Blueprint dimension-backed boundary recovery diagnostic contract passed.");
