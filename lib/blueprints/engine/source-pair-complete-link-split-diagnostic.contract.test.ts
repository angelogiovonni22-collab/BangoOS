import assert from "node:assert/strict";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosSourcePairFamilyAgreement, BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import { diagnoseCompleteLinkFamilySplits } from "./source-pair-complete-link-split-diagnostic";

function cluster(representativePairId: string, memberPairIds: string[]): BosSourceWallPairConsolidationCluster {
  return { representativePairId, memberPairIds, members: [] };
}

function agreement(representativePairId: string, supportIds: string[] | null, reason?: BosSourcePairFamilyAgreement["reason"]): BosSourcePairFamilyAgreement {
  const resolvedReason = reason ?? (supportIds ? "unique_family_member_agreement" : "no_family_member_agreement");
  return {
    representativePairId,
    memberCount: 1,
    passingMemberCount: supportIds ? 1 : 0,
    equivalentPassingGeometryCount: supportIds ? 1 : 0,
    recommendedMemberPairId: supportIds ? `${representativePairId}-member` : null,
    reason: resolvedReason,
    members: [{
      memberPairId: `${representativePairId}-member`,
      sourceCoordinateMeters: 1,
      sourceThicknessMeters: 0.2,
      sourceLengthMeters: 4,
      coordinateErrorMeters: supportIds ? 0.01 : null,
      thicknessErrorMeters: supportIds ? 0.01 : null,
      sourceSpanCoverageRatio: supportIds ? 1 : 0,
      supportingWallIds: supportIds ?? [],
      passed: Boolean(supportIds),
    }],
  };
}

const singleLinkClusters = [
  cluster("single-distinct", ["a", "b"]),
  cluster("single-same", ["c", "d"]),
  cluster("single-unresolved", ["e", "f"]),
  cluster("single-unchanged", ["g"]),
];
const completeLinkClusters = [
  cluster("complete-a", ["a"]),
  cluster("complete-b", ["b"]),
  cluster("complete-c", ["c"]),
  cluster("complete-d", ["d"]),
  cluster("complete-e", ["e"]),
  cluster("complete-f", ["f"]),
  cluster("complete-g", ["g"]),
];
const agreements = [
  agreement("complete-a", ["wall-a"]),
  agreement("complete-b", ["wall-b"]),
  agreement("complete-c", ["wall-shared"]),
  agreement("complete-d", ["wall-shared"]),
  agreement("complete-e", ["wall-e"]),
  agreement("complete-f", null),
  agreement("complete-g", ["wall-g"]),
];
const completeLinkFamilyAgreement: BosSourcePairFamilyAgreementDiagnostic = {
  retainedPairCount: agreements.length,
  uniqueAgreementCount: agreements.filter((item) => item.reason === "unique_family_member_agreement").length,
  ambiguousAgreementCount: 0,
  noAgreementCount: agreements.filter((item) => item.reason === "no_family_member_agreement").length,
  missingFamilyCount: 0,
  agreements,
  diagnostics: [],
};

const diagnostic = diagnoseCompleteLinkFamilySplits({ singleLinkClusters, completeLinkClusters, completeLinkFamilyAgreement });
assert.equal(diagnostic.singleLinkFamilyCount, 4);
assert.equal(diagnostic.splitFamilyCount, 3);
assert.equal(diagnostic.distinctSupportSplitCount, 1);
assert.equal(diagnostic.sameSupportSplitCount, 1);
assert.equal(diagnostic.mixedOrUnresolvedSplitCount, 1);
assert.equal(diagnostic.unchangedFamilyCount, 1);
assert.equal(diagnostic.families.find((item) => item.singleLinkRepresentativePairId === "single-distinct")?.classification, "split_distinct_explicit_support");
assert.equal(diagnostic.families.find((item) => item.singleLinkRepresentativePairId === "single-distinct")?.distinctUniqueSupportCount, 2);
assert.equal(diagnostic.families.find((item) => item.singleLinkRepresentativePairId === "single-same")?.classification, "split_same_explicit_support");
assert.equal(diagnostic.families.find((item) => item.singleLinkRepresentativePairId === "single-same")?.distinctUniqueSupportCount, 1);
assert.equal(diagnostic.families.find((item) => item.singleLinkRepresentativePairId === "single-unresolved")?.classification, "split_mixed_or_unresolved");
assert.equal(diagnostic.families.find((item) => item.singleLinkRepresentativePairId === "single-unchanged")?.classification, "unchanged_family");

const notRetained: BosSourcePairFamilyAgreementDiagnostic = {
  ...completeLinkFamilyAgreement,
  retainedPairCount: agreements.length - 1,
  agreements: agreements.filter((item) => item.representativePairId !== "complete-b"),
};
const failClosed = diagnoseCompleteLinkFamilySplits({ singleLinkClusters, completeLinkClusters, completeLinkFamilyAgreement: notRetained });
assert.equal(failClosed.families.find((item) => item.singleLinkRepresentativePairId === "single-distinct")?.classification, "split_mixed_or_unresolved", "a split with an unretained complete-link subfamily must fail closed");
assert.equal(failClosed.families.find((item) => item.singleLinkRepresentativePairId === "single-distinct")?.subfamilies.find((item) => item.representativePairId === "complete-b")?.agreementReason, "not_retained");

console.log("Blueprint complete-link family split diagnostic contract passed.");
