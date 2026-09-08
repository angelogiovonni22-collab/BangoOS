import type { BosBuildingGraph, BosLevel, BosPoint2 } from "./building-graph";

export type BosLevelAlignment = {
  levelId: string;
  sourcePage: number;
  translation: BosPoint2;
  confidence: number;
  anchor: "stair" | "exterior_centroid" | "manual";
};

function polygonCentroid(points: BosPoint2[]) {
  if (!points.length) return { x: 0, y: 0 };
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function wallCentroid(graph: BosBuildingGraph) {
  const points = graph.walls.flatMap((wall) => [wall.centerline.start, wall.centerline.end]);
  return polygonCentroid(points);
}

function stairCentroid(graph: BosBuildingGraph) {
  if (!graph.stairs.length) return null;
  return polygonCentroid(graph.stairs[0].polygon.points);
}

function translatePoint(point: BosPoint2, delta: BosPoint2) {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

function translateGraphObjects(graph: BosBuildingGraph, delta: BosPoint2, levelId: string) {
  const clone = structuredClone(graph);
  clone.walls = clone.walls.map((wall) => ({ ...wall, levelId, centerline: { start: translatePoint(wall.centerline.start, delta), end: translatePoint(wall.centerline.end, delta) } }));
  clone.rooms = clone.rooms.map((room) => ({ ...room, levelId, polygon: { points: room.polygon.points.map((point) => translatePoint(point, delta)) } }));
  clone.stairs = clone.stairs.map((stair) => ({ ...stair, levelId, polygon: { points: stair.polygon.points.map((point) => translatePoint(point, delta)) } }));
  clone.slabs = clone.slabs.map((slab) => ({ ...slab, levelId, polygon: { points: slab.polygon.points.map((point) => translatePoint(point, delta)) } }));
  clone.decksPorches = clone.decksPorches.map((slab) => ({ ...slab, levelId, polygon: { points: slab.polygon.points.map((point) => translatePoint(point, delta)) } }));
  clone.openings = clone.openings.map((opening) => ({ ...opening, levelId }));
  clone.doors = clone.doors.map((opening) => ({ ...opening, levelId }));
  clone.windows = clone.windows.map((opening) => ({ ...opening, levelId }));
  clone.dimensions = clone.dimensions.map((dimension) => ({ ...dimension, levelId, start: dimension.start ? translatePoint(dimension.start, delta) : undefined, end: dimension.end ? translatePoint(dimension.end, delta) : undefined }));
  return clone;
}

export function assembleMultiFloorBuildingGraph(input: Array<{ graph: BosBuildingGraph; level: BosLevel; manualTranslation?: BosPoint2 }>) {
  if (!input.length) throw new Error("At least one reconstructed floor is required for multi-floor assembly.");
  const sorted = [...input].sort((a, b) => a.level.index - b.level.index);
  const base = sorted[0];
  const targetStair = stairCentroid(base.graph);
  const targetExterior = wallCentroid(base.graph);
  const alignments: BosLevelAlignment[] = [];
  const transformed = sorted.map((entry, index) => {
    let translation = entry.manualTranslation || { x: 0, y: 0 };
    let anchor: BosLevelAlignment["anchor"] = entry.manualTranslation ? "manual" : "exterior_centroid";
    let confidence = entry.manualTranslation ? 1 : 0.62;
    if (!entry.manualTranslation && index > 0) {
      const sourceStair = stairCentroid(entry.graph);
      if (sourceStair && targetStair) {
        translation = { x: targetStair.x - sourceStair.x, y: targetStair.y - sourceStair.y };
        anchor = "stair";
        confidence = Math.min(0.92, Math.max(base.graph.stairs[0]?.confidence || 0.6, entry.graph.stairs[0]?.confidence || 0.6));
      } else {
        const sourceExterior = wallCentroid(entry.graph);
        translation = { x: targetExterior.x - sourceExterior.x, y: targetExterior.y - sourceExterior.y };
      }
    }
    alignments.push({ levelId: entry.level.id, sourcePage: entry.level.sourcePage, translation, confidence, anchor });
    return { entry, graph: translateGraphObjects(entry.graph, translation, entry.level.id) };
  });

  const result = structuredClone(base.graph);
  result.reconstructionVersion = "native-multifloor-1";
  result.levels = transformed.map(({ entry }) => entry.level);
  result.walls = transformed.flatMap(({ graph }) => graph.walls);
  result.openings = transformed.flatMap(({ graph }) => graph.openings);
  result.doors = transformed.flatMap(({ graph }) => graph.doors);
  result.windows = transformed.flatMap(({ graph }) => graph.windows);
  result.rooms = transformed.flatMap(({ graph }) => graph.rooms);
  result.stairs = transformed.flatMap(({ graph }) => graph.stairs);
  result.slabs = transformed.flatMap(({ graph }) => graph.slabs);
  result.decksPorches = transformed.flatMap(({ graph }) => graph.decksPorches);
  result.dimensions = transformed.flatMap(({ graph }) => graph.dimensions);
  result.sourceEvidence = transformed.flatMap(({ graph }) => graph.sourceEvidence);
  result.confidence = Math.min(...transformed.map(({ graph }) => graph.confidence), ...alignments.map((alignment) => alignment.confidence));
  result.metadata.sourcePage = base.level.sourcePage;
  result.metadata.sourceSheetTitle = "Multi-floor B.O.S. assembly";
  result.metadata.algorithms = { ...result.metadata.algorithms, levelAlignment: "stair-centroid-1.0.0" };
  return { graph: result, alignments };
}
