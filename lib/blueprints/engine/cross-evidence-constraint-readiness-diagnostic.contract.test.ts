import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";
import type { BosSourceFamilyMemberAgreementDiagnostic } from "./source-family-member-agreement-diagnostic";
import type { BosSourcePixelOverlayReport } from "./source-pixel-overlay";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { diagnoseCrossEvidenceConstraintReadiness } from "./cross-evidence-constraint-readiness-diagnostic";

function wall(id: string, x: number, thickness = 0.15): BosWallSystemCandidate {
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x, y: 0 }, end: { x, y: 3 } },
    thickness,
    length: 3,
    orientationRadians: Math.PI / 2,
    confidence: 0.95,
    overlapRatio: 1,
    faceA: {
      id: `${id}-face-a`,
      primitiveId: `${id}-a`,
      sourcePage: 1,
      confidence: 0.95,
      line: { start: { x: x - thickness / 2, y: 0 }, end: { x: x - thickness / 2, y: 3 } },
    },
    faceB: {
      id: `${id}-face-b`,
      primitiveId: `${id}-b`,
      sourcePage: 1,
      confidence: 0.95,
      line: { start: { x: x + thickness / 2, y: 0 }, end: { x: x + thickness / 2, y: 3 } },
    },
  };
}

const convergence: BosCrossEvidenceBoundaryConvergenceDiagnostic = {
  dimensionId: "dimension-ready",
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
    candidateEndWallIds: ["wall-end-a", "wall-end-b"],
  }],
  recommendedStartCoordinate: 21.342,
  recommendedEndCoordinate: 28.351,
  reason: "unique_cross_evidence_boundary_pair",
};

function overlay(entries: Array<{ wallSystemId: string; support: number }>): BosSourcePixelOverlayReport {
  return {
    predictedFaceSampleCount: 1,
    supportedFaceSampleCount: 1,
    predictedPrecision: 1,
    architecturalInkPixelCount: 1,
    coveredArchitecturalInkPixelCount: 1,
    architecturalRecall: 1,
    f1: 1,
    sourceWallFacePixelCount: 1,
    coveredSourceWallFacePixelCount: 1,
    sourceWallFaceRecall: 1,
    sourceWallFaceF1: 1,
    sourceWallFacePairCount: 1,
    sourceWallFaceCandidateRunCount: 1,
    sourceWallFaceRejectedSheetFrameRunCount: 0,
    excludedSheetFramePixelCount: 0,
    unsupportedWallSystemCount: 0,
    unsupportedWallSystemIds: [],
    perWallSupport: entries.map((entry) => ({ ...entry, samples: 20 })),
    diagnostics: [],
  };
}

const walls = [wall("wall-start", 21.342, 0.293), wall("wall-end-a", 28.35, 0.11), wall("wall-end-b", 28.352, 0.09)];
const fullSupport = overlay([
  { wallSystemId: "wall-start", support: 1 },
  { wallSystemId: "wall-end-a", support: 0.99 },
  { wallSystemId: "wall-end-b", support: 0.98 },
]);

const ready = diagnoseCrossEvidenceConstraintReadiness({
  convergence: [convergence],
  wallSystems: walls,
  sourcePixelOverlay: fullSupport,
});
assert.equal(ready.readyCount, 1);
assert.equal(ready.dimensions[0].reason, "ready_for_read_only_constraint_simulation");
assert.equal(ready.dimensions[0].minimumWallSourceSupport, 0.98);
assert(Math.abs((ready.dimensions[0].maximumBoundaryOffsetMeters || 0) - 0.012) < 1e-9);
assert.equal(ready.dimensions[0].boundaryComparisonBasis, "family_representative");
assert.equal(ready.dimensions[0].memberRelativeSpanError, null);
assert.equal(ready.dimensions[0].startCandidateWalls[0].centerCoordinate, 21.342);
assert.equal(ready.dimensions[0].startCandidateWalls[0].thicknessMeters, 0.293);
assert.deepEqual(ready.dimensions[0].startCandidateWalls[0].facePrimitiveIds, ["wall-start-a", "wall-start-b"]);
assert.equal(ready.dimensions[0].startCandidateWalls[0].sourcePixelSupport, 1);
assert.equal(ready.dimensions[0].endCandidateWalls.length, 2);
assert(ready.diagnostics.some((item) => item.includes("primitive IDs")));
assert(ready.diagnostics.some((item) => item.includes("2 cm")));
assert(ready.diagnostics.some((item) => item.includes("does not add constraints")));

const weakSupport = diagnoseCrossEvidenceConstraintReadiness({
  convergence: [convergence],
  wallSystems: walls,
  sourcePixelOverlay: overlay([
    { wallSystemId: "wall-start", support: 1 },
    { wallSystemId: "wall-end-a", support: 0.94 },
    { wallSystemId: "wall-end-b", support: 0.98 },
  ]),
});
assert.equal(weakSupport.readyCount, 0);
assert.equal(weakSupport.dimensions[0].reason, "insufficient_source_pixel_support");

const coordinateMismatchConvergence: BosCrossEvidenceBoundaryConvergenceDiagnostic = {
  ...convergence,
  candidates: [{
    ...convergence.candidates[0],
    independentStartCoordinate: 21.319,
    candidateStartCoordinate: 21.342,
  }],
};
const coordinateMismatch = diagnoseCrossEvidenceConstraintReadiness({
  convergence: [coordinateMismatchConvergence],
  wallSystems: walls,
  sourcePixelOverlay: fullSupport,
});
assert.equal(coordinateMismatch.readyCount, 0);
assert.equal(coordinateMismatch.dimensions[0].reason, "boundary_coordinate_mismatch");
assert((coordinateMismatch.dimensions[0].startBoundaryOffsetMeters || 0) > 0.02);
assert.equal(coordinateMismatch.dimensions[0].startCandidateWalls[0].thicknessMeters, 0.293);

const dimension: BosDimension = {
  id: "dimension-ready",
  levelId: "level-1",
  page: 1,
  start: { x: 0, y: 0 },
  end: { x: 7.112, y: 0 },
  value: 7.112,
  unit: "m",
  rawText: "23'-4\"",
  confidence: 1,
  evidence: [],
};
const memberAgreement: BosSourceFamilyMemberAgreementDiagnostic = {
  dimensionId: "dimension-ready",
  rawText: "23'-4\"",
  start: {
    endpoint: "start",
    familyRepresentativeCoordinate: 21.319,
    familyRepresentativePairId: "start-representative",
    candidateWallIds: ["wall-start"],
    eligibleMatches: [{
      wallId: "wall-start",
      pairIds: ["start-member"],
      candidateCoordinate: 21.342,
      sourceCoordinate: 21.336,
      coordinateErrorMeters: 0.006,
      candidateThicknessMeters: 0.293,
      sourceSeparationMeters: 0.305,
      thicknessErrorMeters: 0.012,
    }],
    recommendedMatch: {
      wallId: "wall-start",
      pairIds: ["start-member"],
      candidateCoordinate: 21.342,
      sourceCoordinate: 21.336,
      coordinateErrorMeters: 0.006,
      candidateThicknessMeters: 0.293,
      sourceSeparationMeters: 0.305,
      thicknessErrorMeters: 0.012,
    },
    reason: "unique_member_agreement",
  },
  end: {
    endpoint: "end",
    familyRepresentativeCoordinate: 28.355,
    familyRepresentativePairId: "end-member",
    candidateWallIds: ["wall-end-a", "wall-end-b"],
    eligibleMatches: [{
      wallId: "wall-end-b",
      pairIds: ["end-member-a", "end-member-b"],
      candidateCoordinate: 28.352,
      sourceCoordinate: 28.355,
      coordinateErrorMeters: 0.003,
      candidateThicknessMeters: 0.09,
      sourceSeparationMeters: 0.085,
      thicknessErrorMeters: 0.005,
    }],
    recommendedMatch: {
      wallId: "wall-end-b",
      pairIds: ["end-member-a", "end-member-b"],
      candidateCoordinate: 28.352,
      sourceCoordinate: 28.355,
      coordinateErrorMeters: 0.003,
      candidateThicknessMeters: 0.09,
      sourceSeparationMeters: 0.085,
      thicknessErrorMeters: 0.005,
    },
    reason: "unique_member_agreement",
  },
  ready: true,
  reason: "unique_both_endpoints",
};
const memberResolved = diagnoseCrossEvidenceConstraintReadiness({
  convergence: [coordinateMismatchConvergence],
  wallSystems: walls,
  sourcePixelOverlay: fullSupport,
  sourceFamilyMemberAgreement: [memberAgreement],
  dimensions: [dimension],
});
assert.equal(memberResolved.readyCount, 1, "a unique source-family member match inside all hard targets should resolve representative-only mismatch");
assert.equal(memberResolved.dimensions[0].reason, "ready_for_read_only_constraint_simulation");
assert.equal(memberResolved.dimensions[0].boundaryComparisonBasis, "verified_family_member");
assert.equal(memberResolved.dimensions[0].startBoundaryOffsetMeters, 0.006);
assert((memberResolved.dimensions[0].memberRelativeSpanError || 1) < 0.015);

const notConverged = diagnoseCrossEvidenceConstraintReadiness({
  convergence: [{ ...convergence, reason: "ambiguous_cross_evidence_pair", recommendedStartCoordinate: null, recommendedEndCoordinate: null }],
  wallSystems: walls,
  sourcePixelOverlay: overlay(walls.map((item) => ({ wallSystemId: item.id, support: 1 }))),
});
assert.equal(notConverged.dimensions[0].reason, "not_uniquely_converged");
assert.deepEqual(notConverged.dimensions[0].startCandidateWalls, []);

console.log("Blueprint cross-evidence constraint readiness diagnostic contract passed.");
