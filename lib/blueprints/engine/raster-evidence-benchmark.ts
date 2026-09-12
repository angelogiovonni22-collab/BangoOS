import type { BosDimension } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { topologyMetrics } from "./geometry";
import { dominantRasterWallCluster } from "./reconstruct";
import { buildRasterArchitecturalCandidate } from "./raster-architectural-candidate";
import { diagnoseRasterDimensions, type BosRasterDimensionDiagnostic, type BosRasterDimensionDiagnosticReason } from "./raster-dimension-unresolved-diagnostic";
import { solveArchitecturalTopology } from "./topology-solver";
import { detectWallCenterlines, suppressDimensionAnnotationDetections } from "./wall-detector";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosRasterEvidenceBenchmark = {
  rawSegmentCount: number;
  annotationFilteredSegmentCount: number;
  legacyPairedWallCount: number;
  dominantStructuralWallCount: number;
  topologyWallCount: number;
  explicitWallSystemCount: number;
  sheetFrameRejectedWallSystemCount: number;
  selectedWallSystemCount: number;
  rejectedWallSystemCount: number;
  structuralComponentCount: number;
  retainedStructuralComponentCount: number;
  repetitiveArtifactCount: number;
  constrainedWallSystemCount: number;
  constrainedJunctionCount: number;
  constrainedSnappedEndpointCount: number;
  sourceDimensionEvidenceMatchedCount: number;
  sourceDimensionSingleSegmentCount: number;
  sourceDimensionLabelGapChainCount: number;
  sourceDimensionFragmentChainCount: number;
  matchedDimensionCount: number;
  boundarySpanDimensionCount: number;
  singleWallDimensionCount: number;
  unresolvedDimensionCount: number;
  dimensionDiagnosticCounts: Record<BosRasterDimensionDiagnosticReason, number>;
  dimensionDiagnostics: BosRasterDimensionDiagnostic[];
  dominantUnresolvedDimensionReason: BosRasterDimensionDiagnosticReason | null;
  rawTopology: ReturnType<typeof topologyMetrics>;
  legacyPairedTopology: ReturnType<typeof topologyMetrics>;
  structuralTopology: ReturnType<typeof topologyMetrics>;
  solvedTopology: ReturnType<typeof topologyMetrics>;
  explicitWallSystemTopology: ReturnType<typeof topologyMetrics>;
  selectedWallSystemTopology: ReturnType<typeof topologyMetrics>;
  constrainedWallSystemTopology: ReturnType<typeof topologyMetrics>;
  dimensionsWithBoxes: number;
  diagnostics: string[];
};

function systemSegments(systems: readonly BosWallSystemCandidate[]): BosRawSegment[] {
  return systems.map((wall) => ({ start: { ...wall.centerline.start }, end: { ...wall.centerline.end }, sourcePage: wall.sourcePage, sourceObjectId: wall.id, strokeWidth: wall.thickness, confidence: wall.confidence }));
}

export function evaluateRasterEvidenceStages(input: {
  segments: readonly BosRawSegment[];
  dimensions: readonly BosDimension[];
  drawingUnitsPerMeter: number;
  sourceWidthMeters?: number | null;
  sourceHeightMeters?: number | null;
}): BosRasterEvidenceBenchmark {
  const candidate = buildRasterArchitecturalCandidate(input);
  const legacyPaired = suppressDimensionAnnotationDetections(detectWallCenterlines(candidate.rawSegments), candidate.zones);
  const structural = dominantRasterWallCluster(legacyPaired);
  const solved = solveArchitecturalTopology(structural);
  const explicitSegments = systemSegments(candidate.explicitSystems);
  const selectedSegments = systemSegments(candidate.structuralSelection.wallSystems);
  const constrainedSegments = systemSegments(candidate.constrained.wallSystems);
  const matchedDimensionIds = new Set(candidate.constrained.constraints.flatMap((constraint) => constraint.relation === "dimension" && constraint.dimensionId ? [constraint.dimensionId] : []));
  const dimensionDiagnostic = diagnoseRasterDimensions({
    segments: candidate.rawSegments,
    dimensions: input.dimensions,
    drawingUnitsPerMeter: input.drawingUnitsPerMeter,
    associations: candidate.dimensionEvidence.associations,
    matchedDimensionIds,
  });
  const diagnostics = [
    `Raster evidence stage counts: raw ${candidate.rawSegments.length}, annotation-filtered ${candidate.annotationFiltered.length}, legacy-paired ${legacyPaired.length}, structural ${structural.length}, legacy-topology ${solved.segments.length}, explicit-systems ${candidate.explicitSystems.length}, sheet-frame-rejected ${candidate.sheetFrameSelection.rejectedSystemIds.length}, structural-selected ${candidate.structuralSelection.wallSystems.length}, constrained-systems ${candidate.constrained.wallSystems.length}.`,
    `Raster topology closure: raw ${topologyMetrics(candidate.rawSegments).closure.toFixed(3)}, legacy-paired ${topologyMetrics(legacyPaired).closure.toFixed(3)}, legacy-solved ${topologyMetrics(solved.segments).closure.toFixed(3)}, explicit ${topologyMetrics(explicitSegments).closure.toFixed(3)}, selected ${topologyMetrics(selectedSegments).closure.toFixed(3)}, constrained ${topologyMetrics(constrainedSegments).closure.toFixed(3)}.`,
    ...solved.diagnostics,
    ...candidate.sheetFrameSelection.diagnostics,
    ...candidate.structuralSelection.diagnostics,
    ...candidate.dimensionEvidence.diagnostics,
    ...dimensionDiagnostic.diagnostics,
    `Explicit raster global constraints retained ${candidate.constrained.wallSystems.length} wall systems with ${candidate.constrained.junctionCount} junctions and ${candidate.constrained.snappedEndpointCount} snapped endpoints; ${candidate.constrained.matchedDimensionCount} printed dimensions matched (${candidate.constrained.boundarySpanDimensionCount} boundary spans, ${candidate.constrained.singleWallDimensionCount} single-wall lengths) and ${candidate.constrained.unresolvedDimensionIds.length} remain unresolved.`,
  ];
  return {
    rawSegmentCount: candidate.rawSegments.length,
    annotationFilteredSegmentCount: candidate.annotationFiltered.length,
    legacyPairedWallCount: legacyPaired.length,
    dominantStructuralWallCount: structural.length,
    topologyWallCount: solved.segments.length,
    explicitWallSystemCount: candidate.explicitSystems.length,
    sheetFrameRejectedWallSystemCount: candidate.sheetFrameSelection.rejectedSystemIds.length,
    selectedWallSystemCount: candidate.structuralSelection.wallSystems.length,
    rejectedWallSystemCount: candidate.structuralSelection.rejectedSystemIds.length,
    structuralComponentCount: candidate.structuralSelection.componentCount,
    retainedStructuralComponentCount: candidate.structuralSelection.retainedComponentCount,
    repetitiveArtifactCount: candidate.structuralSelection.repetitiveArtifactCount,
    constrainedWallSystemCount: candidate.constrained.wallSystems.length,
    constrainedJunctionCount: candidate.constrained.junctionCount,
    constrainedSnappedEndpointCount: candidate.constrained.snappedEndpointCount,
    sourceDimensionEvidenceMatchedCount: candidate.dimensionEvidence.associations.length,
    sourceDimensionSingleSegmentCount: candidate.dimensionEvidence.singleSegmentAssociationCount,
    sourceDimensionLabelGapChainCount: candidate.dimensionEvidence.labelGapChainAssociationCount,
    sourceDimensionFragmentChainCount: candidate.dimensionEvidence.fragmentChainAssociationCount,
    matchedDimensionCount: candidate.constrained.matchedDimensionCount,
    boundarySpanDimensionCount: candidate.constrained.boundarySpanDimensionCount,
    singleWallDimensionCount: candidate.constrained.singleWallDimensionCount,
    unresolvedDimensionCount: candidate.constrained.unresolvedDimensionIds.length,
    dimensionDiagnosticCounts: dimensionDiagnostic.reasonCounts,
    dimensionDiagnostics: dimensionDiagnostic.dimensions,
    dominantUnresolvedDimensionReason: dimensionDiagnostic.dominantUnresolvedReason,
    rawTopology: topologyMetrics(candidate.rawSegments),
    legacyPairedTopology: topologyMetrics(legacyPaired),
    structuralTopology: topologyMetrics(structural),
    solvedTopology: topologyMetrics(solved.segments),
    explicitWallSystemTopology: topologyMetrics(explicitSegments),
    selectedWallSystemTopology: topologyMetrics(selectedSegments),
    constrainedWallSystemTopology: topologyMetrics(constrainedSegments),
    dimensionsWithBoxes: input.dimensions.filter((dimension) => dimension.evidence.some((evidence) => evidence.bbox)).length,
    diagnostics,
  };
}
