import type { BosDimension } from "./building-graph";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";

export type BosIndependentBoundaryFamily = {
  coordinate: number;
  nearestEndpointDistanceMeters: number;
  pairIds: string[];
};

export type BosIndependentDimensionBoundaryReason =
  | "unique_independent_boundary_pair"
  | "no_independent_boundary_near_start"
  | "no_independent_boundary_near_end"
  | "no_independent_boundary_near_either_end"
  | "ambiguous_independent_boundary_pair"
  | "independent_boundary_span_residual_too_high";

export type BosIndependentDimensionBoundaryDiagnostic = {
  dimensionId: string;
  rawText: string;
  axis: "horizontal" | "vertical";
  startCoordinate: number;
  endCoordinate: number;
  startFamilies: BosIndependentBoundaryFamily[];
  endFamilies: BosIndependentBoundaryFamily[];
  passingPairs: Array<{
    startCoordinate: number;
    endCoordinate: number;
    measuredSpanMeters: number;
    relativeSpanError: number;
  }>;
  recommendedStartCoordinate: number | null;
  recommendedEndCoordinate: number | null;
  reason: BosIndependentDimensionBoundaryReason;
};

function axisCoordinate(point: { x: number; y: number }, axis: "horizontal" | "vertical") {
  return axis === "horizontal" ? point.x : point.y;
}

function pairCoordinate(input: {
  pair: BosSourceWallFacePair;
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
}) {
  const fixedScale = input.pair.orientation === "vertical"
    ? input.sourcePixelWidth / input.sourceWidthMeters
    : input.sourcePixelHeight / input.sourceHeightMeters;
  return input.pair.centerFixedPixel / fixedScale;
}

function clusterFamilies(input: {
  coordinates: Array<{ coordinate: number; distance: number; pairId: string }>;
  clusterToleranceMeters: number;
}) {
  const sorted = [...input.coordinates].sort((a, b) => a.coordinate - b.coordinate);
  const groups: Array<Array<{ coordinate: number; distance: number; pairId: string }>> = [];
  for (const candidate of sorted) {
    const current = groups[groups.length - 1];
    if (!current || Math.abs(candidate.coordinate - current[current.length - 1].coordinate) > input.clusterToleranceMeters) {
      groups.push([candidate]);
    } else {
      current.push(candidate);
    }
  }
  return groups.map((group): BosIndependentBoundaryFamily => {
    const representative = [...group].sort((a, b) => a.distance - b.distance || a.coordinate - b.coordinate)[0];
    return {
      coordinate: representative.coordinate,
      nearestEndpointDistanceMeters: representative.distance,
      pairIds: group.map((item) => item.pairId),
    };
  }).sort((a, b) => a.nearestEndpointDistanceMeters - b.nearestEndpointDistanceMeters);
}

/**
 * Read-only diagnostic that asks whether the independently rendered source-wall network supports
 * the measured endpoints of source-resolved dimensions. It uses only retained source wall-face pairs,
 * never reconstructed wall IDs, and does not move or create geometry.
 */
export function diagnoseIndependentSourceDimensionBoundaries(input: {
  dimensions: readonly BosDimension[];
  associations: readonly BosRasterDimensionEvidenceAssociation[];
  dimensionIds: ReadonlySet<string>;
  wallFacePairs: readonly BosSourceWallFacePair[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  probeRadiusMeters?: number;
  endpointAlignmentMeters?: number;
  familyClusterToleranceMeters?: number;
  maximumRelativeSpanError?: number;
}) {
  const probeRadiusMeters = input.probeRadiusMeters ?? 0.5;
  const endpointAlignmentMeters = input.endpointAlignmentMeters ?? 0.32;
  const familyClusterToleranceMeters = input.familyClusterToleranceMeters ?? 0.08;
  const maximumRelativeSpanError = input.maximumRelativeSpanError ?? 0.08;
  const dimensionsById = new Map(input.dimensions.map((dimension) => [dimension.id, dimension]));
  const diagnostics: BosIndependentDimensionBoundaryDiagnostic[] = [];

  for (const association of input.associations) {
    if (!input.dimensionIds.has(association.dimensionId)) continue;
    const dimension = dimensionsById.get(association.dimensionId);
    if (!dimension) continue;
    const axis = association.orientation;
    const boundaryOrientation = axis === "horizontal" ? "vertical" : "horizontal";
    const startCoordinate = axisCoordinate(association.start, axis);
    const endCoordinate = axisCoordinate(association.end, axis);

    const near = (endpointCoordinate: number) => clusterFamilies({
      coordinates: input.wallFacePairs.flatMap((pair) => {
        if (pair.orientation !== boundaryOrientation) return [];
        const coordinate = pairCoordinate({
          pair,
          sourcePixelWidth: input.sourcePixelWidth,
          sourcePixelHeight: input.sourcePixelHeight,
          sourceWidthMeters: input.sourceWidthMeters,
          sourceHeightMeters: input.sourceHeightMeters,
        });
        const distance = Math.abs(coordinate - endpointCoordinate);
        return distance <= probeRadiusMeters ? [{ coordinate, distance, pairId: pair.id }] : [];
      }),
      clusterToleranceMeters: familyClusterToleranceMeters,
    });

    const startFamilies = near(startCoordinate);
    const endFamilies = near(endCoordinate);
    const eligibleStart = startFamilies.filter((family) => family.nearestEndpointDistanceMeters <= endpointAlignmentMeters);
    const eligibleEnd = endFamilies.filter((family) => family.nearestEndpointDistanceMeters <= endpointAlignmentMeters);
    const passingPairs = eligibleStart.flatMap((start) => eligibleEnd.flatMap((end) => {
      if (Math.abs(start.coordinate - end.coordinate) <= familyClusterToleranceMeters) return [];
      const measuredSpanMeters = Math.abs(end.coordinate - start.coordinate);
      const relativeSpanError = Math.abs(measuredSpanMeters - dimension.value) / Math.max(dimension.value, 0.001);
      if (relativeSpanError > maximumRelativeSpanError) return [];
      return [{ startCoordinate: start.coordinate, endCoordinate: end.coordinate, measuredSpanMeters, relativeSpanError }];
    }));

    let reason: BosIndependentDimensionBoundaryReason;
    let recommendedStartCoordinate: number | null = null;
    let recommendedEndCoordinate: number | null = null;
    if (!eligibleStart.length && !eligibleEnd.length) reason = "no_independent_boundary_near_either_end";
    else if (!eligibleStart.length) reason = "no_independent_boundary_near_start";
    else if (!eligibleEnd.length) reason = "no_independent_boundary_near_end";
    else if (!passingPairs.length) reason = "independent_boundary_span_residual_too_high";
    else if (passingPairs.length > 1) reason = "ambiguous_independent_boundary_pair";
    else {
      reason = "unique_independent_boundary_pair";
      recommendedStartCoordinate = passingPairs[0].startCoordinate;
      recommendedEndCoordinate = passingPairs[0].endCoordinate;
    }

    diagnostics.push({
      dimensionId: dimension.id,
      rawText: dimension.rawText || "",
      axis,
      startCoordinate,
      endCoordinate,
      startFamilies,
      endFamilies,
      passingPairs: passingPairs.sort((a, b) => a.relativeSpanError - b.relativeSpanError),
      recommendedStartCoordinate,
      recommendedEndCoordinate,
      reason,
    });
  }

  const uniquePairCount = diagnostics.filter((diagnostic) => diagnostic.reason === "unique_independent_boundary_pair").length;
  return {
    dimensions: diagnostics,
    uniquePairCount,
    diagnostics: [
      `Independent source-network boundary diagnostic inspected ${diagnostics.length} source-resolved unmatched dimensions.`,
      `${uniquePairCount} have exactly one rendered-source boundary pair within the existing ${endpointAlignmentMeters.toFixed(2)} m endpoint and ${(maximumRelativeSpanError * 100).toFixed(1)}% span gates.`,
      "Read-only: retained source-wall evidence is reported without moving, promoting, or creating geometry.",
    ],
  };
}
