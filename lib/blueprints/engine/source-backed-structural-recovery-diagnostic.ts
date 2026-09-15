import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosSourceBackedStructuralRecoveryCandidate = {
  wallId: string;
  pairId: string;
  orientation: "horizontal" | "vertical";
  candidateCoordinateMeters: number;
  sourceCoordinateMeters: number;
  coordinateErrorMeters: number;
  candidateThicknessMeters: number;
  sourceThicknessMeters: number;
  thicknessErrorMeters: number;
  candidateLengthMeters: number;
  sourceLengthMeters: number;
  candidateCoverageRatio: number;
  directSourcePixelSupport: number;
};

export type BosSourceBackedStructuralCompositeRecoveryCandidate = {
  wallId: string;
  pairIds: string[];
  orientation: "horizontal" | "vertical";
  candidateLengthMeters: number;
  candidateCoverageRatio: number;
  nonRedundantCoverageRatio: number;
  maximumCoordinateErrorMeters: number;
  maximumThicknessErrorMeters: number;
  directSourcePixelSupport: number;
};

export type BosSourceBackedStructuralRecoveryDiagnostic = {
  rejectedWallCount: number;
  sourcePairCount: number;
  strictlyMatchedRejectedWallCount: number;
  uniquelyRecoverableWallCount: number;
  ambiguousRejectedWallCount: number;
  uniquelyRecoverableWallIds: string[];
  compositeRecoverableWallCount: number;
  compositeRecoverableWallIds: string[];
  candidates: BosSourceBackedStructuralRecoveryCandidate[];
  compositeCandidates: BosSourceBackedStructuralCompositeRecoveryCandidate[];
  diagnostics: string[];
};

type AxisGeometry = {
  orientation: "horizontal" | "vertical";
  fixed: number;
  start: number;
  end: number;
};

function wallGeometry(wall: BosWallSystemCandidate): AxisGeometry {
  const dx = Math.abs(wall.centerline.end.x - wall.centerline.start.x);
  const dy = Math.abs(wall.centerline.end.y - wall.centerline.start.y);
  const horizontal = dx >= dy;
  return {
    orientation: horizontal ? "horizontal" as const : "vertical" as const,
    fixed: horizontal
      ? (wall.centerline.start.y + wall.centerline.end.y) / 2
      : (wall.centerline.start.x + wall.centerline.end.x) / 2,
    start: horizontal ? Math.min(wall.centerline.start.x, wall.centerline.end.x) : Math.min(wall.centerline.start.y, wall.centerline.end.y),
    end: horizontal ? Math.max(wall.centerline.start.x, wall.centerline.end.x) : Math.max(wall.centerline.start.y, wall.centerline.end.y),
  };
}

function pairGeometry(pair: BosSourceWallFacePair, input: {
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
}): AxisGeometry {
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

function candidateCoverageRatio(candidateStart: number, candidateEnd: number, sourceStart: number, sourceEnd: number) {
  const overlap = Math.max(0, Math.min(candidateEnd, sourceEnd) - Math.max(candidateStart, sourceStart));
  const candidateLength = Math.max(0.000001, candidateEnd - candidateStart);
  return overlap / candidateLength;
}

function clippedOverlapInterval(candidate: AxisGeometry, source: AxisGeometry) {
  const start = Math.max(candidate.start, source.start);
  const end = Math.min(candidate.end, source.end);
  return end > start ? { start, end } : null;
}

function intervalUnionLength(intervals: readonly { start: number; end: number }[]) {
  if (!intervals.length) return 0;
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  let total = 0;
  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;
  for (let index = 1; index < sorted.length; index += 1) {
    const interval = sorted[index];
    if (interval.start <= currentEnd) currentEnd = Math.max(currentEnd, interval.end);
    else {
      total += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }
  return total + (currentEnd - currentStart);
}

/**
 * Finds structurally rejected explicit two-face wall systems that already have strict independent
 * rendered-source support. This is evidence only: it never promotes walls, changes selector
 * thresholds, bridges gaps, moves geometry, applies constraints, or persists canonical data.
 *
 * A second fail-closed path allows multiple independent retained source pairs to prove one existing
 * rejected wall only when their clipped spans collectively cover the candidate, are mostly
 * non-redundant, and every contributing source pair is unique to that rejected wall. This preserves
 * the exact existing wall geometry and does not infer a wall across unsupported space.
 */
export function diagnoseSourceBackedStructuralRecovery(input: {
  preselectionWallSystems: readonly BosWallSystemCandidate[];
  selectedWallSystems: readonly BosWallSystemCandidate[];
  retainedSourcePairs: readonly BosSourceWallFacePair[];
  directSourceSupportByWallId: ReadonlyMap<string, number>;
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  maximumCoordinateErrorMeters?: number;
  maximumThicknessErrorMeters?: number;
  minimumCandidateCoverageRatio?: number;
  minimumDirectSourceSupport?: number;
  minimumCompositeNonRedundantRatio?: number;
}): BosSourceBackedStructuralRecoveryDiagnostic {
  const maxCoordinateError = input.maximumCoordinateErrorMeters ?? 0.02;
  const maxThicknessError = input.maximumThicknessErrorMeters ?? 0.02;
  const minCoverage = input.minimumCandidateCoverageRatio ?? 0.9;
  const minSupport = input.minimumDirectSourceSupport ?? 0.95;
  const minCompositeNonRedundantRatio = input.minimumCompositeNonRedundantRatio ?? 0.8;
  const selectedIds = new Set(input.selectedWallSystems.map((wall) => wall.id));
  const rejected = input.preselectionWallSystems.filter((wall) => !selectedIds.has(wall.id));
  const pairGeometries = input.retainedSourcePairs.map((pair) => ({ pair, geometry: pairGeometry(pair, input) }));
  const candidates: BosSourceBackedStructuralRecoveryCandidate[] = [];
  const matchesByWall = new Map<string, BosSourceBackedStructuralRecoveryCandidate[]>();
  const matchesByPair = new Map<string, BosSourceBackedStructuralRecoveryCandidate[]>();
  const compatiblePairIdsByWall = new Map<string, string[]>();
  const compatibleWallIdsByPair = new Map<string, string[]>();
  const geometryByWallId = new Map(rejected.map((wall) => [wall.id, wallGeometry(wall)]));

  for (const wall of rejected) {
    const support = input.directSourceSupportByWallId.get(wall.id) ?? 0;
    if (support < minSupport) continue;
    const wallShape = geometryByWallId.get(wall.id)!;
    for (const { pair, geometry } of pairGeometries) {
      if (geometry.orientation !== wallShape.orientation) continue;
      const coordinateError = Math.abs(wallShape.fixed - geometry.fixed);
      if (coordinateError > maxCoordinateError) continue;
      const thicknessError = Math.abs(wall.thickness - pair.separationMeters);
      if (thicknessError > maxThicknessError) continue;
      const clipped = clippedOverlapInterval(wallShape, geometry);
      if (!clipped) continue;
      compatiblePairIdsByWall.set(wall.id, [...(compatiblePairIdsByWall.get(wall.id) ?? []), pair.id]);
      compatibleWallIdsByPair.set(pair.id, [...(compatibleWallIdsByPair.get(pair.id) ?? []), wall.id]);
      const coverage = candidateCoverageRatio(wallShape.start, wallShape.end, geometry.start, geometry.end);
      if (coverage < minCoverage) continue;
      const candidate: BosSourceBackedStructuralRecoveryCandidate = {
        wallId: wall.id,
        pairId: pair.id,
        orientation: wallShape.orientation,
        candidateCoordinateMeters: wallShape.fixed,
        sourceCoordinateMeters: geometry.fixed,
        coordinateErrorMeters: coordinateError,
        candidateThicknessMeters: wall.thickness,
        sourceThicknessMeters: pair.separationMeters,
        thicknessErrorMeters: thicknessError,
        candidateLengthMeters: wall.length,
        sourceLengthMeters: pair.lengthMeters,
        candidateCoverageRatio: coverage,
        directSourcePixelSupport: support,
      };
      candidates.push(candidate);
      matchesByWall.set(wall.id, [...(matchesByWall.get(wall.id) ?? []), candidate]);
      matchesByPair.set(pair.id, [...(matchesByPair.get(pair.id) ?? []), candidate]);
    }
  }

  const uniquelyRecoverable = [...matchesByWall.entries()].filter(([, wallMatches]) =>
    wallMatches.length === 1 && (matchesByPair.get(wallMatches[0].pairId)?.length ?? 0) === 1);
  const ambiguousRejectedWallCount = [...matchesByWall.values()].filter((wallMatches) =>
    wallMatches.length !== 1 || (matchesByPair.get(wallMatches[0].pairId)?.length ?? 0) !== 1).length;

  const compositeCandidates: BosSourceBackedStructuralCompositeRecoveryCandidate[] = [];
  for (const wall of rejected) {
    const support = input.directSourceSupportByWallId.get(wall.id) ?? 0;
    if (support < minSupport) continue;
    const wallShape = geometryByWallId.get(wall.id)!;
    const pairIds = [...new Set(compatiblePairIdsByWall.get(wall.id) ?? [])];
    if (pairIds.length < 2) continue;
    if (pairIds.some((pairId) => (compatibleWallIdsByPair.get(pairId)?.length ?? 0) !== 1)) continue;

    const contributing = pairGeometries.filter(({ pair }) => pairIds.includes(pair.id)).map(({ pair, geometry }) => {
      const interval = clippedOverlapInterval(wallShape, geometry)!;
      return {
        pair,
        geometry,
        interval,
        coordinateErrorMeters: Math.abs(wallShape.fixed - geometry.fixed),
        thicknessErrorMeters: Math.abs(wall.thickness - pair.separationMeters),
      };
    });
    const intervals = contributing.map((item) => item.interval);
    const unionLength = intervalUnionLength(intervals);
    const summedLength = intervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
    const candidateLength = Math.max(0.000001, wallShape.end - wallShape.start);
    const candidateCoverageRatioValue = unionLength / candidateLength;
    const nonRedundantCoverageRatio = summedLength > 0 ? unionLength / summedLength : 0;
    if (candidateCoverageRatioValue < minCoverage || nonRedundantCoverageRatio < minCompositeNonRedundantRatio) continue;

    compositeCandidates.push({
      wallId: wall.id,
      pairIds: contributing.map((item) => item.pair.id).sort(),
      orientation: wallShape.orientation,
      candidateLengthMeters: wall.length,
      candidateCoverageRatio: candidateCoverageRatioValue,
      nonRedundantCoverageRatio,
      maximumCoordinateErrorMeters: Math.max(...contributing.map((item) => item.coordinateErrorMeters)),
      maximumThicknessErrorMeters: Math.max(...contributing.map((item) => item.thicknessErrorMeters)),
      directSourcePixelSupport: support,
    });
  }

  const oneToOneIds = new Set(uniquelyRecoverable.map(([wallId]) => wallId));
  const compositeRecoverableWallIds = compositeCandidates
    .map((candidate) => candidate.wallId)
    .filter((wallId) => !oneToOneIds.has(wallId));

  return {
    rejectedWallCount: rejected.length,
    sourcePairCount: input.retainedSourcePairs.length,
    strictlyMatchedRejectedWallCount: matchesByWall.size,
    uniquelyRecoverableWallCount: uniquelyRecoverable.length,
    ambiguousRejectedWallCount,
    uniquelyRecoverableWallIds: uniquelyRecoverable.map(([wallId]) => wallId),
    compositeRecoverableWallCount: compositeRecoverableWallIds.length,
    compositeRecoverableWallIds,
    candidates,
    compositeCandidates: compositeCandidates.filter((candidate) => !oneToOneIds.has(candidate.wallId)),
    diagnostics: [
      `Source-backed structural recovery diagnostic inspected ${rejected.length} structurally rejected explicit wall systems against ${input.retainedSourcePairs.length} retained independent source-wall pairs.`,
      `${matchesByWall.size} rejected wall system(s) have >= ${(minSupport * 100).toFixed(0)}% direct source-pixel support plus <= ${(maxCoordinateError * 100).toFixed(0)} cm coordinate error, <= ${(maxThicknessError * 100).toFixed(0)} cm thickness error, and >= ${(minCoverage * 100).toFixed(0)}% candidate-length coverage by one retained source pair.`,
      `${uniquelyRecoverable.length} rejected wall system(s) have a one-to-one retained source-pair match; ${ambiguousRejectedWallCount} single-pair matched wall system(s) remain ambiguous and are not recommended by that path.`,
      `${compositeRecoverableWallIds.length} additional rejected wall system(s) are covered by multiple pair-unique, mostly non-redundant retained source spans without changing the existing wall geometry.`,
      "Read-only: no rejected wall is promoted, no selector threshold changes, no geometry is moved or synthesized, and canonical data is untouched.",
    ],
  };
}
