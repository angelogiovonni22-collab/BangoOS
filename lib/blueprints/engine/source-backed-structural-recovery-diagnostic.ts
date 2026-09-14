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
  overlapRatio: number;
  directSourcePixelSupport: number;
};

export type BosSourceBackedStructuralRecoveryDiagnostic = {
  rejectedWallCount: number;
  sourcePairCount: number;
  strictlyMatchedRejectedWallCount: number;
  uniquelyRecoverableWallCount: number;
  ambiguousRejectedWallCount: number;
  uniquelyRecoverableWallIds: string[];
  candidates: BosSourceBackedStructuralRecoveryCandidate[];
  diagnostics: string[];
};

function wallGeometry(wall: BosWallSystemCandidate) {
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
}) {
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

function overlapRatio(a0: number, a1: number, b0: number, b1: number) {
  const overlap = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const denominator = Math.max(0.000001, Math.min(a1 - a0, b1 - b0));
  return overlap / denominator;
}

/**
 * Finds structurally rejected explicit two-face wall systems that already have strict independent
 * rendered-source support. This is evidence only: it never promotes walls, changes selector
 * thresholds, bridges gaps, moves geometry, applies constraints, or persists canonical data.
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
  minimumOverlapRatio?: number;
  minimumDirectSourceSupport?: number;
}): BosSourceBackedStructuralRecoveryDiagnostic {
  const maxCoordinateError = input.maximumCoordinateErrorMeters ?? 0.02;
  const maxThicknessError = input.maximumThicknessErrorMeters ?? 0.02;
  const minOverlap = input.minimumOverlapRatio ?? 0.9;
  const minSupport = input.minimumDirectSourceSupport ?? 0.95;
  const selectedIds = new Set(input.selectedWallSystems.map((wall) => wall.id));
  const rejected = input.preselectionWallSystems.filter((wall) => !selectedIds.has(wall.id));
  const pairGeometries = input.retainedSourcePairs.map((pair) => ({
    pair,
    geometry: pairGeometry(pair, input),
  }));
  const candidates: BosSourceBackedStructuralRecoveryCandidate[] = [];
  const matchesByWall = new Map<string, BosSourceBackedStructuralRecoveryCandidate[]>();
  const matchesByPair = new Map<string, BosSourceBackedStructuralRecoveryCandidate[]>();

  for (const wall of rejected) {
    const support = input.directSourceSupportByWallId.get(wall.id) ?? 0;
    if (support < minSupport) continue;
    const wallShape = wallGeometry(wall);
    for (const { pair, geometry } of pairGeometries) {
      if (geometry.orientation !== wallShape.orientation) continue;
      const coordinateError = Math.abs(wallShape.fixed - geometry.fixed);
      if (coordinateError > maxCoordinateError) continue;
      const thicknessError = Math.abs(wall.thickness - pair.separationMeters);
      if (thicknessError > maxThicknessError) continue;
      const spanOverlap = overlapRatio(wallShape.start, wallShape.end, geometry.start, geometry.end);
      if (spanOverlap < minOverlap) continue;
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
        overlapRatio: spanOverlap,
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

  return {
    rejectedWallCount: rejected.length,
    sourcePairCount: input.retainedSourcePairs.length,
    strictlyMatchedRejectedWallCount: matchesByWall.size,
    uniquelyRecoverableWallCount: uniquelyRecoverable.length,
    ambiguousRejectedWallCount,
    uniquelyRecoverableWallIds: uniquelyRecoverable.map(([wallId]) => wallId),
    candidates,
    diagnostics: [
      `Source-backed structural recovery diagnostic inspected ${rejected.length} structurally rejected explicit wall systems against ${input.retainedSourcePairs.length} retained independent source-wall pairs.`,
      `${matchesByWall.size} rejected wall system(s) have >= ${(minSupport * 100).toFixed(0)}% direct source-pixel support plus <= ${(maxCoordinateError * 100).toFixed(0)} cm coordinate error, <= ${(maxThicknessError * 100).toFixed(0)} cm thickness error, and >= ${(minOverlap * 100).toFixed(0)}% source-span overlap.`,
      `${uniquelyRecoverable.length} rejected wall system(s) have a one-to-one retained source-pair match; ${ambiguousRejectedWallCount} matched wall system(s) remain ambiguous and are not recommended.`,
      "Read-only: no rejected wall is promoted, no selector threshold changes, no geometry is moved or synthesized, and canonical data is untouched.",
    ],
  };
}
