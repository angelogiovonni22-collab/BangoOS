import type { BosLine2 } from "./building-graph";
import type { BosClassifiedPrimitive } from "./primitive-classifier";
import type { BosPdfPathCommand } from "./plan-parser";

export type BosWallFaceEvidence = {
  id: string;
  primitiveId: string;
  sourcePage: number;
  line: BosLine2;
  confidence: number;
};

export type BosWallSystemCandidate = {
  id: string;
  sourcePage: number;
  centerline: BosLine2;
  thickness: number;
  length: number;
  orientationRadians: number;
  faceA: BosWallFaceEvidence;
  faceB: BosWallFaceEvidence;
  overlapRatio: number;
  confidence: number;
};

export type BosWallSystemBuilderOptions = {
  drawingUnitsPerMeter: number;
  minWallLengthMeters?: number;
  minWallThicknessMeters?: number;
  maxWallThicknessMeters?: number;
  parallelToleranceRadians?: number;
  minOverlapRatio?: number;
};

type Point = { x: number; y: number };
type DrawingSegment = { start: Point; end: Point; primitiveId: string; sourcePage: number; confidence: number; ordinal: number };

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

function projection(point: Point, origin: Point, axis: Point) {
  return (point.x - origin.x) * axis.x + (point.y - origin.y) * axis.y;
}

function normalizeLineDirection(line: BosLine2): BosLine2 {
  const theta = angle(line);
  const axis = { x: Math.cos(theta), y: Math.sin(theta) };
  const a = projection(line.start, { x: 0, y: 0 }, axis);
  const b = projection(line.end, { x: 0, y: 0 }, axis);
  return a <= b ? line : { start: line.end, end: line.start };
}

function pathSegments(commands: readonly BosPdfPathCommand[], primitiveId: string, sourcePage: number, confidence: number) {
  const output: DrawingSegment[] = [];
  let current: Point | null = null;
  let subpathStart: Point | null = null;
  let ordinal = 0;
  const add = (start: Point, end: Point) => {
    if (Math.hypot(end.x - start.x, end.y - start.y) <= 0.01) return;
    output.push({ start, end, primitiveId, sourcePage, confidence, ordinal: ordinal++ });
  };

  for (const command of commands) {
    if (command.kind === "moveTo") {
      current = command.point;
      subpathStart = command.point;
    } else if (command.kind === "lineTo") {
      if (current) add(current, command.point);
      current = command.point;
    } else if (command.kind === "rectangle") {
      const [a, b, c, d] = command.points;
      add(a, b); add(b, c); add(c, d); add(d, a);
      current = a;
      subpathStart = a;
    } else if (command.kind === "curveTo" || command.kind === "curveTo2" || command.kind === "curveTo3") {
      current = command.point;
    } else if (command.kind === "closePath") {
      if (current && subpathStart) add(current, subpathStart);
      current = subpathStart;
    }
  }
  return output;
}

function toMeters(segment: DrawingSegment, drawingUnitsPerMeter: number): BosWallFaceEvidence {
  const factor = 1 / drawingUnitsPerMeter;
  return {
    id: `${segment.primitiveId}:face-${segment.ordinal}`,
    primitiveId: segment.primitiveId,
    sourcePage: segment.sourcePage,
    line: normalizeLineDirection({
      start: { x: segment.start.x * factor, y: segment.start.y * factor },
      end: { x: segment.end.x * factor, y: segment.end.y * factor },
    }),
    confidence: segment.confidence,
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
  return { axis, normal, origin, overlapStart, overlapEnd, overlap, overlapRatio: overlap / shorter, separation, separationDrift, signedOffset: (signedOffsetStart + signedOffsetEnd) / 2 };
}

function centerlineFromPair(a: BosLine2, metrics: ReturnType<typeof pairMetrics>): BosLine2 {
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

function scorePair(input: {
  overlapRatio: number;
  separation: number;
  separationDrift: number;
  minThickness: number;
  maxThickness: number;
  confidence: number;
}) {
  const nominalThickness = 0.1524;
  const thicknessRange = Math.max(0.001, input.maxThickness - input.minThickness);
  const thicknessFit = 1 - Math.min(1, Math.abs(input.separation - nominalThickness) / thicknessRange);
  const parallelFit = 1 - Math.min(1, input.separationDrift / Math.max(input.separation, 0.01));
  return input.overlapRatio * 0.5 + thicknessFit * 0.18 + parallelFit * 0.17 + input.confidence * 0.15;
}

/**
 * Converts only primitives already classified as wall-face evidence into explicit two-face wall
 * systems. It never bridges unsupported gaps and never creates a wall from a single face.
 */
export function buildWallSystemsFromClassifiedPrimitives(
  classified: readonly BosClassifiedPrimitive[],
  options: BosWallSystemBuilderOptions,
): BosWallSystemCandidate[] {
  if (!Number.isFinite(options.drawingUnitsPerMeter) || options.drawingUnitsPerMeter <= 0) return [];
  const minLength = options.minWallLengthMeters ?? 0.45;
  const minThickness = options.minWallThicknessMeters ?? 0.07;
  const maxThickness = options.maxWallThicknessMeters ?? 0.45;
  const parallelTolerance = options.parallelToleranceRadians ?? Math.PI / 180 * 1.75;
  const minOverlapRatio = options.minOverlapRatio ?? 0.45;

  const faces = classified
    .filter((item) => item.classification === "wall_face" && item.confidence >= 0.5)
    .flatMap((item) => pathSegments(item.primitive.commands, item.primitive.id, item.primitive.page, item.confidence))
    .map((segment) => toMeters(segment, options.drawingUnitsPerMeter))
    .filter((face) => length(face.line) >= minLength);

  const pairCandidates: Array<{ a: BosWallFaceEvidence; b: BosWallFaceEvidence; metrics: ReturnType<typeof pairMetrics>; score: number }> = [];
  for (let leftIndex = 0; leftIndex < faces.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < faces.length; rightIndex += 1) {
      const a = faces[leftIndex];
      const b = faces[rightIndex];
      if (a.sourcePage !== b.sourcePage) continue;
      if (a.primitiveId === b.primitiveId && a.id === b.id) continue;
      if (angleDelta(angle(a.line), angle(b.line)) > parallelTolerance) continue;
      const metrics = pairMetrics(a.line, b.line);
      if (metrics.overlapRatio < minOverlapRatio) continue;
      if (metrics.separation < minThickness || metrics.separation > maxThickness) continue;
      if (metrics.separationDrift > Math.max(0.02, metrics.separation * 0.12)) continue;
      const confidence = Math.min(a.confidence, b.confidence);
      pairCandidates.push({
        a,
        b,
        metrics,
        score: scorePair({
          overlapRatio: metrics.overlapRatio,
          separation: metrics.separation,
          separationDrift: metrics.separationDrift,
          minThickness,
          maxThickness,
          confidence,
        }),
      });
    }
  }

  pairCandidates.sort((left, right) => right.score - left.score);
  const usedFaces = new Set<string>();
  const systems: BosWallSystemCandidate[] = [];
  for (const candidate of pairCandidates) {
    if (usedFaces.has(candidate.a.id) || usedFaces.has(candidate.b.id)) continue;
    const centerline = centerlineFromPair(candidate.a.line, candidate.metrics);
    const wallLength = length(centerline);
    if (wallLength < minLength) continue;
    usedFaces.add(candidate.a.id);
    usedFaces.add(candidate.b.id);
    systems.push({
      id: `wall-system-${candidate.a.id}-${candidate.b.id}`,
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
