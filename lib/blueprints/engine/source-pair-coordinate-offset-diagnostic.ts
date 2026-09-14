import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosWallSystemCandidate } from "./wall-system-builder";

type Orientation = "horizontal" | "vertical";

type AxisGeometry = {
  orientation: Orientation;
  fixed: number;
  start: number;
  end: number;
};

export type BosSourcePairCoordinateOffsetObservation = {
  representativePairId: string;
  memberPairId: string;
  orientation: Orientation;
  sourceCoordinateMeters: number;
  sourceThicknessMeters: number;
  wallId: string;
  wallCoordinateMeters: number;
  wallThicknessMeters: number;
  signedOffsetMeters: number;
  absoluteOffsetMeters: number;
  thicknessErrorMeters: number;
  overlapRatio: number;
};

export type BosSourcePairCoordinateOffsetBucket = {
  orientation: Orientation;
  offsetMeters: number;
  toleranceMeters: number;
  observationCount: number;
  familyCount: number;
  wallCount: number;
  medianSignedOffsetMeters: number;
  minSignedOffsetMeters: number;
  maxSignedOffsetMeters: number;
};

export type BosSourcePairCoordinateOffsetDiagnostic = {
  observationCount: number;
  familyCount: number;
  horizontalObservationCount: number;
  verticalObservationCount: number;
  medianSignedOffsetMeters: { horizontal: number | null; vertical: number | null };
  buckets: BosSourcePairCoordinateOffsetBucket[];
  observations: BosSourcePairCoordinateOffsetObservation[];
  diagnostics: string[];
};

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

function intervalOverlapRatio(a: AxisGeometry, b: AxisGeometry) {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  const overlap = Math.max(0, end - start);
  return overlap / Math.max(0.000001, a.end - a.start);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function bucketize(observations: BosSourcePairCoordinateOffsetObservation[], toleranceMeters: number) {
  const remaining = [...observations].sort((a, b) => a.signedOffsetMeters - b.signedOffsetMeters || a.memberPairId.localeCompare(b.memberPairId));
  const buckets: BosSourcePairCoordinateOffsetBucket[] = [];
  while (remaining.length) {
    const seed = remaining.shift()!;
    const group = [seed];
    let changed = true;
    while (changed) {
      changed = false;
      const center = median(group.map((item) => item.signedOffsetMeters)) ?? seed.signedOffsetMeters;
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        const candidate = remaining[index];
        if (candidate.orientation !== seed.orientation) continue;
        if (Math.abs(candidate.signedOffsetMeters - center) <= toleranceMeters) {
          group.push(candidate);
          remaining.splice(index, 1);
          changed = true;
        }
      }
    }
    const offsets = group.map((item) => item.signedOffsetMeters);
    buckets.push({
      orientation: seed.orientation,
      offsetMeters: median(offsets) ?? seed.signedOffsetMeters,
      toleranceMeters,
      observationCount: group.length,
      familyCount: new Set(group.map((item) => item.representativePairId)).size,
      wallCount: new Set(group.map((item) => item.wallId)).size,
      medianSignedOffsetMeters: median(offsets) ?? seed.signedOffsetMeters,
      minSignedOffsetMeters: Math.min(...offsets),
      maxSignedOffsetMeters: Math.max(...offsets),
    });
  }
  return buckets.sort((a, b) => b.observationCount - a.observationCount || b.familyCount - a.familyCount || a.offsetMeters - b.offsetMeters);
}

/**
 * Read-only coordinate registration diagnostic. It inspects only source-family members that have no
 * current hard-gate agreement and pairs them with overlapping existing explicit walls that already
 * satisfy the unmodified thickness gate. The signed fixed-axis offsets are evidence for or against a
 * systematic source-vs-explicit coordinate registration bias. It never applies an offset or changes
 * source selection, walls, thresholds, topology, persistence, canonical geometry, or 3D output.
 */
export function diagnoseSourcePairCoordinateOffsets(input: {
  familyAgreement: BosSourcePairFamilyAgreementDiagnostic;
  consolidationClusters: readonly BosSourceWallPairConsolidationCluster[];
  explicitWallSystems: readonly BosWallSystemCandidate[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  maximumThicknessErrorMeters?: number;
  minimumOverlapRatio?: number;
  offsetBucketToleranceMeters?: number;
}): BosSourcePairCoordinateOffsetDiagnostic {
  const maxThicknessError = input.maximumThicknessErrorMeters ?? 0.02;
  const minOverlap = input.minimumOverlapRatio ?? 0.5;
  const bucketTolerance = input.offsetBucketToleranceMeters ?? 0.02;
  const clusterByRepresentative = new Map(input.consolidationClusters.map((cluster) => [cluster.representativePairId, cluster]));
  const walls = input.explicitWallSystems.map((wall) => ({ wall, geometry: wallGeometry(wall) }));
  const observations: BosSourcePairCoordinateOffsetObservation[] = [];

  for (const agreement of input.familyAgreement.agreements) {
    if (agreement.reason !== "no_family_member_agreement") continue;
    const cluster = clusterByRepresentative.get(agreement.representativePairId);
    if (!cluster) continue;
    for (const member of cluster.members) {
      const source = sourceGeometry(member, input);
      const candidates = walls
        .filter(({ wall, geometry }) => geometry.orientation === source.orientation
          && Math.abs(wall.thickness - member.separationMeters) <= maxThicknessError
          && intervalOverlapRatio(source, geometry) >= minOverlap)
        .map(({ wall, geometry }) => ({
          wall,
          geometry,
          overlapRatio: intervalOverlapRatio(source, geometry),
          signedOffsetMeters: geometry.fixed - source.fixed,
          thicknessErrorMeters: Math.abs(wall.thickness - member.separationMeters),
        }))
        .sort((a, b) =>
          Math.abs(a.signedOffsetMeters) - Math.abs(b.signedOffsetMeters)
          || b.overlapRatio - a.overlapRatio
          || a.thicknessErrorMeters - b.thicknessErrorMeters
          || a.wall.id.localeCompare(b.wall.id));
      const best = candidates[0];
      if (!best) continue;
      observations.push({
        representativePairId: agreement.representativePairId,
        memberPairId: member.id,
        orientation: source.orientation,
        sourceCoordinateMeters: source.fixed,
        sourceThicknessMeters: member.separationMeters,
        wallId: best.wall.id,
        wallCoordinateMeters: best.geometry.fixed,
        wallThicknessMeters: best.wall.thickness,
        signedOffsetMeters: best.signedOffsetMeters,
        absoluteOffsetMeters: Math.abs(best.signedOffsetMeters),
        thicknessErrorMeters: best.thicknessErrorMeters,
        overlapRatio: best.overlapRatio,
      });
    }
  }

  const horizontal = observations.filter((item) => item.orientation === "horizontal");
  const vertical = observations.filter((item) => item.orientation === "vertical");
  return {
    observationCount: observations.length,
    familyCount: new Set(observations.map((item) => item.representativePairId)).size,
    horizontalObservationCount: horizontal.length,
    verticalObservationCount: vertical.length,
    medianSignedOffsetMeters: {
      horizontal: median(horizontal.map((item) => item.signedOffsetMeters)),
      vertical: median(vertical.map((item) => item.signedOffsetMeters)),
    },
    buckets: bucketize(observations, bucketTolerance),
    observations,
    diagnostics: [
      `Inspected ${observations.length} no-agreement rendered-source member(s) with an overlapping existing explicit wall that independently satisfies the ${(maxThicknessError * 100).toFixed(0)} cm thickness gate and at least ${(minOverlap * 100).toFixed(0)}% source-span overlap.`,
      `Signed fixed-axis offsets are grouped within ${(bucketTolerance * 100).toFixed(0)} cm only for read-only registration diagnosis; the original coordinate gate is not changed or bypassed.`,
      "A repeated signed offset across multiple source families and distinct explicit wall IDs is evidence of a possible coordinate-frame registration bias; isolated offsets are not sufficient evidence for correction.",
      "Read-only diagnostic: no offset is applied and no source representative, wall, topology, threshold, persistence, canonical data, or 3D output is changed.",
    ],
  };
}
