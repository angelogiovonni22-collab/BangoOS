import type { BosDimension } from "./building-graph";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosBoundaryFamilyCandidate = {
  wallId: string;
  coordinate: number;
  endpointDistanceMeters: number;
  thicknessMeters: number;
  lengthMeters: number;
  confidence: number;
  faceAPrimitiveId: string;
  faceBPrimitiveId: string;
  overlapRatio: number;
};

export type BosBoundaryFamilyProvenanceDiagnostic = {
  dimensionId: string;
  rawText?: string;
  sourceAssociationMode: BosRasterDimensionEvidenceAssociation["evidenceMode"];
  axis: "horizontal" | "vertical";
  startCoordinate: number;
  endCoordinate: number;
  startCandidates: BosBoundaryFamilyCandidate[];
  endCandidates: BosBoundaryFamilyCandidate[];
};

export type BosBoundaryFamilyProvenanceDiagnosticResult = {
  dimensions: BosBoundaryFamilyProvenanceDiagnostic[];
  ambiguousEndpointCount: number;
  emptyEndpointCount: number;
  diagnostics: string[];
};

function angle(line: { start: { x: number; y: number }; end: { x: number; y: number } }) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}
function angleDelta(a: number, b: number) {
  const delta = Math.abs(a - b);
  return Math.min(delta, Math.PI - delta);
}
function midpoint(line: { start: { x: number; y: number }; end: { x: number; y: number } }) {
  return { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 };
}
function dimensionAxis(dimension: BosDimension): "horizontal" | "vertical" | null {
  if (!dimension.start || !dimension.end) return null;
  return Math.abs(dimension.end.x - dimension.start.x) >= Math.abs(dimension.end.y - dimension.start.y) ? "horizontal" : "vertical";
}
function candidateCoordinate(wall: BosWallSystemCandidate, axis: "horizontal" | "vertical") {
  const center = midpoint(wall.centerline);
  return axis === "horizontal" ? center.x : center.y;
}
function asCandidate(wall: BosWallSystemCandidate, coordinate: number, endpointCoordinate: number): BosBoundaryFamilyCandidate {
  return {
    wallId: wall.id,
    coordinate,
    endpointDistanceMeters: Math.abs(coordinate - endpointCoordinate),
    thicknessMeters: wall.thickness,
    lengthMeters: wall.length,
    confidence: wall.confidence,
    faceAPrimitiveId: wall.faceA.primitiveId,
    faceBPrimitiveId: wall.faceB.primitiveId,
    overlapRatio: wall.overlapRatio,
  };
}

/**
 * Read-only provenance view for boundary candidates around independently source-resolved dimension endpoints.
 * It exposes the exact wall-system IDs and face-pair provenance that create missing/ambiguous boundary families,
 * without changing selection, clustering, solver tolerances, or canonical geometry.
 */
export function diagnoseBoundaryFamilyProvenance(input: {
  wallSystems: readonly BosWallSystemCandidate[];
  dimensions: readonly BosDimension[];
  associations: readonly BosRasterDimensionEvidenceAssociation[];
  matchedDimensionIds: ReadonlySet<string>;
  probeRadiusMeters?: number;
  orthogonalToleranceRadians?: number;
}): BosBoundaryFamilyProvenanceDiagnosticResult {
  const probeRadiusMeters = input.probeRadiusMeters ?? 0.5;
  const orthogonalToleranceRadians = input.orthogonalToleranceRadians ?? Math.PI / 180 * 5;
  const dimensionById = new Map(input.dimensions.map((dimension) => [dimension.id, dimension]));
  const dimensions = input.associations.flatMap((association): BosBoundaryFamilyProvenanceDiagnostic[] => {
    if (input.matchedDimensionIds.has(association.dimensionId)) return [];
    const dimension = dimensionById.get(association.dimensionId);
    if (!dimension?.start || !dimension.end) return [];
    const axis = dimensionAxis(dimension);
    if (!axis) return [];
    const dimensionAngle = angle({ start: dimension.start, end: dimension.end });
    const startCoordinate = axis === "horizontal" ? dimension.start.x : dimension.start.y;
    const endCoordinate = axis === "horizontal" ? dimension.end.x : dimension.end.y;
    const eligible = input.wallSystems.filter((wall) => {
      const delta = angleDelta(angle(wall.centerline), dimensionAngle);
      return Math.abs(delta - Math.PI / 2) <= orthogonalToleranceRadians;
    });
    const collect = (endpointCoordinate: number) => eligible
      .map((wall) => ({ wall, coordinate: candidateCoordinate(wall, axis) }))
      .filter((item) => Math.abs(item.coordinate - endpointCoordinate) <= probeRadiusMeters)
      .map((item) => asCandidate(item.wall, item.coordinate, endpointCoordinate))
      .sort((a, b) => a.endpointDistanceMeters - b.endpointDistanceMeters || b.confidence - a.confidence);
    return [{
      dimensionId: dimension.id,
      rawText: dimension.rawText,
      sourceAssociationMode: association.evidenceMode,
      axis,
      startCoordinate,
      endCoordinate,
      startCandidates: collect(startCoordinate),
      endCandidates: collect(endCoordinate),
    }];
  });

  const endpoints = dimensions.flatMap((item) => [item.startCandidates, item.endCandidates]);
  const ambiguousEndpointCount = endpoints.filter((items) => items.length > 1).length;
  const emptyEndpointCount = endpoints.filter((items) => items.length === 0).length;
  return {
    dimensions,
    ambiguousEndpointCount,
    emptyEndpointCount,
    diagnostics: [
      `Boundary-family provenance diagnostic inspected ${dimensions.length} source-resolved but globally unmatched dimensions within ${probeRadiusMeters.toFixed(2)} m of each endpoint.`,
      `${ambiguousEndpointCount} endpoints have multiple candidate wall systems and ${emptyEndpointCount} endpoints have no candidate wall system in the probe radius.`,
      "Wall IDs, centerline coordinates, thicknesses, lengths, confidence, overlap, and source face primitive IDs are exposed read-only so duplicate wall-system families can be distinguished from truly missing geometry.",
    ],
  };
}
