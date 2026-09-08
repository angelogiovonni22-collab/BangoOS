import type { BosBuildingGraph, BosPoint2, BosPolygon2, BosRoom, BosWall } from "./building-graph";

export type RoomTracingOptions = {
  snapTolerance: number;
  minArea: number;
  maxArea: number;
};

export const DEFAULT_ROOM_TRACING_OPTIONS: RoomTracingOptions = {
  snapTolerance: 0.12,
  minArea: 1.2,
  maxArea: 900,
};

type Node = { id: string; point: BosPoint2; outgoing: Array<{ to: string; wallId: string; angle: number }> };

function key(point: BosPoint2, tolerance: number) {
  return `${Math.round(point.x / tolerance)}:${Math.round(point.y / tolerance)}`;
}

function signedArea(points: BosPoint2[]) {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += a.x * b.y - b.x * a.y;
  }
  return total / 2;
}

function polygonKey(points: BosPoint2[]) {
  const normalized = points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`);
  const rotations = normalized.map((_, index) => [...normalized.slice(index), ...normalized.slice(0, index)].join("|"));
  const reversed = [...normalized].reverse();
  rotations.push(...reversed.map((_, index) => [...reversed.slice(index), ...reversed.slice(0, index)].join("|")));
  return rotations.sort()[0];
}

function buildNodes(walls: BosWall[], tolerance: number) {
  const nodes = new Map<string, Node>();
  const ensure = (point: BosPoint2) => {
    const id = key(point, tolerance);
    const existing = nodes.get(id);
    if (existing) return existing;
    const node = { id, point: { ...point }, outgoing: [] } satisfies Node;
    nodes.set(id, node);
    return node;
  };

  for (const wall of walls) {
    const start = ensure(wall.centerline.start);
    const end = ensure(wall.centerline.end);
    if (start.id === end.id) continue;
    start.outgoing.push({
      to: end.id,
      wallId: wall.id,
      angle: Math.atan2(end.point.y - start.point.y, end.point.x - start.point.x),
    });
    end.outgoing.push({
      to: start.id,
      wallId: wall.id,
      angle: Math.atan2(start.point.y - end.point.y, start.point.x - end.point.x),
    });
  }
  for (const node of nodes.values()) node.outgoing.sort((a, b) => a.angle - b.angle);
  return nodes;
}

function nextHalfEdge(nodes: Map<string, Node>, from: string, to: string) {
  const node = nodes.get(to);
  const previous = nodes.get(from);
  if (!node || !previous || !node.outgoing.length) return null;
  const incomingAngle = Math.atan2(previous.point.y - node.point.y, previous.point.x - node.point.x);
  let best: { to: string; wallId: string; angle: number } | null = null;
  let bestTurn = Number.POSITIVE_INFINITY;
  for (const candidate of node.outgoing) {
    if (candidate.to === from && node.outgoing.length > 1) continue;
    let turn = incomingAngle - candidate.angle;
    while (turn <= 0) turn += Math.PI * 2;
    if (turn < bestTurn) {
      bestTurn = turn;
      best = candidate;
    }
  }
  return best;
}

export function pointInBosPolygon(point: BosPoint2, polygon: BosPolygon2) {
  let inside = false;
  const points = polygon.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function traceWallBoundedRooms(
  graph: BosBuildingGraph,
  options: RoomTracingOptions = DEFAULT_ROOM_TRACING_OPTIONS,
): BosRoom[] {
  const rooms: BosRoom[] = [];
  for (const level of graph.levels) {
    const walls = graph.walls.filter((wall) => wall.levelId === level.id);
    const nodes = buildNodes(walls, options.snapTolerance);
    const visited = new Set<string>();
    const faces = new Map<string, { points: BosPoint2[]; wallIds: string[]; area: number }>();

    for (const node of nodes.values()) {
      for (const edge of node.outgoing) {
        const initial = `${node.id}->${edge.to}`;
        if (visited.has(initial)) continue;
        const points: BosPoint2[] = [];
        const wallIds: string[] = [];
        let from = node.id;
        let to = edge.to;
        let guard = 0;
        while (guard < Math.max(16, walls.length * 4)) {
          guard += 1;
          const half = `${from}->${to}`;
          if (visited.has(half) && half !== initial) break;
          visited.add(half);
          const fromNode = nodes.get(from);
          if (!fromNode) break;
          points.push(fromNode.point);
          const outgoing = nodes.get(from)?.outgoing.find((candidate) => candidate.to === to);
          if (outgoing) wallIds.push(outgoing.wallId);
          const next = nextHalfEdge(nodes, from, to);
          if (!next) break;
          from = to;
          to = next.to;
          if (`${from}->${to}` === initial) {
            const area = signedArea(points);
            const absoluteArea = Math.abs(area);
            if (points.length >= 3 && area > 0 && absoluteArea >= options.minArea && absoluteArea <= options.maxArea) {
              const faceKey = polygonKey(points);
              faces.set(faceKey, { points: points.map((point) => ({ ...point })), wallIds: [...new Set(wallIds)], area: absoluteArea });
            }
            break;
          }
        }
      }
    }

    const ordered = [...faces.values()].sort((a, b) => a.area - b.area);
    ordered.forEach((face, index) => {
      const confidence = Math.min(0.9, 0.58 + Math.min(0.22, face.wallIds.length * 0.02));
      rooms.push({
        id: `room-traced-${level.id}-${index + 1}`,
        levelId: level.id,
        type: "room",
        name: `Room ${index + 1}`,
        polygon: { points: face.points },
        confidence,
        sourcePage: walls.find((wall) => face.wallIds.includes(wall.id))?.sourcePage || level.sourcePage || 1,
        evidence: [],
        provenance: {
          createdBy: "deterministic",
          algorithm: "wall-bounded-face-tracing",
          algorithmVersion: "1.0.0",
          evidenceIds: [],
        },
      });
    });
  }
  return rooms;
}
