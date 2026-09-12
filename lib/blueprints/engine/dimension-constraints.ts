import type { BosDimension, BosPoint2, BosWall } from "./building-graph";

export type DimensionConstraintResult = {
  walls: BosWall[];
  dimensions: BosDimension[];
  matched: number;
  adjusted: number;
  diagnostics: string[];
};

function distance(a: BosPoint2, b: BosPoint2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function wallLength(wall: BosWall) {
  return distance(wall.centerline.start, wall.centerline.end);
}

function midpoint(wall: BosWall) {
  return {
    x: (wall.centerline.start.x + wall.centerline.end.x) / 2,
    y: (wall.centerline.start.y + wall.centerline.end.y) / 2,
  };
}

function wallOrientation(wall: BosWall) {
  const dx = Math.abs(wall.centerline.end.x - wall.centerline.start.x);
  const dy = Math.abs(wall.centerline.end.y - wall.centerline.start.y);
  return dx >= dy ? "horizontal" as const : "vertical" as const;
}

function labelCenter(dimension: BosDimension, drawingUnitsPerMeter: number) {
  const bbox = dimension.evidence.find((evidence) => evidence.bbox)?.bbox;
  if (!bbox || !drawingUnitsPerMeter || drawingUnitsPerMeter <= 0) return null;
  return {
    point: {
      x: (bbox.x + bbox.width / 2) / drawingUnitsPerMeter,
      y: (bbox.y + bbox.height / 2) / drawingUnitsPerMeter,
    },
    orientation: Math.abs(bbox.width) >= Math.abs(bbox.height) ? "horizontal" as const : "vertical" as const,
  };
}

function nodeKey(point: BosPoint2, tolerance = 0.12) {
  return `${Math.round(point.x / tolerance)}:${Math.round(point.y / tolerance)}`;
}

function endpointDegrees(walls: BosWall[]) {
  const degree = new Map<string, number>();
  for (const wall of walls) {
    for (const point of [wall.centerline.start, wall.centerline.end]) {
      const key = nodeKey(point);
      degree.set(key, (degree.get(key) || 0) + 1);
    }
  }
  return degree;
}

function moveEndpoint(anchor: BosPoint2, moving: BosPoint2, targetLength: number) {
  const current = distance(anchor, moving);
  if (current <= Number.EPSILON) return moving;
  const factor = targetLength / current;
  return {
    x: anchor.x + (moving.x - anchor.x) * factor,
    y: anchor.y + (moving.y - anchor.y) * factor,
  };
}

export function applyDimensionWallConstraints(
  walls: BosWall[],
  dimensions: BosDimension[],
  drawingUnitsPerMeter: number,
): DimensionConstraintResult {
  if (!walls.length || !dimensions.length || !drawingUnitsPerMeter || drawingUnitsPerMeter <= 0) {
    return { walls, dimensions, matched: 0, adjusted: 0, diagnostics: [] };
  }

  const outputWalls = walls.map((wall) => ({
    ...wall,
    centerline: { start: { ...wall.centerline.start }, end: { ...wall.centerline.end } },
    evidence: [...wall.evidence],
    provenance: { ...wall.provenance, evidenceIds: [...wall.provenance.evidenceIds] },
  }));
  const outputDimensions = dimensions.map((dimension) => ({ ...dimension, evidence: [...dimension.evidence] }));
  const degree = endpointDegrees(outputWalls);
  let matched = 0;
  let adjusted = 0;

  for (const dimension of outputDimensions) {
    if (dimension.value < 0.45 || dimension.value > 40 || dimension.confidence < 0.75) continue;
    const label = labelCenter(dimension, drawingUnitsPerMeter);
    if (!label) continue;

    const candidates = outputWalls.flatMap((wall, index) => {
      if (wallOrientation(wall) !== label.orientation) return [];
      const currentLength = wallLength(wall);
      const relativeError = Math.abs(currentLength - dimension.value) / Math.max(dimension.value, 0.001);
      if (relativeError > 0.12) return [];
      const labelDistance = distance(midpoint(wall), label.point);
      if (labelDistance > 2.5) return [];
      return [{ index, wall, relativeError, labelDistance, score: relativeError * 2 + labelDistance / 8 }];
    }).sort((a, b) => a.score - b.score);

    const best = candidates[0];
    const runnerUp = candidates[1];
    if (!best || (runnerUp && runnerUp.score - best.score < 0.06)) continue;

    matched += 1;
    const wall = outputWalls[best.index];
    dimension.start = { ...wall.centerline.start };
    dimension.end = { ...wall.centerline.end };
    for (const evidence of dimension.evidence) {
      if (!wall.evidence.some((current) => current.id === evidence.id)) wall.evidence.push(evidence);
      if (!wall.provenance.evidenceIds.includes(evidence.id)) wall.provenance.evidenceIds.push(evidence.id);
    }
    wall.confidence = Math.min(0.99, Math.max(wall.confidence, dimension.confidence * 0.97));

    const currentLength = wallLength(wall);
    const delta = Math.abs(currentLength - dimension.value);
    if (delta <= 0.01 || delta > 0.15) continue;
    const startDegree = degree.get(nodeKey(wall.centerline.start)) || 0;
    const endDegree = degree.get(nodeKey(wall.centerline.end)) || 0;

    if (startDegree <= 1 && endDegree > 1) {
      wall.centerline.start = moveEndpoint(wall.centerline.end, wall.centerline.start, dimension.value);
      adjusted += 1;
    } else if (endDegree <= 1 && startDegree > 1) {
      wall.centerline.end = moveEndpoint(wall.centerline.start, wall.centerline.end, dimension.value);
      adjusted += 1;
    } else if (startDegree <= 1 && endDegree <= 1) {
      const center = midpoint(wall);
      const dx = wall.centerline.end.x - wall.centerline.start.x;
      const dy = wall.centerline.end.y - wall.centerline.start.y;
      const size = Math.hypot(dx, dy) || 1;
      const half = dimension.value / 2;
      wall.centerline.start = { x: center.x - dx / size * half, y: center.y - dy / size * half };
      wall.centerline.end = { x: center.x + dx / size * half, y: center.y + dy / size * half };
      adjusted += 1;
    }
  }

  const diagnostics: string[] = [];
  if (matched) diagnostics.push(`Dimension constraint solver matched ${matched} printed architectural dimensions to unique nearby wall runs.`);
  if (adjusted) diagnostics.push(`Dimension constraint solver corrected ${adjusted} safe dangling wall lengths from printed feet/inches evidence.`);
  return { walls: outputWalls, dimensions: outputDimensions, matched, adjusted, diagnostics };
}
