import type { BosBuildingGraph, BosDimension } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { topologyMetrics } from "./geometry";
import { dominantRasterWallCluster } from "./reconstruct";
import { solveArchitecturalTopology } from "./topology-solver";
import { detectWallCenterlines, suppressDimensionAnnotationDetections, type WallAnnotationZone } from "./wall-detector";

export type BosRasterEvidenceBenchmark = {
  rawSegmentCount: number;
  annotationFilteredSegmentCount: number;
  pairedWallCount: number;
  dominantStructuralWallCount: number;
  topologyWallCount: number;
  rawTopology: ReturnType<typeof topologyMetrics>;
  pairedTopology: ReturnType<typeof topologyMetrics>;
  structuralTopology: ReturnType<typeof topologyMetrics>;
  solvedTopology: ReturnType<typeof topologyMetrics>;
  dimensionsWithBoxes: number;
  diagnostics: string[];
};

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

/**
 * Measures the existing raster evidence pipeline stage-by-stage without mutating the canonical
 * Building Graph. This is diagnostic evidence for the raster-backed architectural path, not a
 * reconstruction acceptance score.
 */
export function evaluateRasterEvidenceStages(input: {
  segments: readonly BosRawSegment[];
  dimensions: readonly BosDimension[];
  drawingUnitsPerMeter: number;
}): BosRasterEvidenceBenchmark {
  if (!Number.isFinite(input.drawingUnitsPerMeter) || input.drawingUnitsPerMeter <= 0) {
    throw new Error("A verified drawing scale is required before raster evidence can be benchmarked.");
  }
  const rawSegments = input.segments.map((segment) => ({
    ...segment,
    start: { ...segment.start },
    end: { ...segment.end },
  }));
  const zones = dimensionAnnotationZones(input.dimensions, input.drawingUnitsPerMeter);
  const annotationFiltered = suppressDimensionAnnotationDetections(rawSegments, zones);
  const paired = suppressDimensionAnnotationDetections(detectWallCenterlines(rawSegments), zones);
  const structural = dominantRasterWallCluster(paired);
  const solved = solveArchitecturalTopology(structural);
  const diagnostics = [
    `Raster evidence stage counts: raw ${rawSegments.length}, annotation-filtered ${annotationFiltered.length}, paired ${paired.length}, structural ${structural.length}, topology-solved ${solved.segments.length}.`,
    `Raster topology closure: raw ${topologyMetrics(rawSegments).closure.toFixed(3)}, paired ${topologyMetrics(paired).closure.toFixed(3)}, structural ${topologyMetrics(structural).closure.toFixed(3)}, solved ${topologyMetrics(solved.segments).closure.toFixed(3)}.`,
    ...solved.diagnostics,
  ];
  return {
    rawSegmentCount: rawSegments.length,
    annotationFilteredSegmentCount: annotationFiltered.length,
    pairedWallCount: paired.length,
    dominantStructuralWallCount: structural.length,
    topologyWallCount: solved.segments.length,
    rawTopology: topologyMetrics(rawSegments),
    pairedTopology: topologyMetrics(paired),
    structuralTopology: topologyMetrics(structural),
    solvedTopology: topologyMetrics(solved.segments),
    dimensionsWithBoxes: input.dimensions.filter((dimension) => dimension.evidence.some((evidence) => evidence.bbox)).length,
    diagnostics,
  };
}
