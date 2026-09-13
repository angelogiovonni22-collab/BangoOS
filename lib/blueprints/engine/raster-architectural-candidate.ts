import type { BosDimension } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { solveGlobalWallConstraints } from "./global-constraint-solver";
import { associateRasterDimensionEvidence } from "./raster-dimension-evidence-associator";
import { excludeRasterSheetFrameSystems } from "./raster-sheet-frame";
import { selectStructuralRasterWallSystems } from "./raster-structural-selector";
import { buildWallSystemsFromRasterFaces } from "./raster-wall-system-builder";
import { suppressDimensionAnnotationDetections, type WallAnnotationZone } from "./wall-detector";

const WITNESS_SPAN_MAX_RELATIVE_ERROR = 0.08;

function dimensionAnnotationZones(
  dimensions: readonly BosDimension[],
  drawingUnitsPerMeter: number,
): WallAnnotationZone[] {
  const factor = 1 / drawingUnitsPerMeter;
  return dimensions.flatMap((dimension) => dimension.evidence.flatMap((evidence) => {
    if (!evidence.bbox) return [];
    return [{
      x: evidence.bbox.x * factor,
      y: evidence.bbox.y * factor,
      width: evidence.bbox.width * factor,
      height: evidence.bbox.height * factor,
      padding: 0.3,
    }];
  }));
}

function enforceWitnessSpanEvidenceGate(
  evidence: ReturnType<typeof associateRasterDimensionEvidence>,
  sourceDimensions: readonly BosDimension[],
) {
  const rejectedIds = new Set(evidence.associations
    .filter((association) => association.evidenceMode === "witness_span" && association.relativeLengthError > WITNESS_SPAN_MAX_RELATIVE_ERROR)
    .map((association) => association.dimensionId));
  if (!rejectedIds.size) return evidence;

  const originalById = new Map(sourceDimensions.map((dimension) => [dimension.id, dimension]));
  const associations = evidence.associations.filter((association) => !rejectedIds.has(association.dimensionId));
  const dimensions = evidence.dimensions.map((dimension) => {
    if (!rejectedIds.has(dimension.id)) return dimension;
    const original = originalById.get(dimension.id);
    return original ? {
      ...dimension,
      start: original.start ? { ...original.start } : undefined,
      end: original.end ? { ...original.end } : undefined,
      confidence: original.confidence,
    } : { ...dimension, start: undefined, end: undefined };
  });
  const unresolvedDimensionIds = [...new Set([...evidence.unresolvedDimensionIds, ...rejectedIds])];
  return {
    ...evidence,
    dimensions,
    associations,
    unresolvedDimensionIds,
    witnessSpanAssociationCount: associations.filter((association) => association.evidenceMode === "witness_span").length,
    diagnostics: [
      ...evidence.diagnostics,
      `Witness-span fidelity gate rejected ${rejectedIds.size} source association(s) above ${(WITNESS_SPAN_MAX_RELATIVE_ERROR * 100).toFixed(1)}% printed-length residual before global wall constraints.`,
      "Rejected witness spans remain unresolved; no wall geometry is moved or synthesized.",
    ],
  };
}

export function buildRasterArchitecturalCandidate(input: {
  segments: readonly BosRawSegment[];
  dimensions: readonly BosDimension[];
  drawingUnitsPerMeter: number;
  sourceWidthMeters?: number | null;
  sourceHeightMeters?: number | null;
}) {
  if (!Number.isFinite(input.drawingUnitsPerMeter) || input.drawingUnitsPerMeter <= 0) {
    throw new Error("A verified drawing scale is required before raster architectural candidates can be built.");
  }
  const rawSegments = input.segments.map((segment) => ({
    ...segment,
    start: { ...segment.start },
    end: { ...segment.end },
  }));
  const zones = dimensionAnnotationZones(input.dimensions, input.drawingUnitsPerMeter);
  const dimensionEvidence = enforceWitnessSpanEvidenceGate(associateRasterDimensionEvidence({
    segments: rawSegments,
    dimensions: input.dimensions,
    drawingUnitsPerMeter: input.drawingUnitsPerMeter,
  }), input.dimensions);
  const annotationFiltered = suppressDimensionAnnotationDetections(rawSegments, zones);
  const explicitSystems = buildWallSystemsFromRasterFaces(annotationFiltered);
  const sheetFrameSelection = excludeRasterSheetFrameSystems(
    explicitSystems,
    input.sourceWidthMeters,
    input.sourceHeightMeters,
  );
  const structuralSelection = selectStructuralRasterWallSystems(sheetFrameSelection.wallSystems);
  const constrained = solveGlobalWallConstraints(structuralSelection.wallSystems, dimensionEvidence.dimensions);
  return {
    rawSegments,
    annotationFiltered,
    zones,
    dimensionEvidence,
    explicitSystems,
    sheetFrameSelection,
    structuralSelection,
    constrained,
  };
}
