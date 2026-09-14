import type { BosRawSegment } from "./geometry";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";

function orientationOf(segment: BosRawSegment) {
  return Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y) ? "horizontal" as const : "vertical" as const;
}

export function rasterBandKey(input: {
  segment: BosRawSegment;
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  mergeBandPixels: number;
}) {
  const meterPerPixelX = input.sourceWidthMeters / input.sourcePixelWidth;
  const meterPerPixelY = input.sourceHeightMeters / input.sourcePixelHeight;
  const bandX = Math.max(1, input.mergeBandPixels) * meterPerPixelX;
  const bandY = Math.max(1, input.mergeBandPixels) * meterPerPixelY;
  const orientation = orientationOf(input.segment);
  const fixed = orientation === "horizontal"
    ? (input.segment.start.y + input.segment.end.y) / 2
    : (input.segment.start.x + input.segment.end.x) / 2;
  const start = orientation === "horizontal"
    ? Math.min(input.segment.start.x, input.segment.end.x)
    : Math.min(input.segment.start.y, input.segment.end.y);
  const end = orientation === "horizontal"
    ? Math.max(input.segment.start.x, input.segment.end.x)
    : Math.max(input.segment.start.y, input.segment.end.y);
  return orientation === "horizontal"
    ? `h:${Math.round(fixed / bandY)}:${Math.round(start / bandX)}:${Math.round(end / bandX)}`
    : `v:${Math.round(fixed / bandX)}:${Math.round(start / bandY)}:${Math.round(end / bandY)}`;
}

export function selectTargetedDedupeCollisionSegments(input: {
  baselineSegments: readonly BosRawSegment[];
  keepAllSegments: readonly BosRawSegment[];
  collisionBandKeys: readonly string[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  mergeBandPixels: number;
}) {
  const collisionKeys = new Set(input.collisionBandKeys);
  const selected = [...input.baselineSegments];
  const retainedIds = new Set(input.baselineSegments.map((segment) => String(segment.sourceObjectId || "")));
  const addedSegmentIds: string[] = [];
  for (const segment of input.keepAllSegments) {
    const id = String(segment.sourceObjectId || "");
    if (retainedIds.has(id)) continue;
    const key = rasterBandKey({ ...input, segment });
    if (!collisionKeys.has(key)) continue;
    selected.push(segment);
    retainedIds.add(id);
    addedSegmentIds.push(id);
  }
  return { segments: selected, addedSegmentIds: addedSegmentIds.sort() };
}

function counts(report: BosSourcePairFamilyAgreementDiagnostic) {
  return {
    uniqueAgreementCount: report.uniqueAgreementCount,
    ambiguousAgreementCount: report.ambiguousAgreementCount,
    noAgreementCount: report.noAgreementCount,
    missingFamilyCount: report.missingFamilyCount,
  };
}

function reasonByFamily(report: BosSourcePairFamilyAgreementDiagnostic) {
  return new Map(report.agreements.map((agreement) => [agreement.representativePairId, agreement.reason]));
}

export function summarizeTargetedDedupeCollisionSimulation(input: {
  collisionBandKeys: readonly string[];
  addedSegmentIds: readonly string[];
  baselineRasterSegmentCount: number;
  simulatedRasterSegmentCount: number;
  beforeAgreement: BosSourcePairFamilyAgreementDiagnostic;
  afterAgreement: BosSourcePairFamilyAgreementDiagnostic;
  beforeStageDiagnostic: BosRasterStageGapDiagnostic;
  afterStageDiagnostic: BosRasterStageGapDiagnostic;
}) {
  const before = counts(input.beforeAgreement);
  const after = counts(input.afterAgreement);
  const beforeReasons = reasonByFamily(input.beforeAgreement);
  const afterReasons = reasonByFamily(input.afterAgreement);
  const previouslyUniqueRegressionFamilyIds = [...beforeReasons.entries()]
    .filter(([familyId, reason]) => reason === "unique_family_member_agreement" && afterReasons.get(familyId) !== "unique_family_member_agreement")
    .map(([familyId]) => familyId)
    .sort();
  const newlyUniqueFamilyIds = [...afterReasons.entries()]
    .filter(([familyId, reason]) => reason === "unique_family_member_agreement" && beforeReasons.get(familyId) !== "unique_family_member_agreement")
    .map(([familyId]) => familyId)
    .sort();
  const delta = {
    uniqueAgreementCount: after.uniqueAgreementCount - before.uniqueAgreementCount,
    ambiguousAgreementCount: after.ambiguousAgreementCount - before.ambiguousAgreementCount,
    noAgreementCount: after.noAgreementCount - before.noAgreementCount,
    missingFamilyCount: after.missingFamilyCount - before.missingFamilyCount,
  };
  const safeToConsiderPromotion = input.collisionBandKeys.length > 0
    && input.addedSegmentIds.length > 0
    && previouslyUniqueRegressionFamilyIds.length === 0
    && delta.uniqueAgreementCount > 0
    && delta.noAgreementCount < 0
    && delta.ambiguousAgreementCount <= 0
    && delta.missingFamilyCount <= 0;
  return {
    mode: "read_only_targeted_raster_dedupe_collision_simulation" as const,
    collisionBandKeys: [...input.collisionBandKeys].sort(),
    addedSegmentIds: [...input.addedSegmentIds].sort(),
    baselineRasterSegmentCount: input.baselineRasterSegmentCount,
    simulatedRasterSegmentCount: input.simulatedRasterSegmentCount,
    before,
    after,
    delta,
    previouslyUniqueRegressionFamilyIds,
    newlyUniqueFamilyIds,
    noMatchStageBefore: input.beforeStageDiagnostic.reasonMemberCounts,
    noMatchStageAfter: input.afterStageDiagnostic.reasonMemberCounts,
    safeToConsiderPromotion,
    diagnostics: [
      `Targeted de-duplication simulation preserved extra raster candidates only in ${input.collisionBandKeys.length} production band(s) already proven by independent source-family evidence to contain a de-duplication collision.`,
      `${input.addedSegmentIds.length} non-production raster candidate(s) were added in-memory; all other production raster segments and all hard source-family gates remained unchanged.`,
      `${newlyUniqueFamilyIds.length} family/families became uniquely supported and ${previouslyUniqueRegressionFamilyIds.length} previously unique family/families regressed.`,
      safeToConsiderPromotion
        ? "The targeted collision simulation is non-regressive at the source-family layer; independent overlay, topology, dimension, and full-fidelity validation are still mandatory before any production de-duplication behavior may change."
        : "The targeted collision simulation is not sufficient for promotion and production de-duplication must remain unchanged.",
      "Read-only simulation: no production extraction setting, wall, topology, persistence, canonical geometry, or 3D output changed.",
    ],
  };
}
