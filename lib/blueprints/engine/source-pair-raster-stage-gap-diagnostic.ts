import type { BosRawSegment } from "./geometry";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosRasterPairingGapDiagnostic } from "./source-pair-raster-pairing-gap-diagnostic";

type Orientation = "horizontal" | "vertical";

export type BosRasterStageGapReason =
  | "extraction_face_coverage_gap"
  | "annotation_filter_removed_face_evidence"
  | "pair_builder_consistency_gap";

type FaceEvidence = {
  segmentCount: number;
  minimumCoordinateErrorMeters: number | null;
  sourceSpanCoverageRatio: number;
  passed: boolean;
};

export type BosRasterStageGapMember = {
  representativePairId: string;
  memberPairId: string;
  reason: BosRasterStageGapReason;
  rawFaceA: FaceEvidence;
  rawFaceB: FaceEvidence;
  filteredFaceA: FaceEvidence;
  filteredFaceB: FaceEvidence;
};

export type BosRasterStageGapDiagnostic = {
  familyCount: number;
  memberCount: number;
  reasonMemberCounts: Record<BosRasterStageGapReason, number>;
  reasonFamilyCounts: Record<BosRasterStageGapReason, number>;
  members: BosRasterStageGapMember[];
  diagnostics: string[];
};

type SourceFace = {
  orientation: Orientation;
  fixed: number;
  start: number;
  end: number;
};

function segmentLength(segment: BosRawSegment) {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
}

function sourceFaceGeometry(
  pair: BosSourceWallPairConsolidationCluster["members"][number],
  face: "a" | "b",
  input: {
    sourcePixelWidth: number;
    sourcePixelHeight: number;
    sourceWidthMeters: number;
    sourceHeightMeters: number;
  },
): SourceFace {
  const pxPerMeterX = input.sourcePixelWidth / input.sourceWidthMeters;
  const pxPerMeterY = input.sourcePixelHeight / input.sourceHeightMeters;
  const horizontal = pair.orientation === "horizontal";
  const fixedScale = horizontal ? pxPerMeterY : pxPerMeterX;
  const movingScale = horizontal ? pxPerMeterX : pxPerMeterY;
  return {
    orientation: pair.orientation,
    fixed: (face === "a" ? pair.faceAFixedPixel : pair.faceBFixedPixel) / fixedScale,
    start: Math.min(pair.startPixel, pair.endPixel) / movingScale,
    end: Math.max(pair.startPixel, pair.endPixel) / movingScale,
  };
}

function mergeCoverage(intervals: Array<[number, number]>, source: SourceFace) {
  if (!intervals.length) return 0;
  const clipped = intervals
    .map(([start, end]) => [Math.max(source.start, start), Math.min(source.end, end)] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!clipped.length) return 0;
  let total = 0;
  let currentStart = clipped[0][0];
  let currentEnd = clipped[0][1];
  for (let index = 1; index < clipped.length; index += 1) {
    const [start, end] = clipped[index];
    if (start <= currentEnd) currentEnd = Math.max(currentEnd, end);
    else {
      total += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  total += currentEnd - currentStart;
  return total / Math.max(0.000001, source.end - source.start);
}

function assessFace(
  source: SourceFace,
  segments: readonly BosRawSegment[],
  maximumCoordinateErrorMeters: number,
  minimumSourceSpanCoverageRatio: number,
): FaceEvidence {
  const candidates = segments.flatMap((segment) => {
    const horizontal = Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y);
    const orientation: Orientation = horizontal ? "horizontal" : "vertical";
    if (orientation !== source.orientation || segmentLength(segment) <= Number.EPSILON) return [];
    const fixed = horizontal ? (segment.start.y + segment.end.y) / 2 : (segment.start.x + segment.end.x) / 2;
    const coordinateErrorMeters = Math.abs(fixed - source.fixed);
    if (coordinateErrorMeters > maximumCoordinateErrorMeters) return [];
    const start = horizontal ? Math.min(segment.start.x, segment.end.x) : Math.min(segment.start.y, segment.end.y);
    const end = horizontal ? Math.max(segment.start.x, segment.end.x) : Math.max(segment.start.y, segment.end.y);
    if (end <= source.start || start >= source.end) return [];
    return [{ coordinateErrorMeters, start, end }];
  });
  const coverage = mergeCoverage(candidates.map((candidate) => [candidate.start, candidate.end]), source);
  return {
    segmentCount: candidates.length,
    minimumCoordinateErrorMeters: candidates.length ? Math.min(...candidates.map((candidate) => candidate.coordinateErrorMeters)) : null,
    sourceSpanCoverageRatio: coverage,
    passed: coverage >= minimumSourceSpanCoverageRatio,
  };
}

function emptyCounts(): Record<BosRasterStageGapReason, number> {
  return {
    extraction_face_coverage_gap: 0,
    annotation_filter_removed_face_evidence: 0,
    pair_builder_consistency_gap: 0,
  };
}

/**
 * Read-only stage audit for no-matching-raw-pair source members. It does not create or promote walls.
 * Each independent source face is checked against raster line evidence before and after annotation
 * suppression using the unchanged 2 cm coordinate and 90% source-span evidence gates. This separates
 * extraction/fragmentation loss from annotation-filter loss and from a downstream pair-builder mismatch.
 */
export function diagnoseNoMatchingRasterStages(input: {
  consolidationClusters: readonly BosSourceWallPairConsolidationCluster[];
  rasterPairingGapDiagnostic: BosRasterPairingGapDiagnostic;
  rawSegments: readonly BosRawSegment[];
  annotationFilteredSegments: readonly BosRawSegment[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  maximumCoordinateErrorMeters?: number;
  minimumSourceSpanCoverageRatio?: number;
}): BosRasterStageGapDiagnostic {
  const maxCoordinateError = input.maximumCoordinateErrorMeters ?? 0.02;
  const minSourceCoverage = input.minimumSourceSpanCoverageRatio ?? 0.9;
  const clusterByRepresentative = new Map(input.consolidationClusters.map((cluster) => [cluster.representativePairId, cluster]));
  const targetMemberKeys = new Set(input.rasterPairingGapDiagnostic.members
    .filter((member) => member.reason === "no_matching_raw_pair")
    .map((member) => `${member.representativePairId}::${member.memberPairId}`));
  const members: BosRasterStageGapMember[] = [];

  for (const [representativePairId, cluster] of clusterByRepresentative) {
    for (const member of cluster.members) {
      if (!targetMemberKeys.has(`${representativePairId}::${member.id}`)) continue;
      const faceA = sourceFaceGeometry(member, "a", input);
      const faceB = sourceFaceGeometry(member, "b", input);
      const rawFaceA = assessFace(faceA, input.rawSegments, maxCoordinateError, minSourceCoverage);
      const rawFaceB = assessFace(faceB, input.rawSegments, maxCoordinateError, minSourceCoverage);
      const filteredFaceA = assessFace(faceA, input.annotationFilteredSegments, maxCoordinateError, minSourceCoverage);
      const filteredFaceB = assessFace(faceB, input.annotationFilteredSegments, maxCoordinateError, minSourceCoverage);
      let reason: BosRasterStageGapReason;
      if (rawFaceA.passed && rawFaceB.passed) {
        reason = filteredFaceA.passed && filteredFaceB.passed
          ? "pair_builder_consistency_gap"
          : "annotation_filter_removed_face_evidence";
      } else {
        reason = "extraction_face_coverage_gap";
      }
      members.push({
        representativePairId,
        memberPairId: member.id,
        reason,
        rawFaceA,
        rawFaceB,
        filteredFaceA,
        filteredFaceB,
      });
    }
  }

  const reasonMemberCounts = emptyCounts();
  const reasonsByFamily = new Map<string, Set<BosRasterStageGapReason>>();
  for (const member of members) {
    reasonMemberCounts[member.reason] += 1;
    const reasons = reasonsByFamily.get(member.representativePairId) ?? new Set<BosRasterStageGapReason>();
    reasons.add(member.reason);
    reasonsByFamily.set(member.representativePairId, reasons);
  }
  const reasonFamilyCounts = emptyCounts();
  for (const reasons of reasonsByFamily.values()) for (const reason of reasons) reasonFamilyCounts[reason] += 1;

  return {
    familyCount: reasonsByFamily.size,
    memberCount: members.length,
    reasonMemberCounts,
    reasonFamilyCounts,
    members,
    diagnostics: [
      `${members.length} no-matching source member(s) were traced across raster extraction and annotation suppression without changing geometry or thresholds.`,
      `${reasonMemberCounts.extraction_face_coverage_gap} member(s) already lack at least one source face with ${(minSourceCoverage * 100).toFixed(0)}% span coverage inside the unchanged ${(maxCoordinateError * 100).toFixed(0)} cm coordinate gate before annotation suppression.`,
      `${reasonMemberCounts.annotation_filter_removed_face_evidence} member(s) have both source faces before annotation suppression but lose required face coverage after suppression.`,
      `${reasonMemberCounts.pair_builder_consistency_gap} member(s) retain both required faces after suppression yet still have no matching raw pair, isolating a downstream pair-builder consistency issue.`,
      "Read-only stage audit: no wall pairing, source selection, structural selection, thresholds, persistence, canonical geometry, or 3D output changed.",
    ],
  };
}
