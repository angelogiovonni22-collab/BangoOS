import type { BosLine2 } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import type { BosWallFaceEvidence, BosWallSystemCandidate } from "./wall-system-builder";

export type BosRasterWallSystemBuilderOptions = {
  minWallLengthMeters?: number;
  minWallThicknessMeters?: number;
  maxWallThicknessMeters?: number;
  parallelToleranceRadians?: number;
  minOverlapRatio?: number;
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
  const delta = Math.abs(a - b);
  return Math.min(delta, Math.PI - delta);
}

function unit(line: BosLine2) {
  const size = length(line) || 1;
  return { x: (line.end.x - line.start.x) / size, y: (line.end.y - line.start.y) / size };
}

function projection(point: { x: number; y: number }, origin: { x: number; y: number }, axis: { x: number; y: number }) {
  return (point.x - origin.x) * axis.x + (point.y - origin.y) * axis.y;
}

function normalizeLineDirection(line: BosLine2): BosLine2 {
  const theta = angle(line);
  const axis = { x: Math.cos(theta), y: Math.sin(theta) };
  const first = projection(line.start, { x: 0, y: 0 }, axis);
  const second = projection(line.end, { x: 0, y: 0 }, axis);
  return first <= second ? line : { start: line.end, end: line.start };
}

function faceFromSegment(segment: BosRawSegment, ordinal: number): BosWallFaceEvidence {
  const sourceId = segment.sourceObjectId || `raster-face-${ordinal}`;
  return {
    id: `${sourceId}:face-${ordinal}`,
    primitiveId: sourceId,
    sourcePage: segment.sourcePage,
    line: normalizeLineDirection({ start: { ...segment.start }, end: { ...segment.end } }),
    confidence: segment.confidence ?? 0.62,
  };
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
  const shorter = Math.max(0.000001, Math.min(maxA - minA, maxB - minB));
  const signedOffsetStart = projection(b.start, origin, normal);
  const signedOffsetEnd = projection(b.end, origin, normal);
  const separation = (Math.abs(signedOffsetStart) + Math.abs(signedOffsetEnd)) / 2;
  const separationDrift = Math.abs(Math.abs(signedOffsetStart) - Math.abs(signedOffsetEnd));
  return {
    axis,
    normal,
    origin,
    overlapStart,
    overlapEnd,
    overlapRatio: overlap / shorter,
    separation,
    separationDrift,
    signedOffset: (signedOffsetStart + signedOffsetEnd) / 2,
  };
}

function centerlineFromPair(metrics: ReturnType<typeof pairMetrics>): BosLine2 {
  const offset = metrics.signedOffset / 2;
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

function pairScore(input: {
  overlapRatio: number;
  separation: number;
  separationDrift: number;
  confidence: number;
  minThickness: number;
  maxThickness: number;
}) {
  const nominalThickness = 0.1524;
  const range = Math.max(0.001, input.maxThickness - input.minThickness);
  const thicknessFit = 1 - Math.min(1, Math.abs(input.separation - nominalThickness) / range);
  const parallelFit = 1 - Math.min(1, input.separationDrift / Math.max(input.separation, 0.01));
  return input.overlapRatio * 0.5 + thicknessFit * 0.2 + parallelFit * 0.15 + input.confidence * 0.15;
}

/**
 * Builds explicit two-face wall systems from raster-derived line evidence already normalized to
 * meters. Spatial buckets are expanded by the maximum valid wall thickness so a legitimate face
 * pair cannot disappear merely because the two faces straddle a bucket boundary.
 */
export function buildWallSystemsFromRasterFaces(
  input: readonly BosRawSegment[],
  options: BosRasterWallSystemBuilderOptions = {},
): BosWallSystemCandidate[] {
  const minLength = options.minWallLengthMeters ?? 0.45;
  const minThickness = options.minWallThicknessMeters ?? 0.07;
  const maxThickness = options.maxWallThicknessMeters ?? 0.45;
  const parallelTolerance = options.parallelToleranceRadians ?? Math.PI / 180 * 1.75;
  const minOverlapRatio = options.minOverlapRatio ?? 0.45;
  const faces = input
    .filter((segment) => length(segment) >= minLength)
    .map((segment, index) => faceFromSegment(segment, index));
  if (faces.length < 2) return [];

  const bucketSize = 2;
  const buckets = new Map<string, number[]>();
  faces.forEach((face, index) => {
    const line = face.line;
    const minX = Math.floor((Math.min(line.start.x, line.end.x) - maxThickness) / bucketSize);
    const maxX = Math.floor((Math.max(line.start.x, line.end.x) + maxThickness) / bucketSize);
    const minY = Math.floor((Math.min(line.start.y, line.end.y) - maxThickness) / bucketSize);
    const maxY = Math.floor((Math.max(line.start.y, line.end.y) + maxThickness) / bucketSize);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = `${x}:${y}`;
        buckets.set(key, [...(buckets.get(key) || []), index]);
      }
    }
  });

  const candidates: Array<{
    a: BosWallFaceEvidence;
    b: BosWallFaceEvidence;
    metrics: ReturnType<typeof pairMetrics>;
    score: number;
  }> = [];
  const visited = new Set<string>();
  for (const indices of buckets.values()) {
    for (let left = 0; left < indices.length; left += 1) {
      for (let right = left + 1; right < indices.length; right += 1) {
        const aIndex = indices[left];
        const bIndex = indices[right];
        if (aIndex === bIndex) continue;
        const key = aIndex < bIndex ? `${aIndex}:${bIndex}` : `${bIndex}:${aIndex}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const a = faces[aIndex];
        const b = faces[bIndex];
        if (a.sourcePage !== b.sourcePage) continue;
        if (angleDelta(angle(a.line), angle(b.line)) > parallelTolerance) continue;
        const metrics = pairMetrics(a.line, b.line);
        if (metrics.overlapRatio < minOverlapRatio) continue;
        if (metrics.separation < minThickness || metrics.separation > maxThickness) continue;
        if (metrics.separationDrift > Math.max(0.02, metrics.separation * 0.12)) continue;
        const confidence = Math.min(a.confidence, b.confidence);
        candidates.push({
          a,
          b,
          metrics,
          score: pairScore({
            overlapRatio: metrics.overlapRatio,
            separation: metrics.separation,
            separationDrift: metrics.separationDrift,
            confidence,
            minThickness,
            maxThickness,
          }),
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const systems: BosWallSystemCandidate[] = [];
  for (const candidate of candidates) {
    if (used.has(candidate.a.id) || used.has(candidate.b.id)) continue;
    const centerline = centerlineFromPair(candidate.metrics);
    const wallLength = length(centerline);
    if (wallLength < minLength) continue;
    used.add(candidate.a.id);
    used.add(candidate.b.id);
    systems.push({
      id: `raster-wall-system-${candidate.a.id}-${candidate.b.id}`,
      sourcePage: candidate.a.sourcePage,
      centerline,
      thickness: candidate.metrics.separation,
      length: wallLength,
      orientationRadians: angle(centerline),
      faceA: candidate.a,
      faceB: candidate.b,
      overlapRatio: candidate.metrics.overlapRatio,
      confidence: Math.max(0, Math.min(0.98, candidate.score)),
    });
  }
  return systems;
}
