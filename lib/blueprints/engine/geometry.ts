import type { BosLine2, BosPoint2, BosWall, BosWallType } from "./building-graph";

export type BosRawSegment = BosLine2 & {
  sourcePage: number;
  sourceObjectId?: string;
  strokeWidth?: number;
  confidence?: number;
};

export type GeometryOptions = {
  snapTolerance: number;
  collinearToleranceRadians: number;
  minLength: number;
  wallThickness: number;
  wallHeight: number;
};

export const DEFAULT_GEOMETRY_OPTIONS: GeometryOptions = {
  snapTolerance: 0.06,
  collinearToleranceRadians: Math.PI / 180 * 2,
  minLength: 0.12,
  wallThickness: 0.1524,
  wallHeight: 2.4384,
};

function distance(a: BosPoint2, b: BosPoint2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function segmentLength(segment: BosLine2) {
  return distance(segment.start, segment.end);
}

function quantize(value: number, tolerance: number) {
  return Math.round(value / tolerance) * tolerance;
}

export function snapSegments(segments: BosRawSegment[], tolerance: number) {
  return segments.map((segment) => ({
    ...segment,
    start: { x: quantize(segment.start.x, tolerance), y: quantize(segment.start.y, tolerance) },
    end: { x: quantize(segment.end.x, tolerance), y: quantize(segment.end.y, tolerance) },
  })).filter((segment) => segmentLength(segment) >= tolerance);
}

function normalizedAngle(segment: BosLine2) {
  let angle = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x);
  if (angle < 0) angle += Math.PI;
  if (angle >= Math.PI) angle -= Math.PI;
  return angle;
}

function angleDelta(a: number, b: number) {
  const raw = Math.abs(a - b);
  return Math.min(raw, Math.PI - raw);
}

function pointLineDistance(point: BosPoint2, line: BosLine2) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return distance(point, line.start);
  const t = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / lengthSquared;
  const projection = { x: line.start.x + t * dx, y: line.start.y + t * dy };
  return distance(point, projection);
}

function canMerge(a: BosRawSegment, b: BosRawSegment, options: GeometryOptions) {
  if (angleDelta(normalizedAngle(a), normalizedAngle(b)) > options.collinearToleranceRadians) return false;
  if (pointLineDistance(b.start, a) > options.snapTolerance || pointLineDistance(b.end, a) > options.snapTolerance) return false;
  const endpoints = [distance(a.start, b.start), distance(a.start, b.end), distance(a.end, b.start), distance(a.end, b.end)];
  const minEndpoint = Math.min(...endpoints);
  if (minEndpoint <= options.snapTolerance * 2) return true;

  const axisX = Math.abs(a.end.x - a.start.x) >= Math.abs(a.end.y - a.start.y);
  const aMin = Math.min(axisX ? a.start.x : a.start.y, axisX ? a.end.x : a.end.y);
  const aMax = Math.max(axisX ? a.start.x : a.start.y, axisX ? a.end.x : a.end.y);
  const bMin = Math.min(axisX ? b.start.x : b.start.y, axisX ? b.end.x : b.end.y);
  const bMax = Math.max(axisX ? b.start.x : b.start.y, axisX ? b.end.x : b.end.y);
  return Math.min(aMax, bMax) >= Math.max(aMin, bMin) - options.snapTolerance;
}

function mergePair(a: BosRawSegment, b: BosRawSegment): BosRawSegment {
  const points = [a.start, a.end, b.start, b.end];
  let bestStart = points[0];
  let bestEnd = points[1];
  let bestDistance = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const candidate = distance(points[i], points[j]);
      if (candidate > bestDistance) {
        bestDistance = candidate;
        bestStart = points[i];
        bestEnd = points[j];
      }
    }
  }
  return {
    start: bestStart,
    end: bestEnd,
    sourcePage: a.sourcePage,
    sourceObjectId: a.sourceObjectId || b.sourceObjectId,
    strokeWidth: Math.max(a.strokeWidth || 0, b.strokeWidth || 0) || undefined,
    confidence: Math.min(a.confidence ?? 1, b.confidence ?? 1),
  };
}

export function mergeCollinearSegments(input: BosRawSegment[], options: GeometryOptions = DEFAULT_GEOMETRY_OPTIONS) {
  const segments = snapSegments(input, options.snapTolerance).filter((segment) => segmentLength(segment) >= options.minLength);
  const output: BosRawSegment[] = [];
  for (const segment of segments.sort((a, b) => segmentLength(b) - segmentLength(a))) {
    let candidate = segment;
    let merged = true;
    while (merged) {
      merged = false;
      const index = output.findIndex((current) => canMerge(candidate, current, options));
      if (index >= 0) {
        candidate = mergePair(candidate, output[index]);
        output.splice(index, 1);
        merged = true;
      }
    }
    output.push(candidate);
  }
  return output;
}

function nodeKey(point: BosPoint2, tolerance: number) {
  return `${Math.round(point.x / tolerance)}:${Math.round(point.y / tolerance)}`;
}

export function topologyMetrics(segments: BosLine2[], tolerance = 0.12) {
  if (segments.length === 0) return { nodes: 0, dangling: 0, junctions: 0, closure: 0 };

  type SplitPoint = BosPoint2 & { parameter: number };
  type Edge = { start: string; end: string; length: number };
  const splitPoints: SplitPoint[][] = segments.map((segment) => [
    { ...segment.start, parameter: 0 },
    { ...segment.end, parameter: 1 },
  ]);

  const cross = (a: BosPoint2, b: BosPoint2) => a.x * b.y - a.y * b.x;
  const projectFinite = (point: BosPoint2, line: BosLine2) => {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= Number.EPSILON) return null;
    const parameter = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / lengthSquared;
    if (parameter < 0 || parameter > 1) return null;
    const projected = { x: line.start.x + parameter * dx, y: line.start.y + parameter * dy };
    return { parameter, projected, distance: distance(point, projected) };
  };

  for (let i = 0; i < segments.length; i += 1) {
    const a = segments[i];
    const r = { x: a.end.x - a.start.x, y: a.end.y - a.start.y };
    for (let j = i + 1; j < segments.length; j += 1) {
      const b = segments[j];
      const s = { x: b.end.x - b.start.x, y: b.end.y - b.start.y };
      const denominator = cross(r, s);
      const scale = Math.max(segmentLength(a), segmentLength(b), 1);
      let junction: { point: BosPoint2; t: number; u: number } | null = null;

      if (Math.abs(denominator) > tolerance / scale) {
        const qMinusP = { x: b.start.x - a.start.x, y: b.start.y - a.start.y };
        const t = cross(qMinusP, s) / denominator;
        const u = cross(qMinusP, r) / denominator;
        const endpointTolerance = Math.min(0.02, tolerance / scale);
        if (t >= -endpointTolerance && t <= 1 + endpointTolerance && u >= -endpointTolerance && u <= 1 + endpointTolerance) {
          const clampedT = Math.max(0, Math.min(1, t));
          const clampedU = Math.max(0, Math.min(1, u));
          junction = {
            point: { x: a.start.x + clampedT * r.x, y: a.start.y + clampedT * r.y },
            t: clampedT,
            u: clampedU,
          };
        }
      }

      if (!junction && Math.abs(denominator) > tolerance / scale) {
        const candidates: Array<{ distance: number; point: BosPoint2; t: number; u: number }> = [];
        for (const endpoint of [{ point: a.start, parameter: 0 }, { point: a.end, parameter: 1 }]) {
          const projection = projectFinite(endpoint.point, b);
          if (projection && projection.distance <= tolerance) candidates.push({ distance: projection.distance, point: projection.projected, t: endpoint.parameter, u: projection.parameter });
        }
        for (const endpoint of [{ point: b.start, parameter: 0 }, { point: b.end, parameter: 1 }]) {
          const projection = projectFinite(endpoint.point, a);
          if (projection && projection.distance <= tolerance) candidates.push({ distance: projection.distance, point: projection.projected, t: projection.parameter, u: endpoint.parameter });
        }
        candidates.sort((left, right) => left.distance - right.distance);
        const nearest = candidates[0];
        if (nearest) junction = { point: nearest.point, t: nearest.t, u: nearest.u };
      }

      if (!junction) continue;
      splitPoints[i].push({ ...junction.point, parameter: junction.t });
      splitPoints[j].push({ ...junction.point, parameter: junction.u });
    }
  }

  const edges: Edge[] = [];
  for (const points of splitPoints) {
    const unique = new Map<string, SplitPoint>();
    for (const point of points) {
      const key = nodeKey(point, tolerance);
      const current = unique.get(key);
      if (!current || point.parameter < current.parameter) unique.set(key, point);
    }
    const ordered = [...unique.values()].sort((a, b) => a.parameter - b.parameter);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const start = nodeKey(ordered[index], tolerance);
      const end = nodeKey(ordered[index + 1], tolerance);
      if (start === end) continue;
      edges.push({ start, end, length: distance(ordered[index], ordered[index + 1]) });
    }
  }

  // Intersection splitting can leave tiny dangling stubs where raster centerlines cross within a
  // few pixels of a junction. Ignore only short leaf fragments; do not bridge or delete geometry.
  const active = edges.map(() => true);
  const maxDanglingStub = 0.4;
  let changed = true;
  while (changed) {
    changed = false;
    const degree = new Map<string, number>();
    edges.forEach((edge, index) => {
      if (!active[index]) return;
      degree.set(edge.start, (degree.get(edge.start) || 0) + 1);
      degree.set(edge.end, (degree.get(edge.end) || 0) + 1);
    });
    edges.forEach((edge, index) => {
      if (!active[index] || edge.length >= maxDanglingStub) return;
      if ((degree.get(edge.start) || 0) === 1 || (degree.get(edge.end) || 0) === 1) {
        active[index] = false;
        changed = true;
      }
    });
  }

  const degree = new Map<string, number>();
  edges.forEach((edge, index) => {
    if (!active[index]) return;
    degree.set(edge.start, (degree.get(edge.start) || 0) + 1);
    degree.set(edge.end, (degree.get(edge.end) || 0) + 1);
  });
  const nodes = degree.size;
  const dangling = [...degree.values()].filter((value) => value === 1).length;
  const junctions = [...degree.values()].filter((value) => value >= 3).length;
  return {
    nodes,
    dangling,
    junctions,
    closure: nodes === 0 ? 0 : Math.max(0, 1 - dangling / nodes),
  };
}

export function footprintComplexity(segments: BosLine2[]) {
  if (segments.length < 3) return 0;
  const xs = segments.flatMap((segment) => [segment.start.x, segment.end.x]);
  const ys = segments.flatMap((segment) => [segment.start.y, segment.end.y]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const perimeter = segments.reduce((sum, segment) => sum + segmentLength(segment), 0);
  const rectanglePerimeter = 2 * (width + height);
  if (rectanglePerimeter <= 0) return 0;
  const segmentFactor = Math.min(1, Math.max(0, (segments.length - 4) / 12));
  const perimeterFactor = Math.min(1, Math.abs(perimeter - rectanglePerimeter) / rectanglePerimeter * 2);
  return Math.max(segmentFactor, perimeterFactor);
}

export function segmentsToWalls(
  segments: BosRawSegment[],
  input: { levelId: string; type?: BosWallType; options?: GeometryOptions },
): BosWall[] {
  const options = input.options || DEFAULT_GEOMETRY_OPTIONS;
  const merged = mergeCollinearSegments(segments, options);
  return merged.map((segment, index) => {
    const evidenceId = `segment-${segment.sourcePage}-${index + 1}`;
    return {
      id: `wall-${input.levelId}-${index + 1}`,
      levelId: input.levelId,
      type: input.type || "unknown",
      centerline: { start: segment.start, end: segment.end },
      thickness: segment.strokeWidth && segment.strokeWidth > 0.05 ? segment.strokeWidth : options.wallThickness,
      height: options.wallHeight,
      confidence: Math.max(0, Math.min(1, segment.confidence ?? 0.75)),
      sourcePage: segment.sourcePage,
      evidence: [{ id: evidenceId, page: segment.sourcePage, kind: "pdf_vector", sourceObjectId: segment.sourceObjectId }],
      provenance: { createdBy: "deterministic", algorithm: "bos-vector-line-normalizer", algorithmVersion: "1.0.0", evidenceIds: [evidenceId] },
    };
  });
}