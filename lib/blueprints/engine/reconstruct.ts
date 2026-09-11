import { createEmptyBosBuildingGraph, type BosBuildingGraph } from "./building-graph";
import { scaleTextTokensToMeters, recognizeArchitecturalSemantics } from "./architecture";
import { segmentsToWalls, type BosRawSegment } from "./geometry";
import { applyLearnedBlueprintAssist } from "./learned-assist";
import { detectWallGapOpenings } from "./openings";
import { normalizeParsedPlan, summarizeSelectedPlan } from "./plan-parser";
import { parsePdfVectorPlan } from "./pdf-vector-parser";
import { extractRasterLineSegments } from "./raster";
import { traceWallBoundedRooms } from "./room-tracing";
import { classifyExteriorWalls } from "./exterior-classifier";
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

  const graph = createEmptyBosBuildingGraph({
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
    wallGapRepair: "disabled-after-production-regression-1.0.0",
    annotationFiltering: "dimension-evidence-zone-1.1.0",
    exteriorClassification: "room-adjacency-perimeter-1.0.0",
    openings: "wall-gap-openings-1.1.0",
    openingSymbols: "anchored-vector-symbols-1.0.0",
    rooms: "wall-bounded-face-tracing-1.3.0",
    semantics: "plan-label-semantics-1.0.0",
    validation: "building-graph-validation-1.0.0",
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
  const symbolSegments = suppressDimensionAnnotationDetections(meterSegments, annotationZones);
  let wallCandidates = suppressDimensionAnnotationDetections(detectWallCenterlines(meterSegments), annotationZones);
  let rasterRequired = summary.rasterRequired;

  if (summary.rasterRequired || wallCandidates.length < 8) {
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
      if (structuralRasterCandidates.length > wallCandidates.length) {
        wallCandidates = structuralRasterCandidates;
        graph.metadata.algorithms = {
          ...graph.metadata.algorithms,
          rasterFallback: "selected-pdf-page-orthogonal-lines-1.0.0",
        };
      }
      rasterRequired = wallCandidates.length < 8;
      if (rasterRequired) diagnostics.push("Raster fallback still found too few paired wall candidates for a faithful floor-plan reconstruction.");
    } catch (error) {
      rasterRequired = true;
      diagnostics.push(error instanceof Error ? error.message : "Raster Blueprint fallback failed closed.");
    }
  }

  let walls = segmentsToWalls(wallCandidates, { levelId, type: "unknown" });
  graph.walls = walls;
  const preliminaryRooms = traceWallBoundedRooms(graph);
  walls = classifyExteriorWalls(walls, preliminaryRooms);
  graph.walls = walls;
  const openings = detectWallGapOpenings(walls, { symbolSegments });
  graph.openings = openings.openings;
  graph.doors = openings.doors;
  graph.windows = openings.windows;
  graph.rooms = traceWallBoundedRooms(graph);

  const scaledText = scaleTextTokensToMeters(summary.page.text, graph.scale.drawingUnitsPerMeter);
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
