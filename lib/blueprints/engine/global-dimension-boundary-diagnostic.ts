import type { BosDimension, BosLine2 } from "./building-graph";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosGlobalDimensionBoundaryDiagnosticReason =
  | "matched_global_constraint"
  | "no_eligible_boundary_families"
  | "no_boundary_near_either_end"
  | "no_boundary_near_start"
  | "no_boundary_near_end"
  | "ambiguous_boundary_at_both_ends"
  | "ambiguous_boundary_at_start"
  | "ambiguous_boundary_at_end"
  | "same_boundary_family"
  | "boundary_span_residual_too_high"
  | "unique_boundary_span_would_match";

export type BosGlobalDimensionBoundaryDiagnostic = {
  dimensionId: string;
  rawText?: string;
  value: number;
  sourceAssociationMode: BosRasterDimensionEvidenceAssociation["evidenceMode"];
  reason: BosGlobalDimensionBoundaryDiagnosticReason;
  boundaryFamilyCount: number;
  startCandidateCount: number;
  endCandidateCount: number;
  startNearestDistanceMeters: number | null;
  endNearestDistanceMeters: number | null;
  measuredBoundarySpanMeters: number | null;
  relativeSpanError: number | null;
};

export type BosGlobalDimensionBoundaryDiagnosticResult = {
  dimensions: BosGlobalDimensionBoundaryDiagnostic[];
  reasonCounts: Record<BosGlobalDimensionBoundaryDiagnosticReason, number>;
  dominantUnmatchedReason: BosGlobalDimensionBoundaryDiagnosticReason | null;
  diagnostics: string[];
};

export type BosGlobalDimensionBoundaryDiagnosticOptions = {
  orthogonalToleranceRadians?: number;
  boundaryAlignmentToleranceMeters?: number;
  boundaryClusterToleranceMeters?: number;
  boundaryAmbiguityGapMeters?: number;
  maxRelativeSpanError?: number;
};

type BoundaryCluster = { coordinate: number; wallIds: string[] };
type RankedBoundary = { cluster: BoundaryCluster; distance: number };

function midpoint(line: BosLine2) {
  return { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 };
}
function angle(line: BosLine2) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}
function angleDelta(a: number, b: number) {
  const delta = Math.abs(a - b);
  return Math.min(delta, Math.PI - delta);
}
function dimensionAxis(dimension: BosDimension): "horizontal" | "vertical" | null {
  if (!dimension.start || !dimension.end) return null;
  return Math.abs(dimension.end.x - dimension.start.x) >= Math.abs(dimension.end.y - dimension.start.y) ? "horizontal" : "vertical";
}
function boundaryCoordinate(wall: BosWallSystemCandidate, axis: "horizontal" | "vertical") {
  const center = midpoint(wall.centerline);
  return axis === "horizontal" ? center.x : center.y;
}

function buildBoundaryClusters(input: {
  wallSystems: readonly BosWallSystemCandidate[];
  dimensionAngle: number;
  axis: "horizontal" | "vertical";
  orthogonalTolerance: number;
  clusterTolerance: number;
}) {
  const eligible = input.wallSystems.filter((wall) => {
    const delta = angleDelta(angle(wall.centerline), input.dimensionAngle);
    return Math.abs(delta - Math.PI / 2) <= input.orthogonalTolerance * 2;
  }).map((wall) => ({ wall, coordinate: boundaryCoordinate(wall, input.axis) }))
    .sort((left, right) => left.coordinate - right.coordinate);
  const clusters: BoundaryCluster[] = [];
  for (const item of eligible) {
    const current = clusters[clusters.length - 1];
    if (!current || Math.abs(item.coordinate - current.coordinate) > input.clusterTolerance) {
      clusters.push({ coordinate: item.coordinate, wallIds: [item.wall.id] });
      continue;
    }
    const count = current.wallIds.length;
    current.coordinate = (current.coordinate * count + item.coordinate) / (count + 1);
    current.wallIds.push(item.wall.id);
  }
  return clusters;
}

function rankBoundaries(clusters: readonly BoundaryCluster[], coordinate: number, maxDistance: number): RankedBoundary[] {
  return clusters.map((cluster) => ({ cluster, distance: Math.abs(cluster.coordinate - coordinate) }))
    .filter((item) => item.distance <= maxDistance)
    .sort((left, right) => left.distance - right.distance);
}
function isAmbiguous(ranked: readonly RankedBoundary[], ambiguityGap: number) {
  return Boolean(ranked[1] && ranked[1].distance - ranked[0].distance < ambiguityGap);
}

const ALL_REASONS: BosGlobalDimensionBoundaryDiagnosticReason[] = [
  "matched_global_constraint",
  "no_eligible_boundary_families",
  "no_boundary_near_either_end",
  "no_boundary_near_start",
  "no_boundary_near_end",
  "ambiguous_boundary_at_both_ends",
  "ambiguous_boundary_at_start",
  "ambiguous_boundary_at_end",
  "same_boundary_family",
  "boundary_span_residual_too_high",
  "unique_boundary_span_would_match",
];

/**
 * Read-only explanation of why a source-resolved printed dimension does or does not reach the
 * global boundary-span constraint stage. It mirrors the solver's boundary-family tolerances but
 * never changes walls, dimensions, source associations, or canonical Building Graph geometry.
 */
export function diagnoseGlobalDimensionBoundaries(input: {
  wallSystems: readonly BosWallSystemCandidate[];
  dimensions: readonly BosDimension[];
  associations: readonly BosRasterDimensionEvidenceAssociation[];
  matchedDimensionIds: ReadonlySet<string>;
  options?: BosGlobalDimensionBoundaryDiagnosticOptions;
}): BosGlobalDimensionBoundaryDiagnosticResult {
  const orthogonalTolerance = input.options?.orthogonalToleranceRadians ?? Math.PI / 180 * 2.5;
  const boundaryAlignmentTolerance = input.options?.boundaryAlignmentToleranceMeters ?? 0.32;
  const boundaryClusterTolerance = input.options?.boundaryClusterToleranceMeters ?? 0.08;
  const boundaryAmbiguityGap = input.options?.boundaryAmbiguityGapMeters ?? 0.06;
  const maxRelativeSpanError = input.options?.maxRelativeSpanError ?? 0.08;
  const dimensionById = new Map(input.dimensions.map((dimension) => [dimension.id, dimension]));

  const dimensions = input.associations.flatMap((association): BosGlobalDimensionBoundaryDiagnostic[] => {
    const dimension = dimensionById.get(association.dimensionId);
    if (!dimension || !dimension.start || !dimension.end || !(dimension.value > 0)) return [];
    if (input.matchedDimensionIds.has(dimension.id)) {
      return [{
        dimensionId: dimension.id,
        rawText: dimension.rawText,
        value: dimension.value,
        sourceAssociationMode: association.evidenceMode,
        reason: "matched_global_constraint",
        boundaryFamilyCount: 0,
        startCandidateCount: 0,
        endCandidateCount: 0,
        startNearestDistanceMeters: null,
        endNearestDistanceMeters: null,
        measuredBoundarySpanMeters: null,
        relativeSpanError: null,
      }];
    }

    const axis = dimensionAxis(dimension);
    if (!axis) return [];
    const dimensionAngle = angle({ start: dimension.start, end: dimension.end });
    const clusters = buildBoundaryClusters({
      wallSystems: input.wallSystems,
      dimensionAngle,
      axis,
      orthogonalTolerance,
      clusterTolerance: boundaryClusterTolerance,
    });
    const startCoordinate = axis === "horizontal" ? dimension.start.x : dimension.start.y;
    const endCoordinate = axis === "horizontal" ? dimension.end.x : dimension.end.y;
    const startRanked = rankBoundaries(clusters, startCoordinate, boundaryAlignmentTolerance);
    const endRanked = rankBoundaries(clusters, endCoordinate, boundaryAlignmentTolerance);
    const startAmbiguous = isAmbiguous(startRanked, boundaryAmbiguityGap);
    const endAmbiguous = isAmbiguous(endRanked, boundaryAmbiguityGap);
    const startBest = startRanked[0] || null;
    const endBest = endRanked[0] || null;

    let reason: BosGlobalDimensionBoundaryDiagnosticReason;
    let measuredBoundarySpanMeters: number | null = null;
    let relativeSpanError: number | null = null;
    if (!clusters.length) reason = "no_eligible_boundary_families";
    else if (!startBest && !endBest) reason = "no_boundary_near_either_end";
    else if (!startBest) reason = "no_boundary_near_start";
    else if (!endBest) reason = "no_boundary_near_end";
    else if (startAmbiguous && endAmbiguous) reason = "ambiguous_boundary_at_both_ends";
    else if (startAmbiguous) reason = "ambiguous_boundary_at_start";
    else if (endAmbiguous) reason = "ambiguous_boundary_at_end";
    else if (startBest.cluster === endBest.cluster) reason = "same_boundary_family";
    else {
      measuredBoundarySpanMeters = Math.abs(endBest.cluster.coordinate - startBest.cluster.coordinate);
      relativeSpanError = Math.abs(measuredBoundarySpanMeters - dimension.value) / Math.max(dimension.value, 0.001);
      reason = relativeSpanError <= maxRelativeSpanError ? "unique_boundary_span_would_match" : "boundary_span_residual_too_high";
    }

    return [{
      dimensionId: dimension.id,
      rawText: dimension.rawText,
      value: dimension.value,
      sourceAssociationMode: association.evidenceMode,
      reason,
      boundaryFamilyCount: clusters.length,
      startCandidateCount: startRanked.length,
      endCandidateCount: endRanked.length,
      startNearestDistanceMeters: startBest?.distance ?? null,
      endNearestDistanceMeters: endBest?.distance ?? null,
      measuredBoundarySpanMeters,
      relativeSpanError,
    }];
  });

  const reasonCounts = Object.fromEntries(ALL_REASONS.map((reason) => [reason, dimensions.filter((item) => item.reason === reason).length])) as Record<BosGlobalDimensionBoundaryDiagnosticReason, number>;
  const unmatchedReasons = ALL_REASONS.filter((reason) => reason !== "matched_global_constraint");
  const dominantUnmatchedReason = unmatchedReasons.sort((left, right) => reasonCounts[right] - reasonCounts[left])[0] || null;
  const sourceResolvedCount = dimensions.length;
  const matchedCount = reasonCounts.matched_global_constraint;
  return {
    dimensions,
    reasonCounts,
    dominantUnmatchedReason: dominantUnmatchedReason && reasonCounts[dominantUnmatchedReason] > 0 ? dominantUnmatchedReason : null,
    diagnostics: [
      `Global dimension boundary diagnostic classified ${sourceResolvedCount} source-resolved dimensions without changing candidate or canonical geometry.`,
      `${matchedCount} source-resolved dimensions already reach a global dimension constraint; ${sourceResolvedCount - matchedCount} remain unmatched.`,
      dominantUnmatchedReason && reasonCounts[dominantUnmatchedReason] > 0
        ? `Dominant source-resolved global-boundary failure is ${dominantUnmatchedReason} (${reasonCounts[dominantUnmatchedReason]} dimensions).`
        : "No source-resolved global-boundary failure remains.",
      `Boundary-family probes mirror the solver's ${boundaryAlignmentTolerance.toFixed(2)} m endpoint alignment, ${boundaryClusterTolerance.toFixed(2)} m family clustering, ${boundaryAmbiguityGap.toFixed(2)} m ambiguity gap, and ${(maxRelativeSpanError * 100).toFixed(1)}% span residual gate.`,
    ],
  };
}
