import type { BosLine2 } from "./building-graph";
import type { BosRawSegment } from "./geometry";

export type NearCollinearGapRepairOptions = {
  maxGap: number;
  maxLineOffset: number;
  maxAngleRadians: number;
  minSegmentLength: number;
};

export const DEFAULT_NEAR_COLLINEAR_GAP_REPAIR_OPTIONS: NearCollinearGapRepairOptions = {
  maxGap: 0.28,
  maxLineOffset: 0.06,
  maxAngleRadians: Math.PI / 180 * 2,
  minSegmentLength: 0.45,
};

function length(line: BosLine2) {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

function normalizedAngle(line: BosLine2) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}

function angleDelta(a: number, b: number) {
  const diff = Math.abs(a - b);
  return Math.min(diff, Math.PI - diff);
}

function pointLineDistance(point: { x: number; y: number }, line: BosLine2) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const denominator = dx * dx + dy * dy;
  if (denominator <= Number.EPSILON) return Math.hypot(point.x - line.start.x, point.y - line.start.y);
  const t = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / denominator;
  const x = line.start.x + t * dx;
  const y = line.start.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function nearestEndpoints(a: BosRawSegment, b: BosRawSegment) {
  const pairs = [
    { a: a.start, b: b.start },
    { a: a.start, b: b.end },
    { a: a.end, b: b.start },
    { a: a.end, b: b.end },
  ].map((pair) => ({ ...pair, gap: Math.hypot(pair.a.x - pair.b.x, pair.a.y - pair.b.y) }));
  return pairs.sort((left, right) => left.gap - right.gap)[0];
}

function plausibleThicknessPair(a: BosRawSegment, b: BosRawSegment) {
  if (a.strokeWidth === undefined || b.strokeWidth === undefined) return true;
  const max = Math.max(a.strokeWidth, b.strokeWidth, 0.001);
  const min = Math.min(a.strokeWidth, b.strokeWidth);
  return min / max >= 0.45;
}

function canRepair(a: BosRawSegment, b: BosRawSegment, options: NearCollinearGapRepairOptions) {
  if (length(a) < options.minSegmentLength || length(b) < options.minSegmentLength) return false;
  if (angleDelta(normalizedAngle(a), normalizedAngle(b)) > options.maxAngleRadians) return false;
  if (!plausibleThicknessPair(a, b)) return false;
  const nearest = nearestEndpoints(a, b);
  if (nearest.gap <= 0.16 || nearest.gap > options.maxGap) return false;
  if (pointLineDistance(nearest.a, b) > options.maxLineOffset) return false;
  if (pointLineDistance(nearest.b, a) > options.maxLineOffset) return false;
  return true;
}

function merge(a: BosRawSegment, b: BosRawSegment): BosRawSegment {
  const points = [a.start, a.end, b.start, b.end];
  let start = points[0];
  let end = points[1];
  let best = -1;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const candidate = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (candidate > best) {
        best = candidate;
        start = points[i];
        end = points[j];
      }
    }
  }
  return {
    start,
    end,
    sourcePage: a.sourcePage,
    sourceObjectId: [a.sourceObjectId, b.sourceObjectId].filter(Boolean).join("+") || undefined,
    strokeWidth: Math.max(a.strokeWidth || 0, b.strokeWidth || 0) || undefined,
    confidence: Math.min(a.confidence ?? 1, b.confidence ?? 1),
  };
}

/** Repairs only small collinear centerline misses between already-detected wall runs. */
export function repairNearCollinearWallGaps(
  input: BosRawSegment[],
  options: NearCollinearGapRepairOptions = DEFAULT_NEAR_COLLINEAR_GAP_REPAIR_OPTIONS,
) {
  const output = [...input];
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < output.length; i += 1) {
      for (let j = i + 1; j < output.length; j += 1) {
        if (!canRepair(output[i], output[j], options)) continue;
        const merged = merge(output[i], output[j]);
        output.splice(j, 1);
        output.splice(i, 1, merged);
        changed = true;
        break outer;
      }
    }
  }
  return output;
}
