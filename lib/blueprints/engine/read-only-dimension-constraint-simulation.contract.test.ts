import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";
import type { BosCrossEvidenceConstraintReadinessDiagnostic } from "./cross-evidence-constraint-readiness-diagnostic";
import { simulateReadOnlyDimensionConstraints } from "./read-only-dimension-constraint-simulation";

function wall(id: string, x: number): BosWallSystemCandidate {
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x, y: 0 }, end: { x, y: 3 } },
    thickness: 0.15,
    length: 3,
    orientationRadians: Math.PI / 2,
    confidence: 0.98,
    overlapRatio: 1,
    faceA: { id: `${id}-a`, primitiveId: `${id}-a`, sourcePage: 1, line: { start: { x: x - 0.075, y: 0 }, end: { x: x - 0.075, y: 3 } }, confidence: 0.98 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-b`, sourcePage: 1, line: { start: { x: x + 0.075, y: 0 }, end: { x: x + 0.075, y: 3 } }, confidence: 0.98 },
  };
}

const dimensions: BosDimension[] = [{
  id: "dimension-23-4",
  levelId: "level-1",
  page: 1,
  start: { x: 21.342, y: 0 },
  end: { x: 28.351, y: 0 },
  value: 7.112,
  unit: "m",
  rawText: "23'-4\"",
  confidence: 0.98,
  evidence: [],
}];

const readiness: BosCrossEvidenceConstraintReadinessDiagnostic[] = [{
  dimensionId: "dimension-23-4",
  rawText: "23'-4\"",
  candidateWallIds: ["wall-start", "wall-end"],
  startCandidateWalls: [{ wallId: "wall-start", centerCoordinate: 21.342, thicknessMeters: 0.15, lengthMeters: 3, facePrimitiveIds: ["wall-start-a", "wall-start-b"], sourcePixelSupport: 0.98 }],
  endCandidateWalls: [{ wallId: "wall-end", centerCoordinate: 28.351, thicknessMeters: 0.15, lengthMeters: 3, facePrimitiveIds: ["wall-end-a", "wall-end-b"], sourcePixelSupport: 0.98 }],
  minimumWallSourceSupport: 0.98,
  startBoundaryOffsetMeters: 0.012,
  endBoundaryOffsetMeters: 0.004,
  maximumBoundaryOffsetMeters: 0.012,
  independentRelativeSpanError: 0.0107,
  memberRelativeSpanError: null,
  candidateRelativeSpanError: 0.0145,
  boundaryComparisonBasis: "family_representative",
  ready: true,
  reason: "ready_for_read_only_constraint_simulation",
}];

const convergence: BosCrossEvidenceBoundaryConvergenceDiagnostic[] = [{
  dimensionId: "dimension-23-4",
  rawText: "23'-4\"",
  dominantStartCoordinate: null,
  dominantEndCoordinate: 28.35,
  dominantStartLengthMeters: null,
  dominantEndLengthMeters: 12.9,
  candidates: [{
    independentStartCoordinate: 21.33,
    independentEndCoordinate: 28.355,
    candidateStartCoordinate: 21.342,
    candidateEndCoordinate: 28.351,
    independentRelativeSpanError: 0.0122,
    candidateRelativeSpanError: 0.0145,
    candidateStartWallIds: ["wall-start"],
    candidateEndWallIds: ["wall-end"],
  }],
  recommendedStartCoordinate: 21.342,
  recommendedEndCoordinate: 28.351,
  reason: "unique_cross_evidence_boundary_pair",
}];

const walls = [wall("wall-start", 21.342), wall("wall-end", 28.351)];
const before = JSON.stringify(walls);
const result = simulateReadOnlyDimensionConstraints({ dimensions, readiness, convergence, wallSystems: walls });
assert.equal(result.simulatedConstraintCount, 1);
assert.equal(result.constraints.length, 1);
assert.equal(result.constraints[0].relation, "dimension");
assert.equal(result.constraints[0].dimensionId, "dimension-23-4");
assert.deepEqual(result.constraints[0].wallIds, ["wall-start", "wall-end"]);
assert.equal(result.dimensions[0].applied, false);
assert.equal(result.dimensions[0].reason, "simulated_dimension_constraint");
assert((result.dimensions[0].relativeSpanError ?? 1) <= 0.015);
assert.equal(JSON.stringify(walls), before, "read-only simulation must not mutate wall geometry");
assert(result.diagnostics.some((item) => item.includes("no constraints were applied")));

const notReady = simulateReadOnlyDimensionConstraints({
  dimensions,
  readiness: [{ ...readiness[0], ready: false, reason: "insufficient_source_pixel_support" }],
  convergence,
  wallSystems: walls,
});
assert.equal(notReady.simulatedConstraintCount, 0);
assert.equal(notReady.dimensions[0].reason, "not_ready");
assert.equal(notReady.constraints.length, 0);

const highResidual = simulateReadOnlyDimensionConstraints({
  dimensions,
  readiness,
  convergence: [{ ...convergence[0], recommendedEndCoordinate: 28.8 }],
  wallSystems: walls,
});
assert.equal(highResidual.simulatedConstraintCount, 0);
assert.equal(highResidual.dimensions[0].reason, "span_residual_too_high");

console.log("Blueprint read-only dimension constraint simulation contract passed.");
