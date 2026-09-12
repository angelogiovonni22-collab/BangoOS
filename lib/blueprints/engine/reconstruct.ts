import { createEmptyBosBuildingGraph, type BosBuildingGraph } from "./building-graph";
import { scaleTextTokensToMeters, recognizeArchitecturalSemantics } from "./architecture";
import { applyDimensionWallConstraints } from "./dimension-constraints";
import { solveDimensionScaleCorrection } from "./dimension-solver";
import { segmentsToWalls, topologyMetrics, type BosRawSegment } from "./geometry";
import { applyLearnedBlueprintAssist } from "./learned-assist";
import { detectWallGapOpenings } from "./openings";
import { normalizeParsedPlan, summarizeSelectedPlan } from "./plan-parser";
import { parsePdfVectorPlan } from "./pdf-vector-parser";
import { extractRasterLineSegments } from "./raster";
import { traceWallBoundedRooms } from "./room-tracing";
import { classifyExteriorWalls } from "./exterior-classifier";
import { assessSourceGeometryAlignment } from "./source-alignment";
import { solveArchitecturalTopology } from "./topology-solver";
import { applyBosValidation } from "./validation";
import { detectWallCenterlines, scaleSegmentsToMeters, suppressDimensionAnnotationDetections, type WallAnnotationZone } from "./wall-detector";

export type NativeBlueprintSource = {
  buffer: Buffer;
  mimeType: string;
  buildingId: string;
  companyId?: string;
  projectId?: string;
  sourceVersionId?: string;
  sheetNumber?: string;
  sheetTitle?: string;
  discipline?: string;
  manualDrawingUnitsPerMeter?: number;
};

export type NativeBlueprintReconstruction = {
  graph: BosBuildingGraph;
  selectedPage: number;
  targetScore: number;
  vectorCount: number;
  wallCandidateCount: number;
  rasterRequired: boolean;
  diagnostics: string[];
};

type FidelityMetrics = BosBuildingGraph["validation"]["metrics"] & {
  sourceAlignment?: number;
  sourceSupportedWalls?: number;
  sourceTotalWalls?: number;
};

function pointToSegmentDistance(point: { x: number; y: number }, segment: { start: { x: number; y: number }; end: { x: number; y: number } }) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - segment.start.x, point.y - segment.start.y);
  const t = Math.max(0, Math.min(1, ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared));
  const x = segment.start.x + t * dx;
  const y = segment.start.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function scaleRawSegments(segments: readonly BosRawSegment[], factor: number): BosRawSegment[] {
  return segments.map((segment) => ({
    ...segment,
    start: { x: segment.start.x * factor, y: segment.start.y * factor },
    end: { x: segment.end.x * factor, y: segment.end.y * factor },
    strokeWidth: segment.strokeWidth === undefined ? undefined : segment.strokeWidth * factor,
  }));
}

function dominantRasterWallCluster(input: BosRawSegment[]) {
  if (input.length < 12) return input;
  const tolerance = 0.22;
  const parent = input.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (a: number, b: number) => {
    const left = find(a);
    const right = find(b);
    if (left !== right) parent[right] = left;
  };
  for (let i = 0; i < input.length; i += 1) {
    for (let j = i + 1; j < input.length; j += 1) {
      const a = input[i];
      const b = input[j];
      const separation = Math.min(
        pointToSegmentDistance(a.start, b),
        pointToSegmentDistance(a.end, b),
        pointToSegmentDistance(b.start, a),
        pointToSegmentDistance(b.end, a),
      );
      if (separation <= tolerance) union(i, j);
    }
  }
  const groups = new Map<number, BosRawSegment[]>();
  input.forEach((segment, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), segment]);
  });
  const largest = [...groups.values()].sort((a, b) => b.length - a.length)[0] || input;
  return largest.length >= 8 && largest.length / input.length >= 0.3 ? largest : input;
}

function dimensionAnnotationZones(graph: BosBuildingGraph): WallAnnotationZone[] {
  const unitsPerMeter = graph.scale.drawingUnitsPerMeter;
  if (!unitsPerMeter || unitsPerMeter <= 0) return [];
  const factor = 1 / unitsPerMeter;
  return graph.dimensions.flatMap((dimension) => dimension.evidence.flatMap((evidence) => {
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

function candidateQuality(segments: BosRawSegment[]) {
  if (!segments.length) return 0;
  const topology = topologyMetrics(segments);
  const confidence = segments.reduce((sum, segment) => sum + (segment.confidence ?? 0.75), 0) / segments.length;
  const coverage = Math.min(1, segments.length / 32);
  return topology.closure * 0.6 + confidence * 0.25 + coverage * 0.15;
}

export async function reconstructNativeBlueprint(source: NativeBlueprintSource): Promise<NativeBlueprintReconstruction> {
  if (source.mimeType !== "application/pdf") {
    throw new Error("Native vector reconstruction currently requires a PDF source; raster fallback must handle image-only plans.");
  }

  const pages = await parsePdfVectorPlan(source.buffer);
  const parsed = normalizeParsedPlan({
    sourceType: "pdf",
    pages,
    target: { sheetNumber: source.sheetNumber, title: source.sheetTitle, discipline: source.discipline },
  });
  const levelId = "level-1";
  const summary = summarizeSelectedPlan(parsed, levelId);
  const diagnostics: string[] = [];

  let graph = createEmptyBosBuildingGraph({
    buildingId: source.buildingId,
    sourcePage: parsed.selectedPage,
    levelName: source.sheetTitle || "Level 1",
    sourceSheetNumber: source.sheetNumber,
    sourceSheetTitle: source.sheetTitle,
  });
  graph.building.companyId = source.companyId;
  graph.building.projectId = source.projectId;
  graph.building.sourceVersionId = source.sourceVersionId;
  graph.sourceEvidence.push(...parsed.targetEvidence);
  graph.metadata.algorithms = {
    parser: "pdfjs-vector-1.0.0",
    sheetTargeting: "deterministic-title-sheet-1.0.0",
    wallDetection: "paired-line-1.2.0",
    topologySolver: "architectural-junction-solver-1.0.0",
    sourceSelection: "topology-scored-vector-first-1.0.0",
    sourceAlignment: "length-weighted-source-geometry-1.0.0",
    dimensionConstraints: "printed-dimension-wall-constraints-1.0.0",
    dimensionReconciliation: "median-dimension-reconcile-1.1.0",
    wallGapRepair: "disabled-after-production-regression-1.0.0",
    annotationFiltering: "dimension-evidence-zone-1.1.0",
    exteriorClassification: "room-adjacency-perimeter-1.0.0",
    openings: "wall-gap-openings-1.1.0",
    openingSymbols: "anchored-vector-symbols-1.0.0",
    rooms: "wall-bounded-face-tracing-1.3.0",
    semantics: "plan-label-semantics-1.0.0",
    validation: "building-graph-validation-1.1.0",
  };

  graph.scale = summary.scale;
  const manualDrawingUnitsPerMeter = source.manualDrawingUnitsPerMeter;
  if (
    typeof manualDrawingUnitsPerMeter === "number" &&
    Number.isFinite(manualDrawingUnitsPerMeter) &&
    manualDrawingUnitsPerMeter > 0
  ) {
    graph.scale = {
      source: "manual",
      drawingUnitsPerMeter: manualDrawingUnitsPerMeter,
      confidence: 1,
    };
    graph.metadata.algorithms = { ...graph.metadata.algorithms, manualScale: "persisted-correction-1.0.0" };
  }
  graph.dimensions = summary.dimensions;
  if (!graph.scale.drawingUnitsPerMeter || graph.scale.confidence < 0.55) {
    diagnostics.push("Printed drawing scale could not be verified strongly enough for deterministic geometry conversion.");
    graph.validation = applyBosValidation(graph).validation;
    return {
      graph,
      selectedPage: parsed.selectedPage,
      targetScore: parsed.targetScore,
      vectorCount: summary.vectorCount,
      wallCandidateCount: 0,
      rasterRequired: summary.rasterRequired,
      diagnostics,
    };
  }

  const annotationZones = dimensionAnnotationZones(graph);
  const meterSegments = scaleSegmentsToMeters(summary.page.vectorSegments, graph.scale.drawingUnitsPerMeter);
  let symbolSegments = suppressDimensionAnnotationDetections(meterSegments, annotationZones);
  const vectorDetected = suppressDimensionAnnotationDetections(detectWallCenterlines(meterSegments), annotationZones);
  const vectorTopology = solveArchitecturalTopology(vectorDetected);
  diagnostics.push(...vectorTopology.diagnostics);
  let wallCandidates = vectorTopology.segments;
  let selectedEvidence = vectorDetected;
  let selectedSource: "vector" | "raster" = "vector";
  let selectedQuality = candidateQuality(wallCandidates);
  let rasterRequired = summary.rasterRequired && wallCandidates.length < 8;

  const shouldEvaluateRaster = summary.rasterRequired || wallCandidates.length < 8 || selectedQuality < 0.62;
  if (shouldEvaluateRaster) {
    try {
      const raster = await extractRasterLineSegments(source.buffer, {
        page: parsed.selectedPage,
        drawingUnitsPerMeter: graph.scale.drawingUnitsPerMeter,
        sourceWidth: summary.page.width,
        sourceHeight: summary.page.height,
      });
      diagnostics.push(...raster.diagnostics);
      const rasterWallCandidates = suppressDimensionAnnotationDetections(detectWallCenterlines(raster.segments), annotationZones);
      const structuralRasterCandidates = dominantRasterWallCluster(rasterWallCandidates);
      if (structuralRasterCandidates.length < rasterWallCandidates.length) {
        diagnostics.push(`Raster structural clustering retained ${structuralRasterCandidates.length} of ${rasterWallCandidates.length} wall candidates in the dominant connected plan region.`);
      }
      const rasterTopology = solveArchitecturalTopology(structuralRasterCandidates);
      diagnostics.push(...rasterTopology.diagnostics);
      const rasterQuality = candidateQuality(rasterTopology.segments);

      const rasterMateriallyBetter = wallCandidates.length < 8
        ? rasterTopology.segments.length >= 8
        : rasterQuality >= selectedQuality + 0.08;
      if (rasterMateriallyBetter) {
        wallCandidates = rasterTopology.segments;
        selectedEvidence = structuralRasterCandidates;
        selectedQuality = rasterQuality;
        selectedSource = "raster";
        graph.metadata.algorithms = {
          ...graph.metadata.algorithms,
          rasterFallback: "selected-pdf-page-orthogonal-lines-1.1.0",
        };
      }
      rasterRequired = wallCandidates.length < 8;
      if (rasterRequired) diagnostics.push("Raster fallback still found too few topology-validated wall candidates for a faithful floor-plan reconstruction.");
    } catch (error) {
      rasterRequired = wallCandidates.length < 8;
      diagnostics.push(error instanceof Error ? error.message : "Raster Blueprint fallback failed closed.");
    }
  }
  diagnostics.push(`B.O.S. selected ${selectedSource} wall geometry after topology scoring (${selectedQuality.toFixed(3)}).`);

  let walls = segmentsToWalls(wallCandidates, { levelId, type: "unknown" });
  const dimensionConstraints = applyDimensionWallConstraints(walls, graph.dimensions, graph.scale.drawingUnitsPerMeter);
  walls = dimensionConstraints.walls;
  graph.dimensions = dimensionConstraints.dimensions;
  graph.walls = walls;
  diagnostics.push(...dimensionConstraints.diagnostics);

  if (graph.scale.source !== "manual") {
    const reconciliation = solveDimensionScaleCorrection(graph);
    if (reconciliation.conflict) {
      diagnostics.push("Printed Blueprint dimensions disagree beyond the safe global reconciliation tolerance; B.O.S. preserved the current scale and requires review.");
    } else if (reconciliation.applied) {
      graph = reconciliation.graph;
      walls = graph.walls;
      selectedEvidence = scaleRawSegments(selectedEvidence, reconciliation.factor);
      symbolSegments = scaleRawSegments(symbolSegments, reconciliation.factor);
      diagnostics.push(`B.O.S. reconciled the selected source scale from ${reconciliation.associations.length} dimension associations (factor ${reconciliation.factor.toFixed(4)}).`);
    }
  } else {
    diagnostics.push("Manual scale correction is authoritative; automatic global dimension reconciliation was not applied.");
  }

  const finalWallSegments: BosRawSegment[] = walls.map((wall) => ({
    start: wall.centerline.start,
    end: wall.centerline.end,
    sourcePage: wall.sourcePage,
    sourceObjectId: wall.evidence[0]?.sourceObjectId,
    strokeWidth: wall.thickness,
    confidence: wall.confidence,
  }));
  const alignment = assessSourceGeometryAlignment(finalWallSegments, selectedEvidence);
  diagnostics.push(...alignment.diagnostics);
  const fidelityMetrics = graph.validation.metrics as FidelityMetrics;
  fidelityMetrics.sourceAlignment = alignment.score;
  fidelityMetrics.sourceSupportedWalls = alignment.supported;
  fidelityMetrics.sourceTotalWalls = alignment.total;

  graph.walls = walls;
  const preliminaryRooms = traceWallBoundedRooms(graph);
  walls = classifyExteriorWalls(walls, preliminaryRooms);
  graph.walls = walls;
  const openings = detectWallGapOpenings(walls, { symbolSegments });
  graph.openings = openings.openings;
  graph.doors = openings.doors;
  graph.windows = openings.windows;
  graph.rooms = traceWallBoundedRooms(graph);

  const resolvedDrawingUnitsPerMeter = graph.scale.drawingUnitsPerMeter;
  if (!resolvedDrawingUnitsPerMeter || resolvedDrawingUnitsPerMeter <= 0) {
    throw new Error("B.O.S. lost the verified Blueprint scale during dimension reconciliation.");
  }
  const scaledText = scaleTextTokensToMeters(summary.page.text, resolvedDrawingUnitsPerMeter);
  const semanticGraph = recognizeArchitecturalSemantics(graph, scaledText);
  let validated = applyBosValidation(semanticGraph);

  const learned = await applyLearnedBlueprintAssist({
    graph: validated,
    pdfBuffer: source.buffer,
    companyId: source.companyId,
    projectId: source.projectId,
    sourceVersionId: source.sourceVersionId,
    sourcePage: parsed.selectedPage,
    sourceWidthUnits: summary.page.width,
    sourceHeightUnits: summary.page.height,
  });
  validated = learned.graph;
  validated = applyBosValidation(validated);
  diagnostics.push(...learned.diagnostics);

  if (parsed.targetScore < 0.45) diagnostics.push("Registered sheet targeting confidence is low; B.O.S. should request review before accepting geometry.");
  if (rasterRequired) diagnostics.push("The selected page does not yet contain enough verified vector or raster linework for native reconstruction.");
  if (wallCandidates.length < 8) diagnostics.push("Deterministic paired-line detection found too few wall candidates for a faithful floor-plan reconstruction.");
  if (validated.validation.status !== "reconstructed") diagnostics.push(...validated.validation.issues.map((item) => item.message));

  return {
    graph: validated,
    selectedPage: parsed.selectedPage,
    targetScore: parsed.targetScore,
    vectorCount: summary.vectorCount,
    wallCandidateCount: wallCandidates.length,
    rasterRequired,
    diagnostics: [...new Set(diagnostics)],
  };
}
