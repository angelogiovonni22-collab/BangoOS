import type { BosLine2 } from "./building-graph";
import { mergeCollinearSegments, type BosRawSegment } from "./geometry";

export type WallDetectionOptions = {
  minWallLength: number;
  minWallThickness: number;
  maxWallThickness: number;
  parallelToleranceRadians: number;
  minOverlapRatio: number;
};

export type WallAnnotationZone = {
  x: number;
  y: number;
  width: number;
  height: number;
  padding?: number;
};

export const DEFAULT_WALL_DETECTION_OPTIONS: WallDetectionOptions = {
  minWallLength: 0.45,
  minWallThickness: 0.07,
  maxWallThickness: 0.45,
  parallelToleranceRadians: Math.PI / 180 * 1.75,
  minOverlapRatio: 0.45,
};

function length(line: BosLine2) {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

function angle(line: BosLine2) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}

function angleDelta(a: number, b: number) {
  const diff = Math.abs(a - b);
  return Math.min(diff, Math.PI - diff);
}

function unit(line: BosLine2) {
  const size = length(line) || 1;
  return { x: (line.end.x - line.start.x) / size, y: (line.end.y - line.start.y) / size };
}

function projection(point: { x: number; y: number }, origin: { x: number; y: number }, axis: { x: number; y: number }) {
  return (point.x - origin.x) * axis.x + (point.y - origin.y) * axis.y;
}

function pairMetrics(a: BosLine2, b: BosLine2) {
  const axis = unit(a);
  const normal = { x: -axis.y, y: axis.x };
  const origin = a.start;
  const a0 = projection(a.start, origin, axis);
  const a1 = projection(a.end, origin, axis);
  const b0 = projection(b.start, origin, axis);
  const b1 = projection(b.end, origin, axis);
  const minA = Math.min(a0, a1);
  const maxA = Math.max(a0, a1);
  const minB = Math.min(b0, b1);
  const maxB = Math.max(b0, b1);
  const overlapStart = Math.max(minA, minB);
  const overlapEnd = Math.min(maxA, maxB);
  const overlap = Math.max(0, overlapEnd - overlapStart);
  const shorter = Math.max(0.0001, Math.min(maxA - minA, maxB - minB));
  const offset0 = Math.abs(projection(b.start, origin, normal));
  const offset1 = Math.abs(projection(b.end, origin, normal));
  return { axis, normal, origin, overlapStart, overlapEnd, overlapRatio: overlap / shorter, separation: (offset0 + offset1) / 2 };
}

function midpointLine(a: BosLine2, b: BosLine2, metrics: ReturnType<typeof pairMetrics>): BosLine2 {
  const signedB = projection(b.start, metrics.origin, metrics.normal);
  const offset = signedB / 2;
  return {
    start: {
      x: metrics.origin.x + metrics.axis.x * metrics.overlapStart + metrics.normal.x * offset,
      y: metrics.origin.y + metrics.axis.y * metrics.overlapStart + metrics.normal.y * offset,
    },
    end: {
      x: metrics.origin.x + metrics.axis.x * metrics.overlapEnd + metrics.normal.x * offset,
      y: metrics.origin.y + metrics.axis.y * metrics.overlapEnd + metrics.normal.y * offset,
    },
  };
}

function wallDetectionPreference(segment: BosRawSegment) {
  const standardThickness = 0.1524;
  const thicknessPenalty = Math.abs((segment.strokeWidth || standardThickness) - standardThickness);
  return (segment.confidence || 0) * 2 + Math.min(1, length(segment) / 8) - thicknessPenalty * 2;
}

function pointInsideAnnotationZone(point: { x: number; y: number }, zone: WallAnnotationZone) {
  const padding = zone.padding ?? 0.3;
  const minX = zone.x - padding;
  const maxX = zone.x + Math.max(0, zone.width) + padding;
  const minY = zone.y - padding;
  const maxY = zone.y + Math.max(0, zone.height) + padding;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

export function suppressDimensionAnnotationDetections(
  input: BosRawSegment[],
  zones: readonly WallAnnotationZone[],
) {
  if (!zones.length) return input;
  const maxAnnotationCandidateLength = 1.2;
  return input.filter((segment) => {
    if (length(segment) > maxAnnotationCandidateLength) return true;
    return !zones.some((zone) =>
      pointInsideAnnotationZone(segment.start, zone) && pointInsideAnnotationZone(segment.end, zone),
    );
  });
}

export function suppressNestedWallDetections(
  input: BosRawSegment[],
  options: WallDetectionOptions = DEFAULT_WALL_DETECTION_OPTIONS,
) {
  const ordered = [...input].sort((a, b) => wallDetectionPreference(b) - wallDetectionPreference(a));
  const selected: BosRawSegment[] = [];
  const centerlineTolerance = Math.min(0.18, options.maxWallThickness * 0.5);

  for (const candidate of ordered) {
    const duplicate = selected.some((current) => {
      if (angleDelta(angle(candidate), angle(current)) > options.parallelToleranceRadians * 1.5) return false;
      const metrics = pairMetrics(current, candidate);
      return metrics.overlapRatio >= 0.72 && metrics.separation <= centerlineTolerance;
    });
    if (!duplicate) selected.push(candidate);
  }
  return selected;
}

export function detectWallCenterlines(
  source: BosRawSegment[],
  options: WallDetectionOptions = DEFAULT_WALL_DETECTION_OPTIONS,
): BosRawSegment[] {
  const candidates = source.filter((segment) => length(segment) >= options.minWallLength);
  const detections: BosRawSegment[] = [];

  // Spatial buckets keep paired-line detection bounded on dense architectural PDFs.
  const bucketSize = 2;
  const buckets = new Map<string, number[]>();
  const keysFor = (segment: BosLine2) => {
    const minX = Math.floor(Math.min(segment.start.x, segment.end.x) / bucketSize);
    const maxX = Math.floor(Math.max(segment.start.x, segment.end.x) / bucketSize);
    const minY = Math.floor(Math.min(segment.start.y, segment.end.y) / bucketSize);
    const maxY = Math.floor(Math.max(segment.start.y, segment.end.y) / bucketSize);
    const keys: string[] = [];
    for (let x = minX; x <= maxX; x += 1) for (let y = minY; y <= maxY; y += 1) keys.push(`${x}:${y}`);
    return keys;
  };

  candidates.forEach((segment, index) => {
    for (const key of keysFor(segment)) {
      const bucket = buckets.get(key) || [];
      bucket.push(index);
      buckets.set(key, bucket);
    }
  });

  const visited = new Set<string>();
  for (const indices of buckets.values()) {
    for (let ai = 0; ai < indices.length; ai += 1) {
      for (let bi = ai + 1; bi < indices.length; bi += 1) {
        const aIndex = indices[ai];
        const bIndex = indices[bi];
        if (aIndex === bIndex) continue;
        const pairKey = aIndex < bIndex ? `${aIndex}:${bIndex}` : `${bIndex}:${aIndex}`;
        if (visited.has(pairKey)) continue;
        visited.add(pairKey);
        const a = candidates[aIndex];
        const b = candidates[bIndex];
        if (angleDelta(angle(a), angle(b)) > options.parallelToleranceRadians) continue;
        const metrics = pairMetrics(a, b);
        if (metrics.overlapRatio < options.minOverlapRatio) continue;
        if (metrics.separation < options.minWallThickness || metrics.separation > options.maxWallThickness) continue;
        const centerline = midpointLine(a, b, metrics);
        if (length(centerline) < options.minWallLength) continue;
        detections.push({
          ...centerline,
          sourcePage: a.sourcePage,
          sourceObjectId: `${a.sourceObjectId || "vector"}+${b.sourceObjectId || "vector"}`,
          strokeWidth: metrics.separation,
          confidence: Math.min(0.98, 0.68 + metrics.overlapRatio * 0.22 + Math.min(0.08, length(centerline) / 100)),
        });
      }
    }
  }

  return mergeCollinearSegments(suppressNestedWallDetections(detections, options), {
    snapTolerance: 0.08,
    collinearToleranceRadians: Math.PI / 180 * 2,
    minLength: options.minWallLength,
    wallThickness: 0.1524,
    wallHeight: 2.4384,
  });
}

export function scaleSegmentsToMeters(segments: BosRawSegment[], drawingUnitsPerMeter: number): BosRawSegment[] {
  if (!Number.isFinite(drawingUnitsPerMeter) || drawingUnitsPerMeter <= 0) throw new Error("A verified drawing scale is required before vector geometry can be converted to meters.");
  const factor = 1 / drawingUnitsPerMeter;
  return segments.map((segment) => ({
    ...segment,
    start: { x: segment.start.x * factor, y: segment.start.y * factor },
    end: { x: segment.end.x * factor, y: segment.end.y * factor },
    strokeWidth: segment.strokeWidth === undefined ? undefined : segment.strokeWidth * factor,
  }));
}