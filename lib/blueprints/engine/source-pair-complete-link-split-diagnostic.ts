import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosSourcePairFamilyAgreement, BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";

export type BosCompleteLinkSubfamilyAudit = {
  representativePairId: string;
  memberPairIds: string[];
  retainedBySourceNetwork: boolean;
  agreementReason: BosSourcePairFamilyAgreement["reason"] | "not_retained";
  uniqueSupportSignature: string | null;
};

export type BosCompleteLinkFamilySplitAudit = {
  singleLinkRepresentativePairId: string;
  singleLinkMemberCount: number;
  completeLinkSubfamilyCount: number;
  retainedCompleteLinkSubfamilyCount: number;
  classification: "unchanged_family" | "split_distinct_explicit_support" | "split_same_explicit_support" | "split_mixed_or_unresolved";
  distinctUniqueSupportCount: number;
  subfamilies: BosCompleteLinkSubfamilyAudit[];
};

export type BosCompleteLinkFamilySplitDiagnostic = {
  singleLinkFamilyCount: number;
  splitFamilyCount: number;
  distinctSupportSplitCount: number;
  sameSupportSplitCount: number;
  mixedOrUnresolvedSplitCount: number;
  unchangedFamilyCount: number;
  families: BosCompleteLinkFamilySplitAudit[];
  diagnostics: string[];
};

function uniqueSupportSignature(agreement: BosSourcePairFamilyAgreement | undefined) {
  if (!agreement || agreement.reason !== "unique_family_member_agreement") return null;
  const signatures = [...new Set(agreement.members
    .filter((member) => member.passed && member.supportingWallIds.length > 0)
    .map((member) => [...new Set(member.supportingWallIds)].sort().join("|")))]
    .filter(Boolean);
  return signatures.length === 1 ? signatures[0] : null;
}

/**
 * Read-only provenance diagnostic for complete-link clustering. Every current single-link source family
 * is compared with the complete-link consolidation families that contain its original rendered-source
 * members. A split is considered evidence of distinct physical boundaries only when retained complete-link
 * subfamilies independently pass the unchanged family-agreement gates against materially different existing
 * explicit-wall support sets. Splitting variants that still resolve to the same existing support is reported
 * separately and is not evidence for changing production clustering.
 */
export function diagnoseCompleteLinkFamilySplits(input: {
  singleLinkClusters: readonly BosSourceWallPairConsolidationCluster[];
  completeLinkClusters: readonly BosSourceWallPairConsolidationCluster[];
  completeLinkFamilyAgreement: BosSourcePairFamilyAgreementDiagnostic;
}): BosCompleteLinkFamilySplitDiagnostic {
  const agreementByRepresentative = new Map(input.completeLinkFamilyAgreement.agreements.map((agreement) => [agreement.representativePairId, agreement]));
  const completeByMemberId = new Map<string, BosSourceWallPairConsolidationCluster>();
  for (const cluster of input.completeLinkClusters) {
    for (const memberId of cluster.memberPairIds) completeByMemberId.set(memberId, cluster);
  }

  const families = input.singleLinkClusters.map((single): BosCompleteLinkFamilySplitAudit => {
    const mapped = new Map<string, BosSourceWallPairConsolidationCluster>();
    for (const memberId of single.memberPairIds) {
      const complete = completeByMemberId.get(memberId);
      if (complete) mapped.set(complete.representativePairId, complete);
    }
    const subfamilies = [...mapped.values()]
      .map((cluster): BosCompleteLinkSubfamilyAudit => {
        const agreement = agreementByRepresentative.get(cluster.representativePairId);
        return {
          representativePairId: cluster.representativePairId,
          memberPairIds: cluster.memberPairIds.filter((memberId) => single.memberPairIds.includes(memberId)).sort(),
          retainedBySourceNetwork: Boolean(agreement),
          agreementReason: agreement?.reason ?? "not_retained",
          uniqueSupportSignature: uniqueSupportSignature(agreement),
        };
      })
      .sort((a, b) => a.representativePairId.localeCompare(b.representativePairId));

    const split = subfamilies.length > 1;
    const retained = subfamilies.filter((subfamily) => subfamily.retainedBySourceNetwork);
    const uniqueSupports = [...new Set(retained.map((subfamily) => subfamily.uniqueSupportSignature).filter((value): value is string => Boolean(value)))];
    const allRetainedUnique = retained.length === subfamilies.length
      && retained.length > 0
      && retained.every((subfamily) => subfamily.agreementReason === "unique_family_member_agreement" && subfamily.uniqueSupportSignature);

    const classification = !split
      ? "unchanged_family" as const
      : allRetainedUnique && uniqueSupports.length > 1
        ? "split_distinct_explicit_support" as const
        : allRetainedUnique && uniqueSupports.length === 1
          ? "split_same_explicit_support" as const
          : "split_mixed_or_unresolved" as const;

    return {
      singleLinkRepresentativePairId: single.representativePairId,
      singleLinkMemberCount: single.memberPairIds.length,
      completeLinkSubfamilyCount: subfamilies.length,
      retainedCompleteLinkSubfamilyCount: retained.length,
      classification,
      distinctUniqueSupportCount: uniqueSupports.length,
      subfamilies,
    };
  });

  const splitFamilyCount = families.filter((family) => family.completeLinkSubfamilyCount > 1).length;
  const distinctSupportSplitCount = families.filter((family) => family.classification === "split_distinct_explicit_support").length;
  const sameSupportSplitCount = families.filter((family) => family.classification === "split_same_explicit_support").length;
  const mixedOrUnresolvedSplitCount = families.filter((family) => family.classification === "split_mixed_or_unresolved").length;
  const unchangedFamilyCount = families.filter((family) => family.classification === "unchanged_family").length;

  return {
    singleLinkFamilyCount: families.length,
    splitFamilyCount,
    distinctSupportSplitCount,
    sameSupportSplitCount,
    mixedOrUnresolvedSplitCount,
    unchangedFamilyCount,
    families,
    diagnostics: [
      `Compared ${families.length} production single-link source family/families with complete-link provenance; ${splitFamilyCount} split into multiple complete-link subfamilies.`,
      `${distinctSupportSplitCount} split family/families independently resolve to multiple distinct existing explicit-wall support sets and are evidence that single-link transitivity may be combining different physical boundaries.`,
      `${sameSupportSplitCount} split family/families resolve back to the same explicit-wall support and therefore are not evidence for changing production clustering.`,
      `${mixedOrUnresolvedSplitCount} split family/families contain ambiguity, no-agreement, missing retention, or mixed support evidence and remain fail-closed.`,
      "Read-only provenance audit: clustering mode, source selection, geometry, thresholds, topology, persistence, canonical data, and 3D output are unchanged.",
    ],
  };
}
