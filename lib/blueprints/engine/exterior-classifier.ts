import type { BosPoint2, BosRoom, BosWall } from "./building-graph";
import { pointInBosPolygon } from "./room-tracing";

function wallLength(wall: BosWall) {
  return Math.hypot(
    wall.centerline.end.x - wall.centerline.start.x,
    wall.centerline.end.y - wall.centerline.start.y,
  );
}

function envelopeExteriorIds(walls: BosWall[]) {
  const exterior = new Set<string>();
  if (walls.length < 4) return exterior;
  const xs = walls.flatMap((wall) => [wall.centerline.start.x, wall.centerline.end.x]);
  const ys = walls.flatMap((wall) => [wall.centerline.start.y, wall.centerline.end.y]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(0.01, maxX - minX);
  const height = Math.max(0.01, maxY - minY);
  const envelopeTolerance = Math.max(0.28, Math.min(width, height) * 0.035);

  for (const wall of walls) {
    if (wallLength(wall) < 0.75) continue;
    const points = [wall.centerline.start, wall.centerline.end];
    const nearEnvelope = points.some((point) =>
      Math.abs(point.x - minX) <= envelopeTolerance
      || Math.abs(point.x - maxX) <= envelopeTolerance
      || Math.abs(point.y - minY) <= envelopeTolerance
      || Math.abs(point.y - maxY) <= envelopeTolerance,
    );
    if (nearEnvelope) exterior.add(wall.id);
  }
  return exterior;
}

function interpolate(start: BosPoint2, end: BosPoint2, t: number) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function occupied(point: BosPoint2, rooms: readonly BosRoom[]) {
  return rooms.some((room) => pointInBosPolygon(point, room.polygon));
}

function roomAdjacency(wall: BosWall, rooms: readonly BosRoom[]) {
  const dx = wall.centerline.end.x - wall.centerline.start.x;
  const dy = wall.centerline.end.y - wall.centerline.start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.45 || rooms.length === 0) return null;
  const normal = { x: -dy / length, y: dx / length };
  const offset = Math.max(0.18, Math.min(0.4, wall.thickness * 1.75));
  const samples = [0.2, 0.5, 0.8];
  let left = 0;
  let right = 0;
  for (const t of samples) {
    const point = interpolate(wall.centerline.start, wall.centerline.end, t);
    if (occupied({ x: point.x + normal.x * offset, y: point.y + normal.y * offset }, rooms)) left += 1;
    if (occupied({ x: point.x - normal.x * offset, y: point.y - normal.y * offset }, rooms)) right += 1;
  }
  const leftOccupied = left >= 2;
  const rightOccupied = right >= 2;
  if (!leftOccupied && !rightOccupied) return null;
  return { leftOccupied, rightOccupied };
}

/**
 * Classify the reconstructed wall network using bounded-room adjacency first, with the old global
 * envelope heuristic only as a fallback when room tracing has no evidence for a wall. A wall with
 * occupied space on exactly one side is a perimeter wall even when it sits inside the drawing's
 * overall bounding box (recesses, garage returns, bump-outs). A wall with occupied space on both
 * sides is an interior partition.
 */
export function classifyExteriorWalls(walls: BosWall[], rooms: readonly BosRoom[] = []) {
  if (walls.length < 4) return walls;
  const envelope = envelopeExteriorIds(walls);
  return walls.map((wall) => {
    const adjacency = roomAdjacency(wall, rooms);
    let type: BosWall["type"];
    if (adjacency) {
      type = adjacency.leftOccupied !== adjacency.rightOccupied ? "exterior" : "interior";
    } else {
      type = envelope.has(wall.id) ? "exterior" : "interior";
    }
    return { ...wall, type } satisfies BosWall;
  });
}
