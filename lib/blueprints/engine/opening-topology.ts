import type { BosBuildingGraph, BosPoint2, BosWall } from "./building-graph";

function wallLength(wall: BosWall) {
  return Math.hypot(
    wall.centerline.end.x - wall.centerline.start.x,
    wall.centerline.end.y - wall.centerline.start.y,
  );
}

function direction(wall: BosWall) {
  const length = wallLength(wall) || 1;
  return {
    x: (wall.centerline.end.x - wall.centerline.start.x) / length,
    y: (wall.centerline.end.y - wall.centerline.start.y) / length,
  };
}

function angleDelta(a: BosWall, b: BosWall) {
  const left = direction(a);
  const right = direction(b);
  const dot = Math.max(-1, Math.min(1, left.x * right.x + left.y * right.y));
  return Math.acos(Math.abs(dot));
}

function pointLineDistance(point: BosPoint2, wall: BosWall) {
  const axis = direction(wall);
  const normal = { x: -axis.y, y: axis.x };
  return Math.abs(
    (point.x - wall.centerline.start.x) * normal.x +
    (point.y - wall.centerline.start.y) * normal.y,
  );
}

function nearestEndpoints(a: BosWall, b: BosWall) {
  const pairs = [
    [a.centerline.start, b.centerline.start],
    [a.centerline.start, b.centerline.end],
    [a.centerline.end, b.centerline.start],
    [a.centerline.end, b.centerline.end],
  ] as const;
  return pairs
    .map(([left, right]) => ({
      left,
      right,
      gap: Math.hypot(right.x - left.x, right.y - left.y),
    }))
    .sort((left, right) => left.gap - right.gap)[0];
}

function geometryKey(start: BosPoint2, end: BosPoint2) {
  const a = `${start.x.toFixed(3)},${start.y.toFixed(3)}`;
  const b = `${end.x.toFixed(3)},${end.y.toFixed(3)}`;
  return [a, b].sort().join("|");
}

/**
 * Build virtual wall closures only across gaps that the canonical opening detector has already
 * recognized as a door or window. These walls are used for topology/room inference only and are
 * never persisted as authoritative physical walls.
 */
export function buildOpeningTopologyClosures(graph: BosBuildingGraph, levelId?: string): BosWall[] {
  const wallsById = new Map(graph.walls.map((wall) => [wall.id, wall]));
  const closures = new Map<string, BosWall>();

  for (const opening of graph.openings) {
    if (levelId && opening.levelId !== levelId) continue;
    if (opening.confidence < 0.6) continue;
    if (opening.type !== "door" && opening.type !== "window") continue;
    if (opening.width < 0.58 || opening.width > 2.6) continue;

    const anchor = wallsById.get(opening.wallId);
    if (!anchor) continue;

    const candidates = graph.walls
      .filter((wall) => wall.id !== anchor.id && wall.levelId === anchor.levelId && wall.type === anchor.type)
      .filter((wall) => angleDelta(anchor, wall) <= Math.PI / 180 * 2)
      .filter((wall) => pointLineDistance(wall.centerline.start, anchor) <= Math.max(0.1, (anchor.thickness + wall.thickness) / 2))
      .map((wall) => ({ wall, pair: nearestEndpoints(anchor, wall) }))
      .filter(({ pair }) => Math.abs(pair.gap - opening.width) <= 0.09)
      .sort((left, right) => Math.abs(left.pair.gap - opening.width) - Math.abs(right.pair.gap - opening.width));

    const match = candidates[0];
    if (!match) continue;
    const start = { ...match.pair.left };
    const end = { ...match.pair.right };
    const key = geometryKey(start, end);
    if (closures.has(key)) continue;

    closures.set(key, {
      id: `opening-topology-${opening.id}`,
      levelId: opening.levelId,
      type: anchor.type,
      centerline: { start, end },
      thickness: Math.max(anchor.thickness, match.wall.thickness),
      height: Math.max(anchor.height, match.wall.height),
      confidence: opening.confidence,
      sourcePage: opening.sourcePage,
      evidence: opening.evidence,
      provenance: {
        createdBy: "deterministic",
        algorithm: "opening-aware-topology-closure",
        algorithmVersion: "1.0.0",
        evidenceIds: opening.evidence.map((item) => item.id),
      },
    });
  }

  return [...closures.values()];
}

export function openingAwareWallCenterlines(graph: BosBuildingGraph, walls: BosWall[] = graph.walls) {
  const allowedIds = new Set(walls.map((wall) => wall.id));
  const levelIds = new Set(walls.map((wall) => wall.levelId));
  const closures = [...levelIds].flatMap((levelId) => buildOpeningTopologyClosures(graph, levelId))
    .filter((wall) => {
      const evidenceWall = graph.openings.find((opening) => wall.id === `opening-topology-${opening.id}`)?.wallId;
      return !evidenceWall || allowedIds.has(evidenceWall);
    });
  return [...walls.map((wall) => wall.centerline), ...closures.map((wall) => wall.centerline)];
}
