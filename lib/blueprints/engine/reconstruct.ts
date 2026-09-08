import { createEmptyBosBuildingGraph, type BosBuildingGraph, type BosWall } from "./building-graph";
import { scaleTextTokensToMeters, recognizeArchitecturalSemantics } from "./architecture";
import { segmentsToWalls } from "./geometry";
import { detectWallGapOpenings } from "./openings";
import { normalizeParsedPlan, summarizeSelectedPlan } from "./plan-parser";
import { parsePdfVectorPlan } from "./pdf-vector-parser";
import { extractRasterLineSegments } from "./raster";
import { traceWallBoundedRooms } from "./room-tracing";
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

function classifyExteriorWalls(walls: BosWall[]) {
  if (walls.length < 4) return walls;
  const xs = walls.flatMap((wall) => [wall.centerline.start.x, wall.centerline.end.x]);
  const ys = walls.flatMap((wall) => [wall.centerline.start.y, wall.centerline.end.y]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(0.01, maxX - minX);
  const height = Math.max(0.01, maxY - minY);
  const envelopeTolerance = Math.max(0.28, Math.min(width, height) * 0.035);

  return walls.map((wall) => {
    const points = [wall.centerline.start, wall.centerline.end];
    const nearEnvelope = points.some((point) =>
      Math.abs(point.x - minX) <= envelopeTolerance ||
      Math.abs(point.x - maxX) <= envelopeTolerance ||
      Math.abs(point.y - minY) <= envelopeTolerance ||
      Math.abs(point.y - maxY) <= envelopeTolerance,
    );
    const wallLength = Math.hypot(
      wall.centerline.end.x - wall.centerline.start.x,
      wall.centerline.end.y - wall.centerline.start.y,
    );
    return {
      ...wall,
      type: nearEnvelope && wallLength >= 0.75 ? "exterior" : "interior",
    } satisfies BosWall;
  });
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
    annotationFiltering: "dimension-evidence-zone-1.0.0",
    openings: "wall-gap-openings-1.0.0",
    rooms: "wall-bounded-face-tracing-1.2.0",
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
      if (rasterWallCandidates.length > wallCandidates.length) {
        wallCandidates = rasterWallCandidates;
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
  walls = classifyExteriorWalls(walls);
  graph.walls = walls;
  const openings = detectWallGapOpenings(walls);
  graph.openings = openings.openings;
  graph.doors = openings.doors;
  graph.windows = openings.windows;
  graph.rooms = traceWallBoundedRooms(graph);

  const scaledText = scaleTextTokensToMeters(summary.page.text, graph.scale.drawingUnitsPerMeter);
  const semanticGraph = recognizeArchitecturalSemantics(graph, scaledText);
  const validated = applyBosValidation(semanticGraph);
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