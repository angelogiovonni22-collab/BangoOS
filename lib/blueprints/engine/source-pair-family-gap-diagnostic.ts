import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosSourcePairGapReason =
  | "no_overlapping_explicit_wall"
  | "coordinate_gate"
  | "thickness_gate"
  | "coordinate_and_thickness_gate"
  | "coupled_coordinate_thickness_gate"
  | "coverage_gate"
  | "unexpected_hard_gate_pass";

export type BosSourcePairGapMember = {
  memberPairId: string;
  reason: BosSourcePairGapReason;
  overlappingWallCount: number;
  coordinateGateCandidateCount: number;
  thicknessGateCandidateCount: number;
  jointGeometryGateCandidateCount: number;
  minimumCoordinateErrorMeters: number | null;
  minimumThicknessErrorMeters: number | null;
  maximumJointGeometryCoverageRatio: number;
  nearestWallId: string | null;
};

export type BosSourcePairGapFamily = {
  representativePairId: string;
  memberCount: number;
  members: BosSourcePairGapMember[];
};

export type BosSourcePairFamilyGapDiagnostic = {
  familyCount: number;
  memberCount: number;
  reasonMemberCounts: Record<BosSourcePairGapReason, number>;
  reasonFamilyCounts: Record<BosSourcePairGapReason, number>;
  families: BosSourcePairGapFamily[];
  diagnostics: string[];
};

type AxisGeometry = {
  orientation: "horizontal" | "vertical";
  fixed: number;
  start: number;
  end: number;
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

function mergeIntervals(intervals: Array<[number, number]>) {
  if (!intervals.length) return [] as Array<[number, number]>;
  const sorted = intervals
    .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];
    if (current[0] <= previous[1] + 1e-9) previous[1] = Math.max(previous[1], current[1]);
    else merged.push([...current] as [number, number]);
  }
  return merged;
}

function coverageRatio(source: AxisGeometry, intervals: Array<[number, number]>) {
  const sourceLength = Math.max(0.000001, source.end - source.start);
  return Math.min(1, mergeIntervals(intervals).reduce((sum, [start, end]) => {
    const overlapStart = Math.max(source.start, start);
    const overlapEnd = Math.min(source.end, end);
    return sum + Math.max(0, overlapEnd - overlapStart);
  }, 0) / sourceLength);
}

function emptyReasonCounts(): Record<BosSourcePairGapReason, number> {
  return {
    no_overlapping_explicit_wall: 0,
    coordinate_gate: 0,
    thickness_gate: 0,
    coordinate_and_thickness_gate: 0,
    coupled_coordinate_thickness_gate: 0,
    coverage_gate: 0,
    unexpected_hard_gate_pass: 0,
  };
}

/**
 * Read-only failure classifier for source-pair families that currently have no passing explicit-wall
 * support. It never relaxes the 2 cm coordinate / 2 cm thickness / 90% coverage gates. Instead it
 * reports which existing gate prevents each original rendered-source member from matching already
 * existing explicit two-face wall systems.
 */
export function diagnoseSourcePairFamilyGaps(input: {
  familyAgreement: BosSourcePairFamilyAgreementDiagnostic;
  consolidationClusters: readonly BosSourceWallPairConsolidationCluster[];
  explicitWallSystems: readonly BosWallSystemCandidate[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  maximumCoordinateErrorMeters?: number;
  maximumThicknessErrorMeters?: number;
  minimumSourceSpanCoverageRatio?: number;
}): BosSourcePairFamilyGapDiagnostic {
  const maxCoordinateError = input.maximumCoordinateErrorMeters ?? 0.02;
  const maxThicknessError = input.maximumThicknessErrorMeters ?? 0.02;
  const minCoverage = input.minimumSourceSpanCoverageRatio ?? 0.9;
  const clusterByRepresentative = new Map(input.consolidationClusters.map((cluster) => [cluster.representativePairId, cluster]));
  const walls = input.explicitWallSystems.map((wall) => ({ wall, geometry: wallGeometry(wall) }));
  const reasonMemberCounts = emptyReasonCounts();
  const reasonFamilyCounts = emptyReasonCounts();
  const families: BosSourcePairGapFamily[] = [];

  for (const agreement of input.familyAgreement.agreements) {
    if (agreement.reason !== "no_family_member_agreement") continue;
    const cluster = clusterByRepresentative.get(agreement.representativePairId);
    if (!cluster) continue;
    const familyReasons = new Set<BosSourcePairGapReason>();
    const members = cluster.members.map((member) => {
      const source = sourceGeometry(member, input);
      const overlapping = walls.filter(({ geometry }) =>
        geometry.orientation === source.orientation
        && Math.min(geometry.end, source.end) > Math.max(geometry.start, source.start));
      const coordinateCandidates = overlapping.filter(({ geometry }) => Math.abs(geometry.fixed - source.fixed) <= maxCoordinateError);
      const thicknessCandidates = overlapping.filter(({ wall }) => Math.abs(wall.thickness - member.separationMeters) <= maxThicknessError);
      const jointCandidates = overlapping.filter(({ wall, geometry }) =>
        Math.abs(geometry.fixed - source.fixed) <= maxCoordinateError
        && Math.abs(wall.thickness - member.separationMeters) <= maxThicknessError);
      const coverage = coverageRatio(source, jointCandidates.map(({ geometry }) => [geometry.start, geometry.end] as [number, number]));
      const nearest = [...overlapping].sort((a, b) => {
        const aScore = Math.abs(a.geometry.fixed - source.fixed) / maxCoordinateError
          + Math.abs(a.wall.thickness - member.separationMeters) / maxThicknessError;
        const bScore = Math.abs(b.geometry.fixed - source.fixed) / maxCoordinateError
          + Math.abs(b.wall.thickness - member.separationMeters) / maxThicknessError;
        return aScore - bScore || a.wall.id.localeCompare(b.wall.id);
      })[0];
      const minimumCoordinateErrorMeters = overlapping.length
        ? Math.min(...overlapping.map(({ geometry }) => Math.abs(geometry.fixed - source.fixed)))
        : null;
      const minimumThicknessErrorMeters = overlapping.length
        ? Math.min(...overlapping.map(({ wall }) => Math.abs(wall.thickness - member.separationMeters)))
        : null;
      let reason: BosSourcePairGapReason;
      if (!overlapping.length) reason = "no_overlapping_explicit_wall";
      else if (jointCandidates.length && coverage >= minCoverage) reason = "unexpected_hard_gate_pass";
      else if (jointCandidates.length) reason = "coverage_gate";
      else if (!coordinateCandidates.length && !thicknessCandidates.length) reason = "coordinate_and_thickness_gate";
      else if (!coordinateCandidates.length) reason = "coordinate_gate";
      else if (!thicknessCandidates.length) reason = "thickness_gate";
      else reason = "coupled_coordinate_thickness_gate";
      reasonMemberCounts[reason] += 1;
      familyReasons.add(reason);
      return {
        memberPairId: member.id,
        reason,
        overlappingWallCount: overlapping.length,
        coordinateGateCandidateCount: coordinateCandidates.length,
        thicknessGateCandidateCount: thicknessCandidates.length,
        jointGeometryGateCandidateCount: jointCandidates.length,
        minimumCoordinateErrorMeters,
        minimumThicknessErrorMeters,
        maximumJointGeometryCoverageRatio: coverage,
        nearestWallId: nearest?.wall.id ?? null,
      };
    });
    for (const reason of familyReasons) reasonFamilyCounts[reason] += 1;
    families.push({ representativePairId: agreement.representativePairId, memberCount: members.length, members });
  }

  const memberCount = Object.values(reasonMemberCounts).reduce((sum, count) => sum + count, 0);
  return {
    familyCount: families.length,
    memberCount,
    reasonMemberCounts,
    reasonFamilyCounts,
    families,
    diagnostics: [
      `Classified ${families.length} no-agreement source family/families and ${memberCount} original rendered-source member(s) against existing explicit wall systems only.`,
      `Hard gates remain unchanged at ${(maxCoordinateError * 100).toFixed(0)} cm coordinate error, ${(maxThicknessError * 100).toFixed(0)} cm thickness error, and ${(minCoverage * 100).toFixed(0)}% source-span coverage.`,
      "Read-only diagnostic: no source representative, wall, topology, threshold, persistence, canonical data, or 3D output is changed.",
    ],
  };
}
