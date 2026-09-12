import type { BosBuildingGraph, BosDimension, BosWall } from "./building-graph";

export type DimensionAssociation = {
  dimensionId: string;
  wallId: string;
  observedDrawingLength: number;
  expectedLengthMeters: number;
  residualMeters: number;
  confidence: number;
};

function wallLength(wall: BosWall) {
  return Math.hypot(wall.centerline.end.x - wall.centerline.start.x, wall.centerline.end.y - wall.centerline.start.y);
}

function midpoint(wall: BosWall) {
  return { x: (wall.centerline.start.x + wall.centerline.end.x) / 2, y: (wall.centerline.start.y + wall.centerline.end.y) / 2 };
}

function dimensionMidpoint(dimension: BosDimension) {
  if (!dimension.start || !dimension.end) return null;
  return { x: (dimension.start.x + dimension.end.x) / 2, y: (dimension.start.y + dimension.end.y) / 2 };
}

function dimensionAxis(dimension: BosDimension) {
  if (!dimension.start || !dimension.end) return null;
  const dx = dimension.end.x - dimension.start.x;
  const dy = dimension.end.y - dimension.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return null;
  return { x: dx / length, y: dy / length, length };
}

function wallAxis(wall: BosWall) {
  const dx = wall.centerline.end.x - wall.centerline.start.x;
  const dy = wall.centerline.end.y - wall.centerline.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return null;
  return { x: dx / length, y: dy / length, length };
}

export function associateDimensionsToWalls(graph: BosBuildingGraph): DimensionAssociation[] {
  const associations: DimensionAssociation[] = [];
  for (const dimension of graph.dimensions) {
    const dm = dimensionMidpoint(dimension);
    const da = dimensionAxis(dimension);
    if (!dm || !da) continue;
    let best: { wall: BosWall; score: number } | null = null;
    for (const wall of graph.walls.filter((candidate) => candidate.levelId === dimension.levelId)) {
      const wa = wallAxis(wall);
      if (!wa) continue;
      const parallel = Math.abs(da.x * wa.x + da.y * wa.y);
      if (parallel < 0.965) continue;
      const wm = midpoint(wall);
      const distance = Math.hypot(dm.x - wm.x, dm.y - wm.y);
      const lengthSimilarity = 1 - Math.min(1, Math.abs(wallLength(wall) - dimension.value) / Math.max(dimension.value, 0.01));
      const score = parallel * 0.45 + lengthSimilarity * 0.35 + Math.max(0, 1 - distance / 4) * 0.2;
      if (!best || score > best.score) best = { wall, score };
    }
    if (!best || best.score < 0.62) continue;
    associations.push({
      dimensionId: dimension.id,
      wallId: best.wall.id,
      observedDrawingLength: wallLength(best.wall),
      expectedLengthMeters: dimension.value,
      residualMeters: wallLength(best.wall) - dimension.value,
      confidence: Math.min(dimension.confidence, best.score),
    });
  }
  return associations;
}

export function solveDimensionScaleCorrection(graph: BosBuildingGraph, associations = associateDimensionsToWalls(graph)) {
  const usable = associations.filter((item) => item.confidence >= 0.7 && item.observedDrawingLength > 0 && item.expectedLengthMeters > 0);
  if (usable.length < 2) return { graph, associations, applied: false, factor: 1, conflict: false };
  const ratios = usable.map((item) => item.expectedLengthMeters / item.observedDrawingLength).sort((a, b) => a - b);
  const factor = ratios[Math.floor(ratios.length / 2)];
  const relativeSpread = Math.max(...ratios.map((ratio) => Math.abs(ratio - factor) / factor));
  const conflict = relativeSpread > 0.08;
  if (conflict || Math.abs(factor - 1) < 0.005 || factor < 0.75 || factor > 1.25) {
    return { graph, associations, applied: false, factor, conflict };
  }

  const next: BosBuildingGraph = structuredClone(graph);
  const scalePoint = (point: { x: number; y: number }) => ({ x: point.x * factor, y: point.y * factor });
  next.walls = next.walls.map((wall) => ({
    ...wall,
    centerline: { start: scalePoint(wall.centerline.start), end: scalePoint(wall.centerline.end) },
    thickness: wall.thickness * factor,
    provenance: { ...wall.provenance, algorithm: `${wall.provenance.algorithm}+dimension-reconcile`, algorithmVersion: "1.1.0" },
  }));
  next.rooms = next.rooms.map((room) => ({ ...room, polygon: { points: room.polygon.points.map(scalePoint) } }));
  next.stairs = next.stairs.map((stair) => ({ ...stair, polygon: { points: stair.polygon.points.map(scalePoint) } }));
  next.slabs = next.slabs.map((slab) => ({ ...slab, polygon: { points: slab.polygon.points.map(scalePoint) }, thickness: slab.thickness * factor }));
  next.decksPorches = next.decksPorches.map((slab) => ({ ...slab, polygon: { points: slab.polygon.points.map(scalePoint) }, thickness: slab.thickness * factor }));
  next.openings = next.openings.map((opening) => ({ ...opening, offset: opening.offset * factor, width: opening.width * factor, height: opening.height * factor, sillHeight: opening.sillHeight === undefined ? undefined : opening.sillHeight * factor }));
  next.doors = next.doors.map((opening) => ({ ...opening, offset: opening.offset * factor, width: opening.width * factor, height: opening.height * factor, sillHeight: opening.sillHeight === undefined ? undefined : opening.sillHeight * factor }));
  next.windows = next.windows.map((opening) => ({ ...opening, offset: opening.offset * factor, width: opening.width * factor, height: opening.height * factor, sillHeight: opening.sillHeight === undefined ? undefined : opening.sillHeight * factor }));
  next.dimensions = next.dimensions.map((dimension) => ({
    ...dimension,
    start: dimension.start ? scalePoint(dimension.start) : undefined,
    end: dimension.end ? scalePoint(dimension.end) : undefined,
  }));
  if (next.scale.drawingUnitsPerMeter) next.scale.drawingUnitsPerMeter /= factor;
  next.scale = { ...next.scale, source: "dimension_solved", confidence: Math.max(next.scale.confidence, 0.9 * (1 - relativeSpread)) };
  next.metadata.algorithms = { ...next.metadata.algorithms, dimensionSolver: "median-dimension-reconcile-1.1.0" };
  return { graph: next, associations, applied: true, factor, conflict: false };
}
