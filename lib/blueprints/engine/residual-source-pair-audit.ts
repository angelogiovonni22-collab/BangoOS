import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosResidualSourcePairMatch = {
  pairId: string;
  wallId: string;
  orientation: "horizontal" | "vertical";
  sourceCoordinateMeters: number;
  candidateCoordinateMeters: number;
  coordinateErrorMeters: number;
  sourceThicknessMeters: number;
  candidateThicknessMeters: number;
  thicknessErrorMeters: number;
  sourceLengthMeters: number;
  candidateLengthMeters: number;
  sourceSpanCoverageRatio: number;
};

export type BosResidualSourcePair = {
  pairId: string;
  orientation: "horizontal" | "vertical";
  sourceCoordinateMeters: number;
  sourceThicknessMeters: number;
  sourceStartMeters: number;
  sourceEndMeters: number;
  sourceLengthMeters: number;
  eligibleMatchCount: number;
  eligibleMatches: BosResidualSourcePairMatch[];
  nearestWallId: string | null;
  nearestCoordinateErrorMeters: number | null;
  nearestThicknessErrorMeters: number | null;
  nearestSourceSpanCoverageRatio: number | null;
  reason: "unique_explicit_match" | "ambiguous_explicit_match" | "no_explicit_match";
};

export type BosResidualSourcePairAudit = {
  sourcePairCount: number;
  uniquelyRepresentedPairCount: number;
  ambiguousPairCount: number;
  unmatchedPairCount: number;
  unmatchedSourceLengthMeters: number;
  unmatchedSourceLengthRatio: number;
  pairs: BosResidualSourcePair[];
  diagnostics: string[];
};

type AxisGeometry = {
  orientation: "horizontal" | "vertical";
  fixed: number;
  start: number;
  end: number;
};

function wallGeometry(wall: BosWallSystemCandidate): AxisGeometry {
  const horizontal = Math.abs(wall.centerline.end.x - wall.centerline.start.x) >= Math.abs(wall.centerline.end.y - wall.centerline.start.y);
  return {
    orientation: horizontal ? "horizontal" : "vertical",
    fixed: horizontal
      ? (wall.centerline.start.y + wall.centerline.end.y) / 2
      : (wall.centerline.start.x + wall.centerline.end.x) / 2,
    start: horizontal
      ? Math.min(wall.centerline.start.x, wall.centerline.end.x)
      : Math.min(wall.centerline.start.y, wall.centerline.end.y),
    end: horizontal
      ? Math.max(wall.centerline.start.x, wall.centerline.end.x)
      : Math.max(wall.centerline.start.y, wall.centerline.end.y),
  };
}

function sourceGeometry(pair: BosSourceWallFacePair, input: {
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

function spanCoverage(source: AxisGeometry, candidate: AxisGeometry) {
  const overlap = Math.max(0, Math.min(source.end, candidate.end) - Math.max(source.start, candidate.start));
  const sourceLength = Math.max(0.000001, source.end - source.start);
  return Math.min(1, overlap / sourceLength);
}

/**
 * Audits retained independent rendered-source wall pairs against the explicit two-face wall systems
 * that exist before structural component filtering. This is read-only evidence: it never creates a
 * wall from a source pair, extends an explicit system, bridges a gap, changes thresholds, or writes
 * canonical geometry.
 */
export function auditResidualSourcePairs(input: {
  retainedSourcePairs: readonly BosSourceWallFacePair[];
  explicitWallSystems: readonly BosWallSystemCandidate[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  maximumCoordinateErrorMeters?: number;
  maximumThicknessErrorMeters?: number;
  minimumSourceSpanCoverageRatio?: number;
}): BosResidualSourcePairAudit {
  const maxCoordinateError = input.maximumCoordinateErrorMeters ?? 0.02;
  const maxThicknessError = input.maximumThicknessErrorMeters ?? 0.02;
  const minSourceCoverage = input.minimumSourceSpanCoverageRatio ?? 0.9;
  const walls = input.explicitWallSystems.map((wall) => ({ wall, geometry: wallGeometry(wall) }));
  const pairs: BosResidualSourcePair[] = [];
  let unmatchedSourceLengthMeters = 0;
  let totalSourceLengthMeters = 0;

  for (const pair of input.retainedSourcePairs) {
    const source = sourceGeometry(pair, input);
    const sourceLength = Math.max(0, source.end - source.start);
    totalSourceLengthMeters += sourceLength;
    const eligibleMatches: BosResidualSourcePairMatch[] = [];
    let nearest: BosResidualSourcePairMatch | null = null;
    let nearestScore = Number.POSITIVE_INFINITY;

    for (const { wall, geometry } of walls) {
      if (geometry.orientation !== source.orientation) continue;
      const coordinateErrorMeters = Math.abs(geometry.fixed - source.fixed);
      const thicknessErrorMeters = Math.abs(wall.thickness - pair.separationMeters);
      const sourceSpanCoverageRatio = spanCoverage(source, geometry);
      const match: BosResidualSourcePairMatch = {
        pairId: pair.id,
        wallId: wall.id,
        orientation: source.orientation,
        sourceCoordinateMeters: source.fixed,
        candidateCoordinateMeters: geometry.fixed,
        coordinateErrorMeters,
        sourceThicknessMeters: pair.separationMeters,
        candidateThicknessMeters: wall.thickness,
        thicknessErrorMeters,
        sourceLengthMeters: sourceLength,
        candidateLengthMeters: wall.length,
        sourceSpanCoverageRatio,
      };
      const score = coordinateErrorMeters + thicknessErrorMeters + (1 - sourceSpanCoverageRatio);
      if (score < nearestScore) {
        nearestScore = score;
        nearest = match;
      }
      if (coordinateErrorMeters <= maxCoordinateError
        && thicknessErrorMeters <= maxThicknessError
        && sourceSpanCoverageRatio >= minSourceCoverage) {
        eligibleMatches.push(match);
      }
    }

    const reason = eligibleMatches.length === 1
      ? "unique_explicit_match" as const
      : eligibleMatches.length > 1
        ? "ambiguous_explicit_match" as const
        : "no_explicit_match" as const;
    if (reason === "no_explicit_match") unmatchedSourceLengthMeters += sourceLength;
    pairs.push({
      pairId: pair.id,
      orientation: source.orientation,
      sourceCoordinateMeters: source.fixed,
      sourceThicknessMeters: pair.separationMeters,
      sourceStartMeters: source.start,
      sourceEndMeters: source.end,
      sourceLengthMeters: sourceLength,
      eligibleMatchCount: eligibleMatches.length,
      eligibleMatches,
      nearestWallId: nearest?.wallId ?? null,
      nearestCoordinateErrorMeters: nearest?.coordinateErrorMeters ?? null,
      nearestThicknessErrorMeters: nearest?.thicknessErrorMeters ?? null,
      nearestSourceSpanCoverageRatio: nearest?.sourceSpanCoverageRatio ?? null,
      reason,
    });
  }

  const uniquelyRepresentedPairCount = pairs.filter((pair) => pair.reason === "unique_explicit_match").length;
  const ambiguousPairCount = pairs.filter((pair) => pair.reason === "ambiguous_explicit_match").length;
  const unmatchedPairCount = pairs.filter((pair) => pair.reason === "no_explicit_match").length;
  const unmatchedSourceLengthRatio = totalSourceLengthMeters > 0 ? unmatchedSourceLengthMeters / totalSourceLengthMeters : 0;
  return {
    sourcePairCount: pairs.length,
    uniquelyRepresentedPairCount,
    ambiguousPairCount,
    unmatchedPairCount,
    unmatchedSourceLengthMeters,
    unmatchedSourceLengthRatio,
    pairs,
    diagnostics: [
      `Residual source-pair audit compared ${pairs.length} retained independent source-wall pairs with ${input.explicitWallSystems.length} existing explicit two-face wall systems.`,
      `${uniquelyRepresentedPairCount} source pair(s) have one explicit match, ${ambiguousPairCount} are ambiguous, and ${unmatchedPairCount} have no explicit match within ${(maxCoordinateError * 100).toFixed(0)} cm coordinate, ${(maxThicknessError * 100).toFixed(0)} cm thickness, and ${(minSourceCoverage * 100).toFixed(0)}% source-span coverage gates.`,
      `${(unmatchedSourceLengthRatio * 100).toFixed(1)}% of retained source-pair length has no qualifying explicit two-face system under those hard gates.`,
      "Read-only: unmatched source pairs are diagnostic evidence only and are never converted into walls or persisted geometry.",
    ],
  };
}
