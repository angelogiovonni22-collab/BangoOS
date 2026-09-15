import type { BosRawSegment } from "./geometry";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterDedupeGapDiagnostic } from "./source-pair-raster-dedupe-gap-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";

type Orientation = "horizontal" | "vertical";
type SourceFace = { orientation: Orientation; fixed: number; start: number; end: number };

function orientationOf(segment: BosRawSegment): Orientation {
  return Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y) ? "horizontal" : "vertical";
}

function segmentGeometry(segment: BosRawSegment) {
  const orientation = orientationOf(segment);
  return {
    orientation,
    fixed: orientation === "horizontal"
      ? (segment.start.y + segment.end.y) / 2
      : (segment.start.x + segment.end.x) / 2,
    start: orientation === "horizontal"
      ? Math.min(segment.start.x, segment.end.x)
      : Math.min(segment.start.y, segment.end.y),
    end: orientation === "horizontal"
      ? Math.max(segment.start.x, segment.end.x)
      : Math.max(segment.start.y, segment.end.y),
  };
}

function sourceFace(
  member: BosSourceWallPairConsolidationCluster["members"][number],
  face: "a" | "b",
  input: {
    sourcePixelWidth: number;
    sourcePixelHeight: number;
    sourceWidthMeters: number;
    sourceHeightMeters: number;
  },
): SourceFace {
  const horizontal = member.orientation === "horizontal";
  const fixedScale = horizontal
    ? input.sourcePixelHeight / input.sourceHeightMeters
    : input.sourcePixelWidth / input.sourceWidthMeters;
  const movingScale = horizontal
    ? input.sourcePixelWidth / input.sourceWidthMeters
    : input.sourcePixelHeight / input.sourceHeightMeters;
  return {
    orientation: member.orientation,
    fixed: (face === "a" ? member.faceAFixedPixel : member.faceBFixedPixel) / fixedScale,
    start: Math.min(member.startPixel, member.endPixel) / movingScale,
    end: Math.max(member.startPixel, member.endPixel) / movingScale,
  };
}

function matchingInterval(
  segment: BosRawSegment,
  face: SourceFace,
  maximumCoordinateErrorMeters: number,
): [number, number] | null {
  const geometry = segmentGeometry(segment);
  if (geometry.orientation !== face.orientation) return null;
  if (Math.abs(geometry.fixed - face.fixed) > maximumCoordinateErrorMeters) return null;
  const start = Math.max(face.start, geometry.start);
  const end = Math.min(face.end, geometry.end);
  return end > start ? [start, end] : null;
}

function coverage(intervals: Array<[number, number]>, face: SourceFace) {
  const sorted = intervals
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!sorted.length) return 0;
  let total = 0;
  let currentStart = sorted[0][0];
  let currentEnd = sorted[0][1];
  for (let index = 1; index < sorted.length; index += 1) {
    const [start, end] = sorted[index];
    if (start <= currentEnd) currentEnd = Math.max(currentEnd, end);
    else {
      total += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  total += currentEnd - currentStart;
  return total / Math.max(0.000001, face.end - face.start);
}

export function selectSourceBackedShortRunSegments(input: {
  baselineSegments: readonly BosRawSegment[];
  paritySegments: readonly BosRawSegment[];
  dedupeGapDiagnostic: BosRasterDedupeGapDiagnostic;
  consolidationClusters: readonly BosSourceWallPairConsolidationCluster[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  maximumCoordinateErrorMeters?: number;
  minimumSourceSpanCoverageRatio?: number;
}) {
  const maxCoordinateError = input.maximumCoordinateErrorMeters ?? 0.02;
  const minCoverage = input.minimumSourceSpanCoverageRatio ?? 0.9;
  const baselineIds = new Set(input.baselineSegments.map((segment) => String(segment.sourceObjectId || "")));
  const addedCandidates = input.paritySegments.filter((segment) => !baselineIds.has(String(segment.sourceObjectId || "")));
  const clusterByRepresentative = new Map(input.consolidationClusters.map((cluster) => [cluster.representativePairId, cluster]));
  const selectedIds = new Set<string>();
  const targetFamilyIds = new Set<string>();
  let targetFaceCount = 0;
  let recoverableFaceCount = 0;

  for (const diagnosticMember of input.dedupeGapDiagnostic.members) {
    const cluster = clusterByRepresentative.get(diagnosticMember.representativePairId);
    const member = cluster?.members.find((entry) => entry.id === diagnosticMember.memberPairId);
    if (!member) continue;
    for (const failedFace of diagnosticMember.failedFaces) {
      if (failedFace.reason !== "below_raster_min_run") continue;
      targetFaceCount += 1;
      targetFamilyIds.add(diagnosticMember.representativePairId);
      const face = sourceFace(member, failedFace.face, input);
      const baselineIntervals = input.baselineSegments.flatMap((segment) => {
        const interval = matchingInterval(segment, face, maxCoordinateError);
        return interval ? [interval] : [];
      });
      const candidateMatches = addedCandidates.flatMap((segment) => {
        const interval = matchingInterval(segment, face, maxCoordinateError);
        return interval ? [{ segment, interval }] : [];
      });
      if (!candidateMatches.length) continue;
      const combinedCoverage = coverage([
        ...baselineIntervals,
        ...candidateMatches.map((match) => match.interval),
      ], face);
      if (combinedCoverage < minCoverage) continue;
      recoverableFaceCount += 1;
      for (const match of candidateMatches) {
        const id = String(match.segment.sourceObjectId || "");
        if (id) selectedIds.add(id);
      }
    }
  }

  const addedSegments = addedCandidates.filter((segment) => selectedIds.has(String(segment.sourceObjectId || "")));
  return {
    segments: [...input.baselineSegments, ...addedSegments],
    addedSegmentIds: addedSegments.map((segment) => String(segment.sourceObjectId || "")).sort(),
    targetFamilyIds: [...targetFamilyIds].sort(),
    targetFaceCount,
    recoverableFaceCount,
  };
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

export function summarizeSourceBackedShortRunSimulation(input: {
  baselineMinRunPixels: number;
  sourceEquivalentMinRunPixels: number;
  baselineRasterSegmentCount: number;
  parityRasterSegmentCount: number;
  simulatedRasterSegmentCount: number;
  targetFamilyIds: readonly string[];
  targetFaceCount: number;
  recoverableFaceCount: number;
  addedSegmentIds: readonly string[];
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
  const safeToConsiderPromotion = input.addedSegmentIds.length > 0
    && previouslyUniqueRegressionFamilyIds.length === 0
    && delta.uniqueAgreementCount > 0
    && delta.noAgreementCount < 0
    && delta.ambiguousAgreementCount <= 0
    && delta.missingFamilyCount <= 0;

  return {
    mode: "read_only_source_backed_short_run_simulation" as const,
    baselineMinRunPixels: input.baselineMinRunPixels,
    sourceEquivalentMinRunPixels: input.sourceEquivalentMinRunPixels,
    baselineRasterSegmentCount: input.baselineRasterSegmentCount,
    parityRasterSegmentCount: input.parityRasterSegmentCount,
    simulatedRasterSegmentCount: input.simulatedRasterSegmentCount,
    targetFamilyIds: [...input.targetFamilyIds].sort(),
    targetFaceCount: input.targetFaceCount,
    recoverableFaceCount: input.recoverableFaceCount,
    addedSegmentIds: [...input.addedSegmentIds].sort(),
    before,
    after,
    delta,
    previouslyUniqueRegressionFamilyIds,
    newlyUniqueFamilyIds,
    noMatchStageBefore: input.beforeStageDiagnostic.reasonMemberCounts,
    noMatchStageAfter: input.afterStageDiagnostic.reasonMemberCounts,
    safeToConsiderPromotion,
    diagnostics: [
      `The simulation generated lower-minimum raster candidates only to test source-detector parity (${input.sourceEquivalentMinRunPixels} extraction pixels versus production ${input.baselineMinRunPixels}) and then discarded every added segment not tied to an independently detected below-minimum source face.`,
      `${input.recoverableFaceCount} of ${input.targetFaceCount} below-minimum source face(s) can reach the unchanged 90% source-span gate inside the unchanged 2 cm coordinate gate using the source-backed candidate set.`,
      `${input.addedSegmentIds.length} source-backed candidate segment(s) were added in-memory; production extraction, persistence, canonical geometry, and 3D remained unchanged.`,
      `${newlyUniqueFamilyIds.length} family/families became uniquely supported and ${previouslyUniqueRegressionFamilyIds.length} previously unique family/families regressed.`,
      safeToConsiderPromotion
        ? "The selective short-run simulation is non-regressive at the source-family layer; independent overlay, topology, dimensions, and all hard fidelity gates remain mandatory before any production extraction behavior may change."
        : "The selective short-run simulation is not sufficient for promotion and production extraction must remain unchanged.",
    ],
  };
}
