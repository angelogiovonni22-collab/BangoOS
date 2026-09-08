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

export function topologyMetrics(segments: BosLine2[], tolerance = DEFAULT_GEOMETRY_OPTIONS.snapTolerance) {
  const degree = new Map<string, number>();
  for (const segment of segments) {
    const start = nodeKey(segment.start, tolerance);
    const end = nodeKey(segment.end, tolerance);
    degree.set(start, (degree.get(start) || 0) + 1);
    degree.set(end, (degree.get(end) || 0) + 1);
  }
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
