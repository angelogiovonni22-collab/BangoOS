import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosSourceNetworkCoverageGap = {
  pairId: string;
  orientation: "horizontal" | "vertical";
  sourceCoordinateMeters: number;
  sourceSeparationMeters: number;
  sourceLengthMeters: number;
  uncoveredLengthMeters: number;
  uncoveredRatio: number;
  nearestCandidateFaceDistanceMeters: number | null;
  nearestCandidateWallIds: string[];
};

export type BosSourceNetworkCoverageGapDiagnostic = {
  pairCount: number;
  fullyCoveredPairCount: number;
  partiallyCoveredPairCount: number;
  uncoveredPairCount: number;
  reportedGapCount: number;
  totalSourceLengthMeters: number;
  uncoveredLengthMeters: number;
  uncoveredLengthRatio: number;
  gaps: BosSourceNetworkCoverageGap[];
  diagnostics: string[];
};

function intervalOverlap(a0: number, a1: number, b0: number, b1: number) {
  const start = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const end = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  return Math.max(0, end - start);
}

function mergeIntervals(intervals: Array<[number, number]>) {
  if (!intervals.length) return [] as Array<[number, number]>;
  const sorted = intervals.map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];
    if (current[0] <= previous[1]) previous[1] = Math.max(previous[1], current[1]);
    else merged.push([...current] as [number, number]);
  }
  return merged;
}

/**
 * Reports where independently retained rendered-source wall systems are not represented by
 * existing reconstructed wall faces. This is diagnostic only: it does not create, extend,
 * bridge, snap, promote, delete, or persist any geometry.
 */
export function diagnoseSourceNetworkCoverageGaps(input: {
  wallFacePairs: readonly BosSourceWallFacePair[];
  wallSystems: readonly BosWallSystemCandidate[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  faceDistanceToleranceMeters?: number;
  minimumReportedGapMeters?: number;
  maximumReportedGaps?: number;
}): BosSourceNetworkCoverageGapDiagnostic {
  const pxPerMeterX = input.sourcePixelWidth / input.sourceWidthMeters;
  const pxPerMeterY = input.sourcePixelHeight / input.sourceHeightMeters;
  const tolerance = input.faceDistanceToleranceMeters ?? 0.08;
  const minimumGap = input.minimumReportedGapMeters ?? 0.20;
  const maximumReportedGaps = Math.max(1, Math.min(100, input.maximumReportedGaps ?? 40));

  let totalSourceLengthMeters = 0;
  let uncoveredLengthMeters = 0;
  let fullyCoveredPairCount = 0;
  let partiallyCoveredPairCount = 0;
  let uncoveredPairCount = 0;
  const allGaps: BosSourceNetworkCoverageGap[] = [];

  for (const pair of input.wallFacePairs) {
    const horizontal = pair.orientation === "horizontal";
    const fixedScale = horizontal ? pxPerMeterY : pxPerMeterX;
    const movingScale = horizontal ? pxPerMeterX : pxPerMeterY;
    const sourceCoordinate = pair.centerFixedPixel / fixedScale;
    const sourceStart = pair.startPixel / movingScale;
    const sourceEnd = pair.endPixel / movingScale;
    const sourceLength = Math.max(0, sourceEnd - sourceStart);
    totalSourceLengthMeters += sourceLength;

    const coverageIntervals: Array<[number, number]> = [];
    let nearestDistance = Number.POSITIVE_INFINITY;
    const nearestWallIds = new Set<string>();

    for (const wall of input.wallSystems) {
      for (const face of [wall.faceA.line, wall.faceB.line]) {
        const dx = Math.abs(face.end.x - face.start.x);
        const dy = Math.abs(face.end.y - face.start.y);
        const faceHorizontal = dx >= dy;
        if (faceHorizontal !== horizontal) continue;
        const faceFixed = horizontal ? (face.start.y + face.end.y) / 2 : (face.start.x + face.end.x) / 2;
        const distance = Math.abs(faceFixed - sourceCoordinate);
        if (distance < nearestDistance - 1e-9) {
          nearestDistance = distance;
          nearestWallIds.clear();
          nearestWallIds.add(wall.id);
        } else if (Math.abs(distance - nearestDistance) <= 1e-9) nearestWallIds.add(wall.id);
        if (distance > tolerance) continue;
        const faceStart = horizontal ? face.start.x : face.start.y;
        const faceEnd = horizontal ? face.end.x : face.end.y;
        if (intervalOverlap(sourceStart, sourceEnd, faceStart, faceEnd) <= 0) continue;
        coverageIntervals.push([Math.max(sourceStart, Math.min(faceStart, faceEnd)), Math.min(sourceEnd, Math.max(faceStart, faceEnd))]);
      }
    }

    const merged = mergeIntervals(coverageIntervals);
    const coveredLength = merged.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
    const uncoveredLength = Math.max(0, sourceLength - coveredLength);
    const uncoveredRatio = sourceLength > 0 ? uncoveredLength / sourceLength : 0;
    uncoveredLengthMeters += uncoveredLength;

    if (uncoveredLength <= 0.001) fullyCoveredPairCount += 1;
    else if (coveredLength > 0) partiallyCoveredPairCount += 1;
    else uncoveredPairCount += 1;

    if (uncoveredLength >= minimumGap) {
      allGaps.push({
        pairId: pair.id,
        orientation: pair.orientation,
        sourceCoordinateMeters: sourceCoordinate,
        sourceSeparationMeters: pair.separationMeters,
        sourceLengthMeters: sourceLength,
        uncoveredLengthMeters: uncoveredLength,
        uncoveredRatio,
        nearestCandidateFaceDistanceMeters: Number.isFinite(nearestDistance) ? nearestDistance : null,
        nearestCandidateWallIds: [...nearestWallIds],
      });
    }
  }

  allGaps.sort((a, b) => b.uncoveredLengthMeters - a.uncoveredLengthMeters || b.uncoveredRatio - a.uncoveredRatio);
  const gaps = allGaps.slice(0, maximumReportedGaps);
  const uncoveredLengthRatio = totalSourceLengthMeters > 0 ? uncoveredLengthMeters / totalSourceLengthMeters : 0;
  return {
    pairCount: input.wallFacePairs.length,
    fullyCoveredPairCount,
    partiallyCoveredPairCount,
    uncoveredPairCount,
    reportedGapCount: allGaps.length,
    totalSourceLengthMeters,
    uncoveredLengthMeters,
    uncoveredLengthRatio,
    gaps,
    diagnostics: [
      `Source-network gap diagnostic inspected ${input.wallFacePairs.length} retained rendered-source wall pairs.`,
      `${fullyCoveredPairCount} are fully represented, ${partiallyCoveredPairCount} are partially represented, and ${uncoveredPairCount} have no reconstructed face within ${(tolerance * 100).toFixed(0)} cm.`,
      `${(uncoveredLengthRatio * 100).toFixed(1)}% of retained source-wall pair length remains uncovered geometrically.`,
      `Reporting the ${gaps.length} largest of ${allGaps.length} source-wall gaps at or above ${minimumGap.toFixed(2)} m to keep benchmark evidence bounded.`,
      "Read-only: this report never creates, extends, bridges, snaps, promotes, deletes, or persists geometry.",
    ],
  };
}
