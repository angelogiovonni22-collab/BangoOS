import type { BosLine2 } from "./building-graph";
import type { BosRawSegment } from "./geometry";

export type SourceAlignmentReport = {
  score: number;
  supported: number;
  total: number;
  meanDistance: number;
  maxDistance: number;
  diagnostics: string[];
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

function angleDelta(left: number, right: number) {
  const raw = Math.abs(left - right);
  return Math.min(raw, Math.PI - raw);
}

function pointToInfiniteLineDistance(point: { x: number; y: number }, line: BosLine2) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const size = Math.hypot(dx, dy);
  if (size <= Number.EPSILON) return Math.hypot(point.x - line.start.x, point.y - line.start.y);
  return Math.abs(dy * point.x - dx * point.y + line.end.x * line.start.y - line.end.y * line.start.x) / size;
}

function projectionRange(line: BosLine2, axis: { x: number; y: number }) {
  const first = line.start.x * axis.x + line.start.y * axis.y;
  const second = line.end.x * axis.x + line.end.y * axis.y;
  return { min: Math.min(first, second), max: Math.max(first, second) };
}

function overlapRatio(candidate: BosLine2, evidence: BosLine2) {
  const candidateLength = length(candidate);
  if (candidateLength <= Number.EPSILON) return 0;
  const axis = {
    x: (candidate.end.x - candidate.start.x) / candidateLength,
    y: (candidate.end.y - candidate.start.y) / candidateLength,
  };
  const left = projectionRange(candidate, axis);
  const right = projectionRange(evidence, axis);
  const overlap = Math.max(0, Math.min(left.max, right.max) - Math.max(left.min, right.min));
  return Math.min(1, overlap / candidateLength);
}

function supportFor(candidate: BosRawSegment, source: readonly BosRawSegment[]) {
  const candidateAngle = angle(candidate);
  let best: { score: number; distance: number; overlap: number } | null = null;
  for (const evidence of source) {
    if (angleDelta(candidateAngle, angle(evidence)) > Math.PI / 180 * 3.5) continue;
    const overlap = overlapRatio(candidate, evidence);
    if (overlap < 0.35) continue;
    const startDistance = pointToInfiniteLineDistance(candidate.start, evidence);
    const endDistance = pointToInfiniteLineDistance(candidate.end, evidence);
    const distance = (startDistance + endDistance) / 2;
    if (distance > 0.38) continue;
    const proximity = Math.max(0, 1 - distance / 0.38);
    const score = overlap * 0.7 + proximity * 0.3;
    if (!best || score > best.score) best = { score, distance, overlap };
  }
  return best;
}

export function assessSourceGeometryAlignment(
  reconstructed: readonly BosRawSegment[],
  source: readonly BosRawSegment[],
): SourceAlignmentReport {
  if (!reconstructed.length || !source.length) {
    return {
      score: 0,
      supported: 0,
      total: reconstructed.length,
      meanDistance: 0,
      maxDistance: 0,
      diagnostics: ["Source alignment could not be established because reconstructed or source geometry was empty."],
    };
  }

  let weightedScore = 0;
  let totalLength = 0;
  let supported = 0;
  const distances: number[] = [];
  for (const candidate of reconstructed) {
    const candidateLength = Math.max(0.001, length(candidate));
    totalLength += candidateLength;
    const support = supportFor(candidate, source);
    if (!support) continue;
    supported += 1;
    weightedScore += support.score * candidateLength;
    distances.push(support.distance);
  }

  const score = totalLength > 0 ? Math.max(0, Math.min(1, weightedScore / totalLength)) : 0;
  const meanDistance = distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 0;
  const maxDistance = distances.length ? Math.max(...distances) : 0;
  const diagnostics: string[] = [];
  diagnostics.push(`Source alignment supports ${supported} of ${reconstructed.length} reconstructed wall runs with a length-weighted fidelity score of ${score.toFixed(3)}.`);
  if (score < 0.65) diagnostics.push("Reconstructed geometry diverges materially from source linework and must remain review-gated.");

  return { score, supported, total: reconstructed.length, meanDistance, maxDistance, diagnostics };
}
