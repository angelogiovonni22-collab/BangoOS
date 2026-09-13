import type { BosDimension, BosLine2, BosPoint2 } from "./building-graph";
import type { BosMissingBoundaryProbe } from "./missing-boundary-provenance-diagnostic";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosDimensionBackedBoundaryRecoveryCandidate = {
  wallId: string;
  missingEndpointDistanceMeters: number;
  measuredSpanMeters: number;
  relativeSpanError: number;
  connectedSelectedWallCount: number;
  score: number;
};

export type BosDimensionBackedBoundaryRecoveryDiagnostic = {
  dimensionId: string;
  rawText: string;
  missingEndpoint: "start" | "end";
  oppositeBoundaryCoordinate: number | null;
  candidates: BosDimensionBackedBoundaryRecoveryCandidate[];
  recommendedWallId: string | null;
  reason: "unique_source_supported_recovery" | "no_opposite_selected_boundary" | "no_eligible_rejected_boundary" | "ambiguous_recovery";
};

function midpoint(line: BosLine2) {
  return { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 };
}
function distance(a: BosPoint2, b: BosPoint2) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angle(line: BosLine2) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}
function angleDelta(a: number, b: number) {
  const raw = Math.abs(a - b);
  return Math.min(raw, Math.PI - raw);
}
function finiteProjection(point: BosPoint2, line: BosLine2) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const size = dx * dx + dy * dy;
  if (size <= Number.EPSILON) return null;
  const t = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / size;
  if (t < 0 || t > 1) return null;
  const projected = { x: line.start.x + t * dx, y: line.start.y + t * dy };
  return { distance: distance(point, projected) };
}
function minEndpointDistance(a: BosLine2, b: BosLine2) {
  return Math.min(
    distance(a.start, b.start), distance(a.start, b.end),
    distance(a.end, b.start), distance(a.end, b.end),
  );
}
function parallelMetrics(a: BosLine2, b: BosLine2) {
  const theta = angle(a);
  const axis = { x: Math.cos(theta), y: Math.sin(theta) };
  const normal = { x: -axis.y, y: axis.x };
  const project = (point: BosPoint2, direction: BosPoint2) => point.x * direction.x + point.y * direction.y;
  const a0 = project(a.start, axis); const a1 = project(a.end, axis);
  const b0 = project(b.start, axis); const b1 = project(b.end, axis);
  const aMin = Math.min(a0, a1); const aMax = Math.max(a0, a1);
  const bMin = Math.min(b0, b1); const bMax = Math.max(b0, b1);
  const gap = Math.max(0, Math.max(aMin, bMin) - Math.min(aMax, bMax));
  const separation = Math.min(
    Math.abs(project(b.start, normal) - project(a.start, normal)),
    Math.abs(project(b.end, normal) - project(a.end, normal)),
  );
  return { gap, separation };
}

function architecturallyConnected(a: BosWallSystemCandidate, b: BosWallSystemCandidate) {
  if (a.sourcePage !== b.sourcePage) return false;
  const delta = angleDelta(a.orientationRadians, b.orientationRadians);
  const parallelTolerance = Math.PI / 180 * 2.5;
  if (delta > parallelTolerance) {
    const endpointToFinite = Math.min(
      ...[a.centerline.start, a.centerline.end].flatMap((point) => {
        const projection = finiteProjection(point, b.centerline);
        return projection ? [projection.distance] : [];
      }),
      ...[b.centerline.start, b.centerline.end].flatMap((point) => {
        const projection = finiteProjection(point, a.centerline);
        return projection ? [projection.distance] : [];
      }),
      minEndpointDistance(a.centerline, b.centerline),
    );
    return endpointToFinite <= 0.28;
  }
  const metrics = parallelMetrics(a.centerline, b.centerline);
  return metrics.separation <= 0.16 && metrics.gap <= 1.2;
}

function wallCoordinate(wall: BosWallSystemCandidate, axis: "horizontal" | "vertical") {
  const center = midpoint(wall.centerline);
  return axis === "horizontal" ? center.x : center.y;
}

function nearestUniqueSelectedBoundary(input: {
  wallSystems: readonly BosWallSystemCandidate[];
  association: BosRasterDimensionEvidenceAssociation;
  coordinate: number;
}) {
  const dimensionAngle = input.association.orientation === "horizontal" ? 0 : Math.PI / 2;
  const ranked = input.wallSystems.flatMap((wall) => {
    const delta = angleDelta(angle(wall.centerline), dimensionAngle);
    if (Math.abs(delta - Math.PI / 2) > Math.PI / 180 * 5) return [];
    const coordinate = wallCoordinate(wall, input.association.orientation);
    const endpointDistance = Math.abs(coordinate - input.coordinate);
    if (endpointDistance > 0.32) return [];
    return [{ wall, coordinate, endpointDistance }];
  }).sort((a, b) => a.endpointDistance - b.endpointDistance);
  if (!ranked.length) return null;
  if (ranked[1] && ranked[1].endpointDistance - ranked[0].endpointDistance < 0.06) return null;
  return ranked[0];
}

/**
 * Read-only what-if diagnostic. A rejected explicit two-face wall system is considered recoverable
 * only when the existing source dimension axis supplies the missing endpoint, the opposite endpoint
 * has a unique selected boundary, the candidate lies inside the existing 0.32 m alignment gate,
 * its measured span satisfies the existing 8% dimension residual gate, and the wall is connected to
 * the already selected architectural network using the structural selector's existing connectivity
 * tolerances. Competing candidates remain unresolved.
 */
export function diagnoseDimensionBackedBoundaryRecovery(input: {
  dimensions: readonly BosDimension[];
  associations: readonly BosRasterDimensionEvidenceAssociation[];
  missingBoundaryProbes: readonly BosMissingBoundaryProbe[];
  explicitSystems: readonly BosWallSystemCandidate[];
  selectedWallSystems: readonly BosWallSystemCandidate[];
}) {
  const dimensionsById = new Map(input.dimensions.map((dimension) => [dimension.id, dimension]));
  const associationsById = new Map(input.associations.map((association) => [association.dimensionId, association]));
  const explicitById = new Map(input.explicitSystems.map((wall) => [wall.id, wall]));
  const diagnostics: BosDimensionBackedBoundaryRecoveryDiagnostic[] = [];

  for (const probe of input.missingBoundaryProbes) {
    const dimension = dimensionsById.get(probe.dimensionId);
    const association = associationsById.get(probe.dimensionId);
    if (!dimension || !association) continue;
    const oppositePoint = probe.missingEndpoint === "start" ? association.end : association.start;
    const oppositeCoordinate = association.orientation === "horizontal" ? oppositePoint.x : oppositePoint.y;
    const oppositeBoundary = nearestUniqueSelectedBoundary({
      wallSystems: input.selectedWallSystems,
      association,
      coordinate: oppositeCoordinate,
    });
    if (!oppositeBoundary) {
      diagnostics.push({
        dimensionId: probe.dimensionId,
        rawText: probe.rawText,
        missingEndpoint: probe.missingEndpoint,
        oppositeBoundaryCoordinate: null,
        candidates: [],
        recommendedWallId: null,
        reason: "no_opposite_selected_boundary",
      });
      continue;
    }

    const candidates = probe.candidates.flatMap((candidate) => {
      if (candidate.stage !== "structural_rejected" || candidate.endpointDistanceMeters > 0.32) return [];
      const wall = explicitById.get(candidate.wallId);
      if (!wall) return [];
      const connectedSelectedWallCount = input.selectedWallSystems.filter((selected) => architecturallyConnected(wall, selected)).length;
      if (connectedSelectedWallCount === 0) return [];
      const measuredSpanMeters = Math.abs(candidate.coordinate - oppositeBoundary.coordinate);
      const relativeSpanError = Math.abs(measuredSpanMeters - dimension.value) / Math.max(dimension.value, 0.001);
      if (relativeSpanError > 0.08) return [];
      const score = relativeSpanError * 2 + candidate.endpointDistanceMeters / 0.32 + 1 / (1 + connectedSelectedWallCount) * 0.1;
      return [{
        wallId: wall.id,
        missingEndpointDistanceMeters: candidate.endpointDistanceMeters,
        measuredSpanMeters,
        relativeSpanError,
        connectedSelectedWallCount,
        score,
      }];
    }).sort((a, b) => a.score - b.score);

    let recommendedWallId: string | null = null;
    let reason: BosDimensionBackedBoundaryRecoveryDiagnostic["reason"] = "no_eligible_rejected_boundary";
    if (candidates.length) {
      if (!candidates[1] || candidates[1].score - candidates[0].score >= 0.05) {
        recommendedWallId = candidates[0].wallId;
        reason = "unique_source_supported_recovery";
      } else {
        reason = "ambiguous_recovery";
      }
    }
    diagnostics.push({
      dimensionId: probe.dimensionId,
      rawText: probe.rawText,
      missingEndpoint: probe.missingEndpoint,
      oppositeBoundaryCoordinate: oppositeBoundary.coordinate,
      candidates,
      recommendedWallId,
      reason,
    });
  }

  const recommendedRecoveryCount = diagnostics.filter((item) => item.reason === "unique_source_supported_recovery").length;
  return {
    dimensions: diagnostics,
    recommendedRecoveryCount,
    diagnostics: [
      `Dimension-backed boundary recovery diagnostic found ${recommendedRecoveryCount} uniquely supported rejected wall systems across ${diagnostics.length} missing endpoints.`,
      "No rejected wall was promoted; the diagnostic preserves all existing selector and dimension tolerances and is read-only.",
    ],
  };
}
