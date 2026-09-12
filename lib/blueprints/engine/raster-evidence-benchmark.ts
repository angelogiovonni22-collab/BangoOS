import type { BosDimension } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { topologyMetrics } from "./geometry";
import { solveGlobalWallConstraints } from "./global-constraint-solver";
import { dominantRasterWallCluster } from "./reconstruct";
import { buildWallSystemsFromRasterFaces } from "./raster-wall-system-builder";
import { solveArchitecturalTopology } from "./topology-solver";
import { detectWallCenterlines, suppressDimensionAnnotationDetections, type WallAnnotationZone } from "./wall-detector";

export type BosRasterEvidenceBenchmark = {
  rawSegmentCount: number;
  annotationFilteredSegmentCount: number;
  legacyPairedWallCount: number;
  dominantStructuralWallCount: number;
  topologyWallCount: number;
  explicitWallSystemCount: number;
  constrainedWallSystemCount: number;
  constrainedJunctionCount: number;
  constrainedSnappedEndpointCount: number;
  matchedDimensionCount: number;
  unresolvedDimensionCount: number;
  rawTopology: ReturnType<typeof topologyMetrics>;
  legacyPairedTopology: ReturnType<typeof topologyMetrics>;
  structuralTopology: ReturnType<typeof topologyMetrics>;
  solvedTopology: ReturnType<typeof topologyMetrics>;
  explicitWallSystemTopology: ReturnType<typeof topologyMetrics>;
  constrainedWallSystemTopology: ReturnType<typeof topologyMetrics>;
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

function systemSegments(systems: ReturnType<typeof buildWallSystemsFromRasterFaces>): BosRawSegment[] {
  return systems.map((wall) => ({
    start: { ...wall.centerline.start },
    end: { ...wall.centerline.end },
    sourcePage: wall.sourcePage,
    sourceObjectId: wall.id,
    strokeWidth: wall.thickness,
    confidence: wall.confidence,
  }));
}

/**
 * Measures raster evidence stage-by-stage without mutating the canonical Building Graph. It keeps
 * the legacy detector visible for comparison while also running the new explicit two-face wall
 * system architecture with bucket-boundary-safe pairing and global constraints.
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

  const legacyPaired = suppressDimensionAnnotationDetections(detectWallCenterlines(rawSegments), zones);
  const structural = dominantRasterWallCluster(legacyPaired);
  const solved = solveArchitecturalTopology(structural);

  const explicitSystems = buildWallSystemsFromRasterFaces(annotationFiltered);
  const constrained = solveGlobalWallConstraints(explicitSystems, input.dimensions);
  const explicitSegments = systemSegments(explicitSystems);
  const constrainedSegments = systemSegments(constrained.wallSystems);

  const diagnostics = [
    `Raster evidence stage counts: raw ${rawSegments.length}, annotation-filtered ${annotationFiltered.length}, legacy-paired ${legacyPaired.length}, structural ${structural.length}, legacy-topology ${solved.segments.length}, explicit-systems ${explicitSystems.length}, constrained-systems ${constrained.wallSystems.length}.`,
    `Raster topology closure: raw ${topologyMetrics(rawSegments).closure.toFixed(3)}, legacy-paired ${topologyMetrics(legacyPaired).closure.toFixed(3)}, legacy-solved ${topologyMetrics(solved.segments).closure.toFixed(3)}, explicit ${topologyMetrics(explicitSegments).closure.toFixed(3)}, constrained ${topologyMetrics(constrainedSegments).closure.toFixed(3)}.`,
    ...solved.diagnostics,
    `Explicit raster global constraints retained ${constrained.wallSystems.length} wall systems with ${constrained.junctionCount} junctions and ${constrained.snappedEndpointCount} snapped endpoints; ${constrained.matchedDimensionCount} printed dimensions matched and ${constrained.unresolvedDimensionIds.length} remain unresolved.`,
  ];
  return {
    rawSegmentCount: rawSegments.length,
    annotationFilteredSegmentCount: annotationFiltered.length,
    legacyPairedWallCount: legacyPaired.length,
    dominantStructuralWallCount: structural.length,
    topologyWallCount: solved.segments.length,
    explicitWallSystemCount: explicitSystems.length,
    constrainedWallSystemCount: constrained.wallSystems.length,
    constrainedJunctionCount: constrained.junctionCount,
    constrainedSnappedEndpointCount: constrained.snappedEndpointCount,
    matchedDimensionCount: constrained.matchedDimensionCount,
    unresolvedDimensionCount: constrained.unresolvedDimensionIds.length,
    rawTopology: topologyMetrics(rawSegments),
    legacyPairedTopology: topologyMetrics(legacyPaired),
    structuralTopology: topologyMetrics(structural),
    solvedTopology: topologyMetrics(solved.segments),
    explicitWallSystemTopology: topologyMetrics(explicitSegments),
    constrainedWallSystemTopology: topologyMetrics(constrainedSegments),
    dimensionsWithBoxes: input.dimensions.filter((dimension) => dimension.evidence.some((evidence) => evidence.bbox)).length,
    diagnostics,
  };
}
