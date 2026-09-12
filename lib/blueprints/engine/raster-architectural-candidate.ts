import type { BosDimension } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { solveGlobalWallConstraints } from "./global-constraint-solver";
import { selectStructuralRasterWallSystems } from "./raster-structural-selector";
import { buildWallSystemsFromRasterFaces } from "./raster-wall-system-builder";
import { suppressDimensionAnnotationDetections, type WallAnnotationZone } from "./wall-detector";

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

export function buildRasterArchitecturalCandidate(input: {
  segments: readonly BosRawSegment[];
  dimensions: readonly BosDimension[];
  drawingUnitsPerMeter: number;
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
  const annotationFiltered = suppressDimensionAnnotationDetections(rawSegments, zones);
  const explicitSystems = buildWallSystemsFromRasterFaces(annotationFiltered);
  const structuralSelection = selectStructuralRasterWallSystems(explicitSystems);
  const constrained = solveGlobalWallConstraints(structuralSelection.wallSystems, input.dimensions);
  return {
    rawSegments,
    annotationFiltered,
    zones,
    explicitSystems,
    structuralSelection,
    constrained,
  };
}
