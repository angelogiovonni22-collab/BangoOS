import assert from "node:assert/strict";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import type { BosIndependentDimensionBoundaryDiagnostic } from "./source-network-dimension-endpoint-diagnostic";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";
import { diagnoseSourceFamilyMemberAgreement } from "./source-family-member-agreement-diagnostic";

function wall(id: string, x: number, thickness: number): BosWallSystemCandidate {
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x, y: 0 }, end: { x, y: 3 } },
    thickness,
    length: 3,
    orientationRadians: Math.PI / 2,
    confidence: 0.98,
    overlapRatio: 1,
    faceA: { id: `${id}-a`, primitiveId: `${id}-a`, sourcePage: 1, line: { start: { x: x - thickness / 2, y: 0 }, end: { x: x - thickness / 2, y: 3 } }, confidence: 0.98 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-b`, sourcePage: 1, line: { start: { x: x + thickness / 2, y: 0 }, end: { x: x + thickness / 2, y: 3 } }, confidence: 0.98 },
  };
}

const convergence: BosCrossEvidenceBoundaryConvergenceDiagnostic = {
  dimensionId: "dimension-23-4",
  rawText: "23'-4\"",
  dominantStartCoordinate: null,
  dominantEndCoordinate: 28.35,
  dominantStartLengthMeters: null,
  dominantEndLengthMeters: 12.9,
  candidates: [{ independentStartCoordinate: 21.319, independentEndCoordinate: 28.355, candidateStartCoordinate: 21.342, candidateEndCoordinate: 28.356, independentRelativeSpanError: 0.0107, candidateRelativeSpanError: 0.014, candidateStartWallIds: ["start-wall"], candidateEndWallIds: ["end-wall"] }],
  recommendedStartCoordinate: 21.342,
  recommendedEndCoordinate: 28.356,
  reason: "unique_cross_evidence_boundary_pair",
};

const independent: BosIndependentDimensionBoundaryDiagnostic = {
  dimensionId: "dimension-23-4",
  rawText: "23'-4\"",
  axis: "horizontal",
  startCoordinate: 21.159,
  endCoordinate: 28.292,
  startFamilies: [{
    coordinate: 21.319,
    nearestEndpointDistanceMeters: 0.16,
    pairIds: ["start-representative", "start-match", "start-wrong-thickness"],
    representativePairId: "start-representative",
    members: [
      { pairId: "start-representative", coordinate: 21.319, separationMeters: 0.135, endpointDistanceMeters: 0.16 },
      { pairId: "start-match", coordinate: 21.336, separationMeters: 0.305, endpointDistanceMeters: 0.177 },
      { pairId: "start-wrong-thickness", coordinate: 21.361, separationMeters: 0.34, endpointDistanceMeters: 0.202 },
    ],
  }],
  endFamilies: [{
    coordinate: 28.355,
    nearestEndpointDistanceMeters: 0.063,
    pairIds: ["end-match-a", "end-match-b"],
    representativePairId: "end-match-a",
    members: [
      { pairId: "end-match-a", coordinate: 28.355, separationMeters: 0.09, endpointDistanceMeters: 0.063 },
      { pairId: "end-match-b", coordinate: 28.355, separationMeters: 0.09, endpointDistanceMeters: 0.063 },
    ],
  }],
  passingPairs: [],
  recommendedStartCoordinate: null,
  recommendedEndCoordinate: null,
  reason: "ambiguous_independent_boundary_pair",
};

const result = diagnoseSourceFamilyMemberAgreement({ convergence: [convergence], independentDiagnostics: [independent], wallSystems: [wall("start-wall", 21.342, 0.293), wall("end-wall", 28.356, 0.091)] });
assert.equal(result.readyCount, 1);
assert.equal(result.dimensions[0].reason, "unique_both_endpoints");
assert.equal(result.dimensions[0].start.reason, "unique_member_agreement");
assert.deepEqual(result.dimensions[0].start.recommendedMatch?.pairIds, ["start-match"]);
assert((result.dimensions[0].start.recommendedMatch?.coordinateErrorMeters || 1) < 0.01);
assert((result.dimensions[0].start.recommendedMatch?.thicknessErrorMeters || 1) < 0.02);
assert.deepEqual(result.dimensions[0].end.recommendedMatch?.pairIds, ["end-match-a", "end-match-b"], "identical fixed source geometry should collapse without false ambiguity");
assert(result.diagnostics.some((item) => item.includes("1 mm")));
assert(result.diagnostics.some((item) => item.includes("remain unchanged")));

const ambiguousIndependent: BosIndependentDimensionBoundaryDiagnostic = {
  ...independent,
  startFamilies: [{
    ...independent.startFamilies[0],
    pairIds: [...independent.startFamilies[0].pairIds, "start-second-geometry"],
    members: [...independent.startFamilies[0].members, { pairId: "start-second-geometry", coordinate: 21.348, separationMeters: 0.302, endpointDistanceMeters: 0.189 }],
  }],
};
const ambiguous = diagnoseSourceFamilyMemberAgreement({ convergence: [convergence], independentDiagnostics: [ambiguousIndependent], wallSystems: [wall("start-wall", 21.342, 0.293), wall("end-wall", 28.356, 0.091)] });
assert.equal(ambiguous.readyCount, 0);
assert.equal(ambiguous.dimensions[0].start.reason, "ambiguous_member_agreement");
assert.equal(ambiguous.dimensions[0].start.eligibleMatches.length, 2);

const noMatch = diagnoseSourceFamilyMemberAgreement({ convergence: [convergence], independentDiagnostics: [independent], wallSystems: [wall("start-wall", 21.342, 0.22), wall("end-wall", 28.356, 0.091)] });
assert.equal(noMatch.readyCount, 0);
assert.equal(noMatch.dimensions[0].start.reason, "no_member_within_fidelity_targets");

console.log("Blueprint source family member agreement diagnostic contract passed.");
