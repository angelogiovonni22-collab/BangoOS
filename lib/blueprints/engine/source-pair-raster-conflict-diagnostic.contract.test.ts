import assert from "node:assert/strict";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterPairingGapDiagnostic } from "./source-pair-raster-pairing-gap-diagnostic";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { diagnoseSourcePairRasterConflicts } from "./source-pair-raster-conflict-diagnostic";

function wall(id: string, faceAId: string, faceBId: string, yA: number, yB: number): BosWallSystemCandidate {
  const center = (yA + yB) / 2;
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x: 1, y: center }, end: { x: 9, y: center } },
    thickness: Math.abs(yB - yA),
    length: 8,
    orientationRadians: 0,
    faceA: { id: faceAId, primitiveId: faceAId, sourcePage: 1, line: { start: { x: 1, y: yA }, end: { x: 9, y: yA } }, confidence: 0.62 },
    faceB: { id: faceBId, primitiveId: faceBId, sourcePage: 1, line: { start: { x: 1, y: yB }, end: { x: 9, y: yB } }, confidence: 0.62 },
    overlapRatio: 1,
    confidence: 0.8,
  };
}

function agreement(
  representativePairId: string,
  reason: "unique_family_member_agreement" | "ambiguous_family_member_agreement" | "no_family_member_agreement",
  supportingWallIds: string[] = [],
) {
  const passed = supportingWallIds.length > 0;
  return {
    representativePairId,
    memberCount: 1,
    passingMemberCount: passed ? 1 : 0,
    equivalentPassingGeometryCount: passed ? 1 : 0,
    recommendedMemberPairId: reason === "unique_family_member_agreement" && passed ? `${representativePairId}-member` : null,
    reason,
    members: [{
      memberPairId: `${representativePairId}-member`,
      sourceCoordinateMeters: 4,
      sourceThicknessMeters: 0.2,
      sourceLengthMeters: 8,
      coordinateErrorMeters: passed ? 0.01 : null,
      thicknessErrorMeters: passed ? 0.01 : null,
      sourceSpanCoverageRatio: passed ? 1 : 0,
      supportingWallIds,
      passed,
    }],
  } as BosSourcePairFamilyAgreementDiagnostic["agreements"][number];
}

const familyAgreement: BosSourcePairFamilyAgreementDiagnostic = {
  retainedPairCount: 4,
  uniqueAgreementCount: 1,
  ambiguousAgreementCount: 0,
  noAgreementCount: 3,
  missingFamilyCount: 0,
  agreements: [
    agreement("target-unbacked", "no_family_member_agreement"),
    agreement("target-backed", "no_family_member_agreement"),
    agreement("target-ambiguous", "no_family_member_agreement"),
    agreement("claimant-source-proof", "unique_family_member_agreement", ["claimant-backed"]),
  ],
  diagnostics: [],
};

const rasterPairingGapDiagnostic: BosRasterPairingGapDiagnostic = {
  familyCount: 3,
  memberCount: 3,
  reasonMemberCounts: {
    no_matching_raw_pair: 0,
    greedy_face_claimed_candidate: 3,
    sheet_frame_excluded_candidate: 0,
    unexpected_selected_support: 0,
    unselected_valid_candidate: 0,
  },
  reasonFamilyCounts: {
    no_matching_raw_pair: 0,
    greedy_face_claimed_candidate: 3,
    sheet_frame_excluded_candidate: 0,
    unexpected_selected_support: 0,
    unselected_valid_candidate: 0,
  },
  members: [
    {
      representativePairId: "target-unbacked",
      memberPairId: "target-unbacked-member",
      reason: "greedy_face_claimed_candidate",
      matchingCandidateCount: 1,
      bestCandidateId: "candidate-unbacked",
      bestCoordinateErrorMeters: 0.005,
      bestThicknessErrorMeters: 0.004,
      bestSourceSpanCoverageRatio: 1,
      bestCandidateFaceIds: ["face-a", "face-b"],
      claimedFaceIds: ["face-a"],
    },
    {
      representativePairId: "target-backed",
      memberPairId: "target-backed-member",
      reason: "greedy_face_claimed_candidate",
      matchingCandidateCount: 1,
      bestCandidateId: "candidate-backed",
      bestCoordinateErrorMeters: 0.005,
      bestThicknessErrorMeters: 0.004,
      bestSourceSpanCoverageRatio: 1,
      bestCandidateFaceIds: ["face-c", "face-d"],
      claimedFaceIds: ["face-c"],
    },
    {
      representativePairId: "target-ambiguous",
      memberPairId: "target-ambiguous-member",
      reason: "greedy_face_claimed_candidate",
      matchingCandidateCount: 2,
      bestCandidateId: "candidate-ambiguous-a",
      bestCoordinateErrorMeters: 0.005,
      bestThicknessErrorMeters: 0.004,
      bestSourceSpanCoverageRatio: 1,
      bestCandidateFaceIds: ["face-e", "face-f"],
      claimedFaceIds: ["face-e"],
    },
  ],
  diagnostics: [],
};

const diagnostic = diagnoseSourcePairRasterConflicts({
  familyAgreement,
  rasterPairingGapDiagnostic,
  explicitWallSystems: [
    wall("claimant-unbacked", "face-a", "competing-a", 3.9, 3.75),
    wall("claimant-backed", "face-c", "competing-c", 5.9, 5.75),
    wall("claimant-ambiguous", "face-e", "competing-e", 7.9, 7.75),
  ],
});

assert.equal(diagnostic.familyCount, 3);
assert.equal(diagnostic.memberCount, 3);
assert.equal(diagnostic.memberReasonCounts.isolated_unbacked_single_candidate, 1);
assert.equal(diagnostic.memberReasonCounts.source_backed_claimant_conflict, 1);
assert.equal(diagnostic.memberReasonCounts.unbacked_multi_candidate, 1);
assert.equal(diagnostic.familyReasonCounts.isolated_unbacked_candidate, 1);
assert.equal(diagnostic.familyReasonCounts.source_backed_conflict, 1);
assert.equal(diagnostic.familyReasonCounts.unbacked_candidate_ambiguity, 1);

const unbacked = diagnostic.members.find((member) => member.representativePairId === "target-unbacked");
assert.deepEqual(unbacked?.claimantWallIds, ["claimant-unbacked"]);
assert.deepEqual(unbacked?.sourceBackedClaimantWallIds, []);

const backed = diagnostic.members.find((member) => member.representativePairId === "target-backed");
assert.deepEqual(backed?.sourceBackedClaimantWallIds, ["claimant-backed"]);
assert.deepEqual(backed?.uniqueSupportFamilyIds, ["claimant-source-proof"]);

const isolatedFamily = diagnostic.families.find((family) => family.representativePairId === "target-unbacked");
assert.equal(isolatedFamily?.allClaimantsUnbacked, true);
assert.equal(isolatedFamily?.allMembersSingleCandidate, true);
assert.equal(isolatedFamily?.candidateConverged, true);
assert.equal(isolatedFamily?.reason, "isolated_unbacked_candidate");

console.log("Blueprint raster pairing conflict provenance diagnostic contract passed.");
