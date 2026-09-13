import type { BosDimension } from "./building-graph";
import type { BosGlobalDimensionBoundaryDiagnostic } from "./global-dimension-boundary-diagnostic";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosMissingBoundaryCandidateStage = "structural_selected" | "structural_rejected" | "sheet_frame_rejected";

export type BosMissingBoundaryCandidate = {
  wallId: string;
  coordinate: number;
  endpointDistanceMeters: number;
  thicknessMeters: number;
  lengthMeters: number;
  confidence: number;
  overlapRatio: number;
  faceAPrimitiveId: string;
  faceBPrimitiveId: string;
  stage: BosMissingBoundaryCandidateStage;
};

export type BosMissingBoundaryProbe = {
  dimensionId: string;
  rawText: string;
  sourceAssociationMode: BosRasterDimensionEvidenceAssociation["evidenceMode"];
  axis: "horizontal" | "vertical";
  missingEndpoint: "start" | "end";
  endpointCoordinate: number;
  candidates: BosMissingBoundaryCandidate[];
};

function midpoint(wall: BosWallSystemCandidate) {
  return {
    x: (wall.centerline.start.x + wall.centerline.end.x) / 2,
    y: (wall.centerline.start.y + wall.centerline.end.y) / 2,
  };
}

function wallAngle(wall: BosWallSystemCandidate) {
  let value = Math.atan2(
    wall.centerline.end.y - wall.centerline.start.y,
    wall.centerline.end.x - wall.centerline.start.x,
  );
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}

function angleDelta(a: number, b: number) {
  const raw = Math.abs(a - b);
  return Math.min(raw, Math.PI - raw);
}

function dimensionAngle(association: BosRasterDimensionEvidenceAssociation) {
  return association.orientation === "horizontal" ? 0 : Math.PI / 2;
}

function candidateCoordinate(wall: BosWallSystemCandidate, axis: "horizontal" | "vertical") {
  const center = midpoint(wall);
  return axis === "horizontal" ? center.x : center.y;
}

/**
 * Read-only audit of dimensions whose source axis is known but whose selected wall network has no
 * boundary near one measured end. It probes explicit source-supported wall systems before structural
 * selection so the next phase can distinguish a selector false-negative from genuinely absent wall
 * evidence. It never promotes rejected systems or changes geometry.
 */
export function diagnoseMissingBoundaryProvenance(input: {
  dimensions: readonly BosDimension[];
  associations: readonly BosRasterDimensionEvidenceAssociation[];
  globalDiagnostics: readonly BosGlobalDimensionBoundaryDiagnostic[];
  explicitSystems: readonly BosWallSystemCandidate[];
  sheetFrameRejectedSystemIds: ReadonlySet<string>;
  structuralSelectedSystemIds: ReadonlySet<string>;
  probeRadiusMeters?: number;
  orthogonalToleranceRadians?: number;
}) {
  const probeRadiusMeters = input.probeRadiusMeters ?? 0.5;
  const orthogonalToleranceRadians = input.orthogonalToleranceRadians ?? Math.PI / 180 * 5;
  const dimensionsById = new Map(input.dimensions.map((dimension) => [dimension.id, dimension]));
  const associationsById = new Map(input.associations.map((association) => [association.dimensionId, association]));
  const probes: BosMissingBoundaryProbe[] = [];

  for (const diagnostic of input.globalDiagnostics) {
    if (diagnostic.reason !== "no_boundary_near_start"
      && diagnostic.reason !== "no_boundary_near_end"
      && diagnostic.reason !== "no_boundary_near_either_end") continue;
    const dimension = dimensionsById.get(diagnostic.dimensionId);
    const association = associationsById.get(diagnostic.dimensionId);
    if (!dimension || !association) continue;
    const missingEndpoints: Array<"start" | "end"> = diagnostic.reason === "no_boundary_near_either_end"
      ? ["start", "end"]
      : [diagnostic.reason === "no_boundary_near_start" ? "start" : "end"];
    const axis = association.orientation;
    const da = dimensionAngle(association);
    for (const missingEndpoint of missingEndpoints) {
      const sourcePoint = missingEndpoint === "start" ? association.start : association.end;
      const endpointCoordinate = axis === "horizontal" ? sourcePoint.x : sourcePoint.y;
      const candidates = input.explicitSystems.flatMap((wall) => {
        const delta = angleDelta(wallAngle(wall), da);
        if (Math.abs(delta - Math.PI / 2) > orthogonalToleranceRadians) return [];
        const coordinate = candidateCoordinate(wall, axis);
        const endpointDistanceMeters = Math.abs(coordinate - endpointCoordinate);
        if (endpointDistanceMeters > probeRadiusMeters) return [];
        const stage: BosMissingBoundaryCandidateStage = input.sheetFrameRejectedSystemIds.has(wall.id)
          ? "sheet_frame_rejected"
          : input.structuralSelectedSystemIds.has(wall.id)
            ? "structural_selected"
            : "structural_rejected";
        return [{
          wallId: wall.id,
          coordinate,
          endpointDistanceMeters,
          thicknessMeters: wall.thickness,
          lengthMeters: wall.length,
          confidence: wall.confidence,
          overlapRatio: wall.overlapRatio,
          faceAPrimitiveId: wall.faceA.primitiveId,
          faceBPrimitiveId: wall.faceB.primitiveId,
          stage,
        }];
      }).sort((a, b) => a.endpointDistanceMeters - b.endpointDistanceMeters);
      probes.push({
        dimensionId: dimension.id,
        rawText: dimension.rawText || "",
        sourceAssociationMode: association.evidenceMode,
        axis,
        missingEndpoint,
        endpointCoordinate,
        candidates,
      });
    }
  }

  const recoveredBeforeSelectionCount = probes.filter((probe) => probe.candidates.some((candidate) => candidate.stage === "structural_rejected")).length;
  const absentExplicitBoundaryCount = probes.filter((probe) => probe.candidates.length === 0).length;
  return {
    probes,
    recoveredBeforeSelectionCount,
    absentExplicitBoundaryCount,
    diagnostics: [
      `Missing-boundary provenance diagnostic inspected ${probes.length} source-resolved missing endpoints before structural selection.`,
      `${recoveredBeforeSelectionCount} missing endpoints have at least one explicit source-supported wall system that structural selection rejected.`,
      `${absentExplicitBoundaryCount} missing endpoints have no explicit two-face wall system within ${probeRadiusMeters.toFixed(2)} m.`,
      "This diagnostic is read-only: rejected wall systems remain rejected until independent source evidence justifies a later recovery rule.",
    ],
  };
}
