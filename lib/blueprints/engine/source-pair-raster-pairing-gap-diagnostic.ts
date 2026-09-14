import type { BosRawSegment } from "./geometry";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import { diagnoseSourcePairRasterConflicts, type BosRasterPairingConflictDiagnostic } from "./source-pair-raster-conflict-diagnostic";
import { simulateIsolatedSourceBackedRasterPairReplacements, type BosIsolatedPairReplacementSimulation } from "./source-pair-isolated-replacement-simulation";
import type { BosWallSystemCandidate } from "./wall-system-builder";

type Orientation = "horizontal" | "vertical";

type SourceAxisGeometry = {
  orientation: Orientation;
  fixed: number;
  start: number;
  end: number;
};

type RasterFace = {
  id: string;
  orientation: Orientation;
  fixed: number;
  start: number;
  end: number;
  sourcePage: number;
};

export type BosRasterPairingGapReason =
  | "no_matching_raw_pair"
  | "greedy_face_claimed_candidate"
  | "sheet_frame_excluded_candidate"
  | "unexpected_selected_support"
  | "unselected_valid_candidate";

export type BosRasterPairingGapMember = {
  representativePairId: string;
  memberPairId: string;
  reason: BosRasterPairingGapReason;
  matchingCandidateCount: number;
  bestCandidateId: string | null;
  bestCoordinateErrorMeters: number | null;
  bestThicknessErrorMeters: number | null;
  bestSourceSpanCoverageRatio: number;
  bestCandidateFaceIds: string[];
  claimedFaceIds: string[];
};

export type BosRasterPairingGapDiagnostic = {
  familyCount: number;
  memberCount: number;
  reasonMemberCounts: Record<BosRasterPairingGapReason, number>;
  reasonFamilyCounts: Record<BosRasterPairingGapReason, number>;
  members: BosRasterPairingGapMember[];
  diagnostics: string[];
  conflictProvenance?: BosRasterPairingConflictDiagnostic;
  isolatedReplacementSimulation?: BosIsolatedPairReplacementSimulation;
};

function segmentLength(segment: BosRawSegment) {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
}

function sourceGeometry(pair: BosSourceWallPairConsolidationCluster["members"][number], input: {
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
}): SourceAxisGeometry {
  const pxPerMeterX = input.sourcePixelWidth / input.sourceWidthMeters;
  const pxPerMeterY = input.sourcePixelHeight / input.sourceHeightMeters;
  const horizontal = pair.orientation === "horizontal";
  const fixedScale = horizontal ? pxPerMeterY : pxPerMeterX;
  const movingScale = horizontal ? pxPerMeterX : pxPerMeterY;
  return {
    orientation: pair.orientation,
    fixed: pair.centerFixedPixel / fixedScale,
    start: Math.min(pair.startPixel, pair.endPixel) / movingScale,
    end: Math.max(pair.startPixel, pair.endPixel) / movingScale,
  };
}

function rasterFaces(segments: readonly BosRawSegment[], minLengthMeters: number): RasterFace[] {
  return segments
    .filter((segment) => segmentLength(segment) >= minLengthMeters)
    .map((segment, index) => {
      const horizontal = Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y);
      return {
        id: `${segment.sourceObjectId || `raster-face-${index}`}:face-${index}`,
        orientation: horizontal ? "horizontal" as const : "vertical" as const,
        fixed: horizontal ? (segment.start.y + segment.end.y) / 2 : (segment.start.x + segment.end.x) / 2,
        start: horizontal ? Math.min(segment.start.x, segment.end.x) : Math.min(segment.start.y, segment.end.y),
        end: horizontal ? Math.max(segment.start.x, segment.end.x) : Math.max(segment.start.y, segment.end.y),
        sourcePage: segment.sourcePage,
      };
    });
}

function sourceSpanCoverage(source: SourceAxisGeometry, start: number, end: number) {
  const overlap = Math.max(0, Math.min(source.end, end) - Math.max(source.start, start));
  return overlap / Math.max(0.000001, source.end - source.start);
}

function emptyReasonCounts(): Record<BosRasterPairingGapReason, number> {
  return {
    no_matching_raw_pair: 0,
    greedy_face_claimed_candidate: 0,
    sheet_frame_excluded_candidate: 0,
    unexpected_selected_support: 0,
    unselected_valid_candidate: 0,
  };
}

/**
 * Read-only diagnostic for no-agreement source families. It re-enumerates only raw raster face pairs
 * that satisfy the production wall-builder geometry envelope and then asks whether a pair also matches
 * an independent source-family member inside the unchanged 2 cm coordinate/thickness and 90% coverage
 * gates. This identifies whether source-supported wall evidence existed before the production builder's
 * one-face/one-wall greedy selection. It does not change production pairing, source selection, geometry,
 * thresholds, topology, persistence, canonical data, or 3D output.
 */
export function diagnoseSourcePairRasterPairingGaps(input: {
  familyAgreement: BosSourcePairFamilyAgreementDiagnostic;
  consolidationClusters: readonly BosSourceWallPairConsolidationCluster[];
  annotationFilteredSegments: readonly BosRawSegment[];
  explicitWallSystems: readonly BosWallSystemCandidate[];
  sheetFrameWallSystems: readonly BosWallSystemCandidate[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  minWallLengthMeters?: number;
  minWallThicknessMeters?: number;
  maxWallThicknessMeters?: number;
  minimumBuilderOverlapRatio?: number;
  maximumCoordinateErrorMeters?: number;
  maximumThicknessErrorMeters?: number;
  minimumSourceSpanCoverageRatio?: number;
}): BosRasterPairingGapDiagnostic {
  const minLength = input.minWallLengthMeters ?? 0.45;
  const minThickness = input.minWallThicknessMeters ?? 0.07;
  const maxThickness = input.maxWallThicknessMeters ?? 0.45;
  const minBuilderOverlap = input.minimumBuilderOverlapRatio ?? 0.45;
  const maxCoordinateError = input.maximumCoordinateErrorMeters ?? 0.02;
  const maxThicknessError = input.maximumThicknessErrorMeters ?? 0.02;
  const minSourceCoverage = input.minimumSourceSpanCoverageRatio ?? 0.9;
  const faces = rasterFaces(input.annotationFilteredSegments, minLength);
  const clusterByRepresentative = new Map(input.consolidationClusters.map((cluster) => [cluster.representativePairId, cluster]));
  const explicitIds = new Set(input.explicitWallSystems.map((wall) => wall.id));
  const sheetFrameIds = new Set(input.sheetFrameWallSystems.map((wall) => wall.id));
  const claimedFaces = new Set(input.explicitWallSystems.flatMap((wall) => [wall.faceA.id, wall.faceB.id]));
  const candidates: Array<{
    id: string;
    orientation: Orientation;
    coordinate: number;
    thickness: number;
    start: number;
    end: number;
    faceIds: [string, string];
  }> = [];

  for (let left = 0; left < faces.length; left += 1) {
    for (let right = left + 1; right < faces.length; right += 1) {
      const a = faces[left];
      const b = faces[right];
      if (a.sourcePage !== b.sourcePage || a.orientation !== b.orientation) continue;
      const overlapStart = Math.max(a.start, b.start);
      const overlapEnd = Math.min(a.end, b.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      const shorter = Math.max(0.000001, Math.min(a.end - a.start, b.end - b.start));
      if (overlap / shorter < minBuilderOverlap) continue;
      const thickness = Math.abs(a.fixed - b.fixed);
      if (thickness < minThickness || thickness > maxThickness) continue;
      if (overlap < minLength) continue;
      candidates.push({
        id: `raster-wall-system-${a.id}-${b.id}`,
        orientation: a.orientation,
        coordinate: (a.fixed + b.fixed) / 2,
        thickness,
        start: overlapStart,
        end: overlapEnd,
        faceIds: [a.id, b.id],
      });
    }
  }

  const members: BosRasterPairingGapMember[] = [];
  for (const agreement of input.familyAgreement.agreements) {
    if (agreement.reason !== "no_family_member_agreement") continue;
    const cluster = clusterByRepresentative.get(agreement.representativePairId);
    if (!cluster) continue;
    for (const member of cluster.members) {
      const source = sourceGeometry(member, input);
      const matches = candidates
        .filter((candidate) => candidate.orientation === source.orientation)
        .map((candidate) => ({
          ...candidate,
          coordinateErrorMeters: Math.abs(candidate.coordinate - source.fixed),
          thicknessErrorMeters: Math.abs(candidate.thickness - member.separationMeters),
          sourceSpanCoverageRatio: sourceSpanCoverage(source, candidate.start, candidate.end),
        }))
        .filter((candidate) => candidate.coordinateErrorMeters <= maxCoordinateError
          && candidate.thicknessErrorMeters <= maxThicknessError
          && candidate.sourceSpanCoverageRatio >= minSourceCoverage)
        .sort((a, b) =>
          b.sourceSpanCoverageRatio - a.sourceSpanCoverageRatio
          || a.coordinateErrorMeters - b.coordinateErrorMeters
          || a.thicknessErrorMeters - b.thicknessErrorMeters
          || a.id.localeCompare(b.id));
      const best = matches[0];
      let reason: BosRasterPairingGapReason = "no_matching_raw_pair";
      if (best) {
        if (sheetFrameIds.has(best.id)) reason = "unexpected_selected_support";
        else if (explicitIds.has(best.id)) reason = "sheet_frame_excluded_candidate";
        else if (best.faceIds.some((faceId) => claimedFaces.has(faceId))) reason = "greedy_face_claimed_candidate";
        else reason = "unselected_valid_candidate";
      }
      members.push({
        representativePairId: agreement.representativePairId,
        memberPairId: member.id,
        reason,
        matchingCandidateCount: matches.length,
        bestCandidateId: best?.id ?? null,
        bestCoordinateErrorMeters: best?.coordinateErrorMeters ?? null,
        bestThicknessErrorMeters: best?.thicknessErrorMeters ?? null,
        bestSourceSpanCoverageRatio: best?.sourceSpanCoverageRatio ?? 0,
        bestCandidateFaceIds: best ? [...best.faceIds] : [],
        claimedFaceIds: best ? best.faceIds.filter((faceId) => claimedFaces.has(faceId)) : [],
      });
    }
  }

  const reasonMemberCounts = emptyReasonCounts();
  const familyReasons = new Map<string, Set<BosRasterPairingGapReason>>();
  for (const member of members) {
    reasonMemberCounts[member.reason] += 1;
    const reasons = familyReasons.get(member.representativePairId) ?? new Set<BosRasterPairingGapReason>();
    reasons.add(member.reason);
    familyReasons.set(member.representativePairId, reasons);
  }
  const reasonFamilyCounts = emptyReasonCounts();
  for (const reasons of familyReasons.values()) for (const reason of reasons) reasonFamilyCounts[reason] += 1;

  const baseReport: BosRasterPairingGapDiagnostic = {
    familyCount: familyReasons.size,
    memberCount: members.length,
    reasonMemberCounts,
    reasonFamilyCounts,
    members,
    diagnostics: [
      `Re-enumerated ${candidates.length} raw raster face-pair candidate(s) using the production wall-builder length, thickness, and overlap envelope without applying its greedy face-claim selection.`,
      `${reasonMemberCounts.greedy_face_claimed_candidate} no-agreement source member(s) have a raw pair inside the unchanged ${(maxCoordinateError * 100).toFixed(0)} cm coordinate, ${(maxThicknessError * 100).toFixed(0)} cm thickness, and ${(minSourceCoverage * 100).toFixed(0)}% source-span gates but lose at least one face to another production wall candidate.`,
      `${reasonMemberCounts.no_matching_raw_pair} source member(s) have no raw face pair that satisfies those unchanged hard source-fidelity gates.`,
      `${reasonMemberCounts.sheet_frame_excluded_candidate} matching candidate(s) were built but excluded by sheet-frame filtering; ${reasonMemberCounts.unexpected_selected_support} matching candidate(s) are unexpectedly already present after sheet-frame filtering and require separate consistency review.`,
      "Read-only pairing audit: no candidate is promoted and production pairing, source selection, geometry, thresholds, topology, persistence, canonical data, and 3D output are unchanged.",
    ],
  };
  const conflictProvenance = diagnoseSourcePairRasterConflicts({
    familyAgreement: input.familyAgreement,
    rasterPairingGapDiagnostic: baseReport,
    explicitWallSystems: input.explicitWallSystems,
  });
  const isolatedReplacementSimulation = simulateIsolatedSourceBackedRasterPairReplacements({
    familyAgreement: input.familyAgreement,
    consolidationClusters: input.consolidationClusters,
    conflictProvenance,
    gapMembers: members,
    annotationFilteredSegments: input.annotationFilteredSegments,
    explicitWallSystems: input.explicitWallSystems,
    sourcePixelWidth: input.sourcePixelWidth,
    sourcePixelHeight: input.sourcePixelHeight,
    sourceWidthMeters: input.sourceWidthMeters,
    sourceHeightMeters: input.sourceHeightMeters,
  });
  return { ...baseReport, conflictProvenance, isolatedReplacementSimulation };
}
