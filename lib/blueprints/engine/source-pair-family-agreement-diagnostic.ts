import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosSourcePairFamilyMemberAgreement = {
  memberPairId: string;
  sourceCoordinateMeters: number;
  sourceThicknessMeters: number;
  sourceLengthMeters: number;
  coordinateErrorMeters: number | null;
  thicknessErrorMeters: number | null;
  sourceSpanCoverageRatio: number;
  supportingWallIds: string[];
  passed: boolean;
};

export type BosSourcePairFamilyAgreement = {
  representativePairId: string;
  memberCount: number;
  passingMemberCount: number;
  equivalentPassingGeometryCount: number;
  recommendedMemberPairId: string | null;
  reason: "unique_family_member_agreement" | "ambiguous_family_member_agreement" | "no_family_member_agreement" | "missing_family";
  members: BosSourcePairFamilyMemberAgreement[];
};

export type BosSourcePairFamilyAgreementDiagnostic = {
  retainedPairCount: number;
  uniqueAgreementCount: number;
  ambiguousAgreementCount: number;
  noAgreementCount: number;
  missingFamilyCount: number;
  agreements: BosSourcePairFamilyAgreement[];
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
  const merged = mergeIntervals(intervals);
  const covered = merged.reduce((sum, [start, end]) => {
    const overlapStart = Math.max(source.start, start);
    const overlapEnd = Math.min(source.end, end);
    return sum + Math.max(0, overlapEnd - overlapStart);
  }, 0);
  return Math.min(1, covered / sourceLength);
}

function supportSignature(member: BosSourcePairFamilyMemberAgreement) {
  return [...new Set(member.supportingWallIds)].sort().join("|");
}

/**
 * Tests each retained source-network representative against every original rendered-source pair in
 * its source-only consolidation family. Candidate walls may cover a long source member in multiple
 * collinear segments, but every supporting segment must independently satisfy the existing 2 cm
 * coordinate and thickness gates. Passing raster variants are equivalent only when they resolve to
 * the same existing explicit two-face wall support. This never relaxes the hard fidelity gates and
 * never changes the independently selected source representative or reconstruction geometry.
 */
export function diagnoseSourcePairFamilyAgreement(input: {
  retainedSourcePairs: readonly BosSourceWallFacePair[];
  consolidationClusters: readonly BosSourceWallPairConsolidationCluster[];
  explicitWallSystems: readonly BosWallSystemCandidate[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  maximumCoordinateErrorMeters?: number;
  maximumThicknessErrorMeters?: number;
  minimumSourceSpanCoverageRatio?: number;
}): BosSourcePairFamilyAgreementDiagnostic {
  const maxCoordinateError = input.maximumCoordinateErrorMeters ?? 0.02;
  const maxThicknessError = input.maximumThicknessErrorMeters ?? 0.02;
  const minCoverage = input.minimumSourceSpanCoverageRatio ?? 0.9;
  const clusterByRepresentative = new Map(input.consolidationClusters.map((cluster) => [cluster.representativePairId, cluster]));
  const wallGeometries = input.explicitWallSystems.map((wall) => ({ wall, geometry: wallGeometry(wall) }));
  const agreements: BosSourcePairFamilyAgreement[] = [];

  for (const representative of input.retainedSourcePairs) {
    const cluster = clusterByRepresentative.get(representative.id);
    if (!cluster) {
      agreements.push({
        representativePairId: representative.id,
        memberCount: 0,
        passingMemberCount: 0,
        equivalentPassingGeometryCount: 0,
        recommendedMemberPairId: null,
        reason: "missing_family",
        members: [],
      });
      continue;
    }

    const members: BosSourcePairFamilyMemberAgreement[] = cluster.members.map((member) => {
      const source = sourceGeometry(member, input);
      const supporting = wallGeometries.filter(({ wall, geometry }) =>
        geometry.orientation === source.orientation
        && Math.abs(geometry.fixed - source.fixed) <= maxCoordinateError
        && Math.abs(wall.thickness - member.separationMeters) <= maxThicknessError
        && Math.min(geometry.end, source.end) > Math.max(geometry.start, source.start));
      const intervals = supporting.map(({ geometry }) => [geometry.start, geometry.end] as [number, number]);
      const sourceSpanCoverageRatio = coverageRatio(source, intervals);
      const coordinateErrorMeters = supporting.length
        ? Math.max(...supporting.map(({ geometry }) => Math.abs(geometry.fixed - source.fixed)))
        : null;
      const thicknessErrorMeters = supporting.length
        ? Math.max(...supporting.map(({ wall }) => Math.abs(wall.thickness - member.separationMeters)))
        : null;
      return {
        memberPairId: member.id,
        sourceCoordinateMeters: source.fixed,
        sourceThicknessMeters: member.separationMeters,
        sourceLengthMeters: Math.max(0, source.end - source.start),
        coordinateErrorMeters,
        thicknessErrorMeters,
        sourceSpanCoverageRatio,
        supportingWallIds: supporting.map(({ wall }) => wall.id),
        passed: supporting.length > 0 && sourceSpanCoverageRatio >= minCoverage,
      };
    });

    const passing = members.filter((member) => member.passed);
    const geometryGroups = new Map<string, BosSourcePairFamilyMemberAgreement[]>();
    for (const member of passing) {
      const signature = supportSignature(member);
      if (!signature) continue;
      geometryGroups.set(signature, [...(geometryGroups.get(signature) || []), member]);
    }
    const groupedPassing = [...geometryGroups.values()];
    const reason = groupedPassing.length === 1
      ? "unique_family_member_agreement" as const
      : groupedPassing.length > 1
        ? "ambiguous_family_member_agreement" as const
        : "no_family_member_agreement" as const;
    const recommended = reason === "unique_family_member_agreement"
      ? [...groupedPassing[0]].sort((a, b) =>
          b.sourceSpanCoverageRatio - a.sourceSpanCoverageRatio
          || b.sourceLengthMeters - a.sourceLengthMeters
          || (a.coordinateErrorMeters ?? Number.POSITIVE_INFINITY) - (b.coordinateErrorMeters ?? Number.POSITIVE_INFINITY)
          || (a.thicknessErrorMeters ?? Number.POSITIVE_INFINITY) - (b.thicknessErrorMeters ?? Number.POSITIVE_INFINITY))[0]
      : null;
    agreements.push({
      representativePairId: representative.id,
      memberCount: members.length,
      passingMemberCount: passing.length,
      equivalentPassingGeometryCount: groupedPassing.length,
      recommendedMemberPairId: recommended?.memberPairId ?? null,
      reason,
      members,
    });
  }

  const uniqueAgreementCount = agreements.filter((agreement) => agreement.reason === "unique_family_member_agreement").length;
  const ambiguousAgreementCount = agreements.filter((agreement) => agreement.reason === "ambiguous_family_member_agreement").length;
  const noAgreementCount = agreements.filter((agreement) => agreement.reason === "no_family_member_agreement").length;
  const missingFamilyCount = agreements.filter((agreement) => agreement.reason === "missing_family").length;
  return {
    retainedPairCount: input.retainedSourcePairs.length,
    uniqueAgreementCount,
    ambiguousAgreementCount,
    noAgreementCount,
    missingFamilyCount,
    agreements,
    diagnostics: [
      `Source-pair family agreement inspected ${input.retainedSourcePairs.length} independently retained source-wall representative(s) without changing source selection.`,
      `${uniqueAgreementCount} representative family/families resolve to one existing explicit-wall support set with every passing member covered >= ${(minCoverage * 100).toFixed(0)}% and independently inside the ${(maxCoordinateError * 100).toFixed(0)} cm coordinate and ${(maxThicknessError * 100).toFixed(0)} cm thickness gates.`,
      `${ambiguousAgreementCount} family/families resolve to multiple materially different explicit-wall support sets and remain ambiguous; ${noAgreementCount} have no passing member; ${missingFamilyCount} are missing consolidation provenance.`,
      "Raster variants supported by the same existing two-face wall IDs are treated as one agreement; hard coordinate, thickness, and coverage gates are unchanged.",
      "Read-only: source-family members are diagnostic evidence only; no source representative, wall, topology, threshold, or canonical data is changed.",
    ],
  };
}
