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

type SplitPoint = BosPoint2 & { parameter: number };

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

function cross(a: BosPoint2, b: BosPoint2) {
  return a.x * b.y - a.y * b.x;
}

function segmentIntersection(a: BosWall, b: BosWall, tolerance: number) {
  const p = a.centerline.start;
  const q = b.centerline.start;
  const r = {
    x: a.centerline.end.x - a.centerline.start.x,
    y: a.centerline.end.y - a.centerline.start.y,
  };
  const s = {
    x: b.centerline.end.x - b.centerline.start.x,
    y: b.centerline.end.y - b.centerline.start.y,
  };
  const denominator = cross(r, s);
  const scale = Math.max(Math.hypot(r.x, r.y), Math.hypot(s.x, s.y), 1);
  if (Math.abs(denominator) <= tolerance / scale) return null;

  const qMinusP = { x: q.x - p.x, y: q.y - p.y };
  const t = cross(qMinusP, s) / denominator;
  const u = cross(qMinusP, r) / denominator;
  const endpointTolerance = Math.min(0.02, tolerance / scale);
  if (t < -endpointTolerance || t > 1 + endpointTolerance || u < -endpointTolerance || u > 1 + endpointTolerance) return null;

  return {
    point: { x: p.x + Math.max(0, Math.min(1, t)) * r.x, y: p.y + Math.max(0, Math.min(1, t)) * r.y },
    t: Math.max(0, Math.min(1, t)),
    u: Math.max(0, Math.min(1, u)),
  };
}

function buildNodes(walls: BosWall[], tolerance: number) {
  const nodes = new Map<string, Node>();
  const splitPoints = new Map<string, SplitPoint[]>();

  for (const wall of walls) {
    splitPoints.set(wall.id, [
      { ...wall.centerline.start, parameter: 0 },
      { ...wall.centerline.end, parameter: 1 },
    ]);
  }

  // Split centerlines where reconstructed walls meet in the middle of another wall. PDF
  // extraction commonly leaves a long exterior run intact while an interior partition ends on
  // it, so endpoint-only topology would miss otherwise valid bounded rooms.
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const intersection = segmentIntersection(walls[i], walls[j], tolerance);
      if (!intersection) continue;
      splitPoints.get(walls[i].id)?.push({ ...intersection.point, parameter: intersection.t });
      splitPoints.get(walls[j].id)?.push({ ...intersection.point, parameter: intersection.u });
    }
  }

  const ensure = (point: BosPoint2) => {
    const id = key(point, tolerance);
    const existing = nodes.get(id);
    if (existing) return existing;
    const node = { id, point: { ...point }, outgoing: [] } satisfies Node;
    nodes.set(id, node);
    return node;
  };

  for (const wall of walls) {
    const unique = new Map<string, SplitPoint>();
    for (const point of splitPoints.get(wall.id) || []) {
      const pointKey = key(point, tolerance);
      const previous = unique.get(pointKey);
      if (!previous || point.parameter < previous.parameter) unique.set(pointKey, point);
    }
    const ordered = [...unique.values()].sort((a, b) => a.parameter - b.parameter);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const start = ensure(ordered[index]);
      const end = ensure(ordered[index + 1]);
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
        while (guard < Math.max(16, walls.length * 8)) {
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
          algorithmVersion: "1.1.0",
          evidenceIds: [],
        },
      });
    });
  }
  return rooms;
}
