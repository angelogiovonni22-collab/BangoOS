import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterPairingGapDiagnostic } from "./source-pair-raster-pairing-gap-diagnostic";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosRasterPairingConflictMemberReason =
  | "isolated_unbacked_single_candidate"
  | "unbacked_multi_candidate"
  | "source_backed_claimant_conflict"
  | "mixed_claimant_conflict"
  | "missing_claimant_wall";

export type BosRasterPairingConflictFamilyReason =
  | "isolated_unbacked_candidate"
  | "unbacked_candidate_ambiguity"
  | "source_backed_conflict"
  | "mixed_claimant_conflict"
  | "missing_claimant";

export type BosRasterPairingConflictMember = {
  representativePairId: string;
  memberPairId: string;
  bestCandidateId: string | null;
  matchingCandidateCount: number;
  claimantWallIds: string[];
  sourceBackedClaimantWallIds: string[];
  uniqueSupportFamilyIds: string[];
  ambiguousSupportFamilyIds: string[];
  reason: BosRasterPairingConflictMemberReason;
};

export type BosRasterPairingConflictFamily = {
  representativePairId: string;
  greedyMemberCount: number;
  distinctBestCandidateIds: string[];
  claimantWallIds: string[];
  sourceBackedClaimantWallIds: string[];
  allClaimantsUnbacked: boolean;
  allMembersSingleCandidate: boolean;
  candidateConverged: boolean;
  reason: BosRasterPairingConflictFamilyReason;
};

export type BosRasterPairingConflictDiagnostic = {
  familyCount: number;
  memberCount: number;
  memberReasonCounts: Record<BosRasterPairingConflictMemberReason, number>;
  familyReasonCounts: Record<BosRasterPairingConflictFamilyReason, number>;
  members: BosRasterPairingConflictMember[];
  families: BosRasterPairingConflictFamily[];
  diagnostics: string[];
};

type WallSupport = {
  uniqueFamilyIds: Set<string>;
  ambiguousFamilyIds: Set<string>;
};

function memberReasonCounts(): Record<BosRasterPairingConflictMemberReason, number> {
  return {
    isolated_unbacked_single_candidate: 0,
    unbacked_multi_candidate: 0,
    source_backed_claimant_conflict: 0,
    mixed_claimant_conflict: 0,
    missing_claimant_wall: 0,
  };
}

function familyReasonCounts(): Record<BosRasterPairingConflictFamilyReason, number> {
  return {
    isolated_unbacked_candidate: 0,
    unbacked_candidate_ambiguity: 0,
    source_backed_conflict: 0,
    mixed_claimant_conflict: 0,
    missing_claimant: 0,
  };
}

/**
 * Read-only provenance audit for the raw raster candidates that the pairing-gap diagnostic showed
 * were lost only because one or both faces were already claimed by a production wall pairing.
 *
 * This does not assume the source-backed alternative is safe to promote. Instead it asks whether
 * the wall(s) currently claiming those faces are themselves independently supported by any passing
 * source-family member. A claimant with any unique or ambiguous passing source support is treated as
 * protected evidence and therefore a real conflict. Only candidates whose claimants have no passing
 * independent source-family support are classified as isolated/unbacked, and even those remain
 * read-only until a separate replacement simulation proves there is no regression.
 */
export function diagnoseSourcePairRasterConflicts(input: {
  familyAgreement: BosSourcePairFamilyAgreementDiagnostic;
  rasterPairingGapDiagnostic: BosRasterPairingGapDiagnostic;
  explicitWallSystems: readonly BosWallSystemCandidate[];
}): BosRasterPairingConflictDiagnostic {
  const wallByFaceId = new Map<string, Set<string>>();
  for (const wall of input.explicitWallSystems) {
    for (const faceId of [wall.faceA.id, wall.faceB.id]) {
      const ids = wallByFaceId.get(faceId) ?? new Set<string>();
      ids.add(wall.id);
      wallByFaceId.set(faceId, ids);
    }
  }

  const supportByWallId = new Map<string, WallSupport>();
  for (const agreement of input.familyAgreement.agreements) {
    if (agreement.reason !== "unique_family_member_agreement" && agreement.reason !== "ambiguous_family_member_agreement") continue;
    for (const member of agreement.members) {
      if (!member.passed) continue;
      for (const wallId of member.supportingWallIds) {
        const support = supportByWallId.get(wallId) ?? { uniqueFamilyIds: new Set<string>(), ambiguousFamilyIds: new Set<string>() };
        if (agreement.reason === "unique_family_member_agreement") support.uniqueFamilyIds.add(agreement.representativePairId);
        else support.ambiguousFamilyIds.add(agreement.representativePairId);
        supportByWallId.set(wallId, support);
      }
    }
  }

  const members: BosRasterPairingConflictMember[] = [];
  for (const gap of input.rasterPairingGapDiagnostic.members) {
    if (gap.reason !== "greedy_face_claimed_candidate") continue;
    const claimantWallIds = [...new Set(gap.claimedFaceIds.flatMap((faceId) => [...(wallByFaceId.get(faceId) ?? [])]))].sort();
    const sourceBackedClaimantWallIds = claimantWallIds.filter((wallId) => {
      const support = supportByWallId.get(wallId);
      return Boolean(support && (support.uniqueFamilyIds.size || support.ambiguousFamilyIds.size));
    });
    const uniqueSupportFamilyIds = [...new Set(sourceBackedClaimantWallIds.flatMap((wallId) => [...(supportByWallId.get(wallId)?.uniqueFamilyIds ?? [])]))].sort();
    const ambiguousSupportFamilyIds = [...new Set(sourceBackedClaimantWallIds.flatMap((wallId) => [...(supportByWallId.get(wallId)?.ambiguousFamilyIds ?? [])]))].sort();
    const unbackedCount = claimantWallIds.length - sourceBackedClaimantWallIds.length;
    let reason: BosRasterPairingConflictMemberReason;
    if (!claimantWallIds.length) reason = "missing_claimant_wall";
    else if (!sourceBackedClaimantWallIds.length) {
      reason = gap.matchingCandidateCount === 1
        ? "isolated_unbacked_single_candidate"
        : "unbacked_multi_candidate";
    } else if (unbackedCount > 0) reason = "mixed_claimant_conflict";
    else reason = "source_backed_claimant_conflict";

    members.push({
      representativePairId: gap.representativePairId,
      memberPairId: gap.memberPairId,
      bestCandidateId: gap.bestCandidateId,
      matchingCandidateCount: gap.matchingCandidateCount,
      claimantWallIds,
      sourceBackedClaimantWallIds,
      uniqueSupportFamilyIds,
      ambiguousSupportFamilyIds,
      reason,
    });
  }

  const memberCounts = memberReasonCounts();
  for (const member of members) memberCounts[member.reason] += 1;

  const membersByFamily = new Map<string, BosRasterPairingConflictMember[]>();
  for (const member of members) membersByFamily.set(member.representativePairId, [...(membersByFamily.get(member.representativePairId) ?? []), member]);
  const families: BosRasterPairingConflictFamily[] = [];
  for (const [representativePairId, familyMembers] of membersByFamily) {
    const distinctBestCandidateIds = [...new Set(familyMembers.map((member) => member.bestCandidateId).filter((id): id is string => Boolean(id)))].sort();
    const claimantWallIds = [...new Set(familyMembers.flatMap((member) => member.claimantWallIds))].sort();
    const sourceBackedClaimantWallIds = [...new Set(familyMembers.flatMap((member) => member.sourceBackedClaimantWallIds))].sort();
    const hasMissing = familyMembers.some((member) => member.reason === "missing_claimant_wall");
    const hasMixed = familyMembers.some((member) => member.reason === "mixed_claimant_conflict");
    const hasBacked = familyMembers.some((member) => member.reason === "source_backed_claimant_conflict");
    const allClaimantsUnbacked = !hasMissing && !hasMixed && !hasBacked;
    const allMembersSingleCandidate = familyMembers.every((member) => member.matchingCandidateCount === 1);
    const candidateConverged = distinctBestCandidateIds.length === 1;
    let reason: BosRasterPairingConflictFamilyReason;
    if (hasMissing) reason = "missing_claimant";
    else if (hasMixed) reason = "mixed_claimant_conflict";
    else if (hasBacked) reason = "source_backed_conflict";
    else if (allMembersSingleCandidate && candidateConverged) reason = "isolated_unbacked_candidate";
    else reason = "unbacked_candidate_ambiguity";
    families.push({
      representativePairId,
      greedyMemberCount: familyMembers.length,
      distinctBestCandidateIds,
      claimantWallIds,
      sourceBackedClaimantWallIds,
      allClaimantsUnbacked,
      allMembersSingleCandidate,
      candidateConverged,
      reason,
    });
  }
  families.sort((a, b) => a.representativePairId.localeCompare(b.representativePairId));

  const familyCounts = familyReasonCounts();
  for (const family of families) familyCounts[family.reason] += 1;

  return {
    familyCount: families.length,
    memberCount: members.length,
    memberReasonCounts: memberCounts,
    familyReasonCounts: familyCounts,
    members,
    families,
    diagnostics: [
      `Pairing-conflict provenance inspected ${members.length} source member(s) across ${families.length} no-agreement family/families whose raw source-backed candidate lost a face to production greedy pairing.`,
      `${memberCounts.source_backed_claimant_conflict + memberCounts.mixed_claimant_conflict} member conflict(s) involve at least one currently selected wall with independent passing source-family support and therefore remain protected/fail-closed.`,
      `${memberCounts.isolated_unbacked_single_candidate} member(s) have exactly one matching raw candidate and only unbacked claimant wall(s); ${familyCounts.isolated_unbacked_candidate} family/families converge to one such candidate across all greedy-affected members.`,
      `${familyCounts.unbacked_candidate_ambiguity} family/families have only unbacked claimants but still contain multiple candidate choices or raster variants and remain ambiguous until a separate replacement simulation proves equivalence.`,
      "Read-only provenance audit: no wall pairing is replaced, no candidate is promoted, and source selection, geometry, thresholds, topology, persistence, canonical data, and 3D output are unchanged.",
    ],
  };
}
