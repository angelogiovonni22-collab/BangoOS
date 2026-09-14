import assert from "node:assert/strict";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { diagnoseSourcePairFamilyAgreement } from "./source-pair-family-agreement-diagnostic";

const scale = 100;
function pair(id: string, y: number, thickness: number, start = 1, end = 5): BosSourceWallFacePair {
  return {
    id,
    orientation: "horizontal",
    faceAFixedPixel: Math.round((y - thickness / 2) * scale),
    faceBFixedPixel: Math.round((y + thickness / 2) * scale),
    centerFixedPixel: y * scale,
    startPixel: start * scale,
    endPixel: end * scale,
    lengthMeters: end - start,
    separationMeters: thickness,
  };
}

function wall(id: string, y: number, thickness: number, start = 1, end = 5): BosWallSystemCandidate {
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x: start, y }, end: { x: end, y } },
    thickness,
    length: end - start,
    orientationRadians: 0,
    faceA: { id: `${id}-a`, primitiveId: `${id}-a`, sourcePage: 1, line: { start: { x: start, y: y - thickness / 2 }, end: { x: end, y: y - thickness / 2 } }, confidence: 0.9 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-b`, sourcePage: 1, line: { start: { x: start, y: y + thickness / 2 }, end: { x: end, y: y + thickness / 2 } }, confidence: 0.9 },
    overlapRatio: 1,
    confidence: 0.9,
  };
}

const representative = pair("rep", 4, 0.20, 1, 9);
const matchingMember = pair("member-match", 4.01, 0.22, 1, 9);
const family: BosSourceWallPairConsolidationCluster = {
  representativePairId: representative.id,
  memberPairIds: [representative.id, matchingMember.id],
  members: [representative, matchingMember],
};
const segmentedCoverage = diagnoseSourcePairFamilyAgreement({
  retainedSourcePairs: [representative],
  consolidationClusters: [family],
  explicitWallSystems: [
    wall("left", 4.015, 0.215, 1, 5),
    wall("right", 4.005, 0.225, 5, 9),
  ],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(segmentedCoverage.uniqueAgreementCount, 1, "a source member covered by multiple collinear explicit wall segments must remain eligible");
assert.equal(segmentedCoverage.agreements[0]?.recommendedMemberPairId, "member-match");
assert.equal(segmentedCoverage.agreements[0]?.members.find((item) => item.memberPairId === "member-match")?.sourceSpanCoverageRatio, 1);
assert.equal(segmentedCoverage.agreements[0]?.reason, "unique_family_member_agreement");

const supportVariantA = pair("support-variant-a", 6.00, 0.20, 1, 9);
const supportVariantB = pair("support-variant-b", 6.015, 0.215, 1, 9);
const sameSupportVariants = diagnoseSourcePairFamilyAgreement({
  retainedSourcePairs: [supportVariantA],
  consolidationClusters: [{
    representativePairId: supportVariantA.id,
    memberPairIds: [supportVariantA.id, supportVariantB.id],
    members: [supportVariantA, supportVariantB],
  }],
  explicitWallSystems: [wall("shared-wall", 6.01, 0.21, 1, 9)],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(sameSupportVariants.uniqueAgreementCount, 1, "raster variants that independently pass the hard gates against the same explicit wall must be one agreement");
assert.equal(sameSupportVariants.agreements[0]?.passingMemberCount, 2);
assert.equal(sameSupportVariants.agreements[0]?.equivalentPassingGeometryCount, 1, "same explicit-wall support must collapse variant raster hypotheses without relaxing fidelity gates");
assert.equal(sameSupportVariants.agreements[0]?.reason, "unique_family_member_agreement");

const noAgreement = diagnoseSourcePairFamilyAgreement({
  retainedSourcePairs: [representative],
  consolidationClusters: [family],
  explicitWallSystems: [wall("far", 4.05, 0.22, 1, 9)],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(noAgreement.noAgreementCount, 1, "walls outside the 2 cm coordinate gate must fail closed");

const alternateA = pair("alt-a", 4.00, 0.20, 1, 9);
const alternateB = pair("alt-b", 4.04, 0.24, 1, 9);
const ambiguous = diagnoseSourcePairFamilyAgreement({
  retainedSourcePairs: [alternateA],
  consolidationClusters: [{
    representativePairId: alternateA.id,
    memberPairIds: [alternateA.id, alternateB.id],
    members: [alternateA, alternateB],
  }],
  explicitWallSystems: [wall("a-wall", 4.00, 0.20, 1, 9), wall("b-wall", 4.04, 0.24, 1, 9)],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(ambiguous.ambiguousAgreementCount, 1, "members resolving to materially different explicit-wall support must remain ambiguous");
assert.equal(ambiguous.agreements[0]?.equivalentPassingGeometryCount, 2);
assert.equal(ambiguous.agreements[0]?.recommendedMemberPairId, null);

const missing = diagnoseSourcePairFamilyAgreement({
  retainedSourcePairs: [representative],
  consolidationClusters: [],
  explicitWallSystems: [],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(missing.missingFamilyCount, 1, "missing consolidation provenance must fail closed");

console.log("Blueprint source pair family agreement diagnostic contract passed.");
