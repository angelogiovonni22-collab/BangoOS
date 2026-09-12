import type { BosLine2, BosPoint2 } from "./building-graph";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosRasterStructuralSelection = {
  wallSystems: BosWallSystemCandidate[];
  rejectedSystemIds: string[];
  componentCount: number;
  retainedComponentCount: number;
  repetitiveArtifactCount: number;
  diagnostics: string[];
};

export type BosRasterStructuralSelectorOptions = {
  junctionToleranceMeters?: number;
  openingContinuityMeters?: number;
  collinearToleranceMeters?: number;
  parallelToleranceRadians?: number;
  minRetainedComponentLengthMeters?: number;
  relativeComponentLengthFloor?: number;
};

function lineLength(line: BosLine2) {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

function angle(line: BosLine2) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}

function angleDelta(a: number, b: number) {
  const raw = Math.abs(a - b);
  return Math.min(raw, Math.PI - raw);
}

function pointDistance(a: BosPoint2, b: BosPoint2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function finiteProjection(point: BosPoint2, line: BosLine2) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return null;
  const parameter = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / lengthSquared;
  if (parameter < 0 || parameter > 1) return null;
  const projected = { x: line.start.x + parameter * dx, y: line.start.y + parameter * dy };
  return { parameter, projected, distance: pointDistance(point, projected) };
}

function endpointToFiniteLineDistance(a: BosLine2, b: BosLine2) {
  const values = [a.start, a.end].flatMap((point) => {
    const projection = finiteProjection(point, b);
    return projection ? [projection.distance] : [];
  });
  return values.length ? Math.min(...values) : Number.POSITIVE_INFINITY;
}

function minEndpointDistance(a: BosLine2, b: BosLine2) {
  return Math.min(
    pointDistance(a.start, b.start),
    pointDistance(a.start, b.end),
    pointDistance(a.end, b.start),
    pointDistance(a.end, b.end),
  );
}

function parallelMetrics(a: BosLine2, b: BosLine2) {
  const theta = angle(a);
  const axis = { x: Math.cos(theta), y: Math.sin(theta) };
  const normal = { x: -axis.y, y: axis.x };
  const project = (point: BosPoint2, direction: BosPoint2) => point.x * direction.x + point.y * direction.y;
  const a0 = project(a.start, axis);
  const a1 = project(a.end, axis);
  const b0 = project(b.start, axis);
  const b1 = project(b.end, axis);
  const aMin = Math.min(a0, a1);
  const aMax = Math.max(a0, a1);
  const bMin = Math.min(b0, b1);
  const bMax = Math.max(b0, b1);
  const overlap = Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
  const shorter = Math.max(0.001, Math.min(aMax - aMin, bMax - bMin));
  const gap = Math.max(0, Math.max(aMin, bMin) - Math.min(aMax, bMax));
  const separation = Math.min(
    Math.abs(project(b.start, normal) - project(a.start, normal)),
    Math.abs(project(b.end, normal) - project(a.end, normal)),
  );
  return { overlapRatio: overlap / shorter, gap, separation };
}

function areArchitecturallyConnected(
  a: BosWallSystemCandidate,
  b: BosWallSystemCandidate,
  options: Required<Pick<BosRasterStructuralSelectorOptions, "junctionToleranceMeters" | "openingContinuityMeters" | "collinearToleranceMeters" | "parallelToleranceRadians">>,
) {
  if (a.sourcePage !== b.sourcePage) return false;
  const delta = angleDelta(a.orientationRadians, b.orientationRadians);
  const nearParallel = delta <= options.parallelToleranceRadians;
  if (!nearParallel) {
    const endpointToOther = Math.min(
      endpointToFiniteLineDistance(a.centerline, b.centerline),
      endpointToFiniteLineDistance(b.centerline, a.centerline),
      minEndpointDistance(a.centerline, b.centerline),
    );
    return endpointToOther <= options.junctionToleranceMeters;
  }
  const metrics = parallelMetrics(a.centerline, b.centerline);
  return metrics.separation <= options.collinearToleranceMeters
    && metrics.gap <= options.openingContinuityMeters;
}

function isRepetitiveShortParallelArtifact(
  candidate: BosWallSystemCandidate,
  systems: readonly BosWallSystemCandidate[],
  parallelTolerance: number,
) {
  if (candidate.length > 1.5) return false;
  let familySize = 1;
  for (const other of systems) {
    if (other.id === candidate.id || other.length > 1.5) continue;
    if (angleDelta(candidate.orientationRadians, other.orientationRadians) > parallelTolerance * 1.75) continue;
    const metrics = parallelMetrics(candidate.centerline, other.centerline);
    const lengthRatio = other.length / Math.max(candidate.length, 0.001);
    if (lengthRatio < 0.62 || lengthRatio > 1.62) continue;
    if (metrics.overlapRatio < 0.55 || metrics.separation > 1.05) continue;
    familySize += 1;
    if (familySize >= 4) return true;
  }
  return false;
}

/**
 * Selects building-scale raster wall systems before global constraints. The selector is deliberately
 * network-based: isolated/repetitive paired-line families do not become walls merely because they
 * satisfy local face-pair geometry. Door-sized collinear gaps remain connected as architectural
 * continuity, while unsupported long-distance bridging is prohibited.
 */
export function selectStructuralRasterWallSystems(
  input: readonly BosWallSystemCandidate[],
  options: BosRasterStructuralSelectorOptions = {},
): BosRasterStructuralSelection {
  if (!input.length) {
    return {
      wallSystems: [],
      rejectedSystemIds: [],
      componentCount: 0,
      retainedComponentCount: 0,
      repetitiveArtifactCount: 0,
      diagnostics: ["Raster structural selector received no wall systems."],
    };
  }

  const junctionToleranceMeters = options.junctionToleranceMeters ?? 0.28;
  const openingContinuityMeters = options.openingContinuityMeters ?? 1.2;
  const collinearToleranceMeters = options.collinearToleranceMeters ?? 0.16;
  const parallelToleranceRadians = options.parallelToleranceRadians ?? Math.PI / 180 * 2.5;
  const minRetainedComponentLengthMeters = options.minRetainedComponentLengthMeters ?? 4;
  const relativeComponentLengthFloor = options.relativeComponentLengthFloor ?? 0.12;

  const repetitive = new Set(
    input
      .filter((candidate) => isRepetitiveShortParallelArtifact(candidate, input, parallelToleranceRadians))
      .map((candidate) => candidate.id),
  );
  const systems = input.filter((candidate) => !repetitive.has(candidate.id));
  if (!systems.length) {
    return {
      wallSystems: [],
      rejectedSystemIds: input.map((item) => item.id),
      componentCount: 0,
      retainedComponentCount: 0,
      repetitiveArtifactCount: repetitive.size,
      diagnostics: ["Raster structural selector rejected every candidate as repetitive non-building linework."],
    };
  }

  const parent = systems.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (a: number, b: number) => {
    const left = find(a);
    const right = find(b);
    if (left !== right) parent[right] = left;
  };

  const connectivityOptions = { junctionToleranceMeters, openingContinuityMeters, collinearToleranceMeters, parallelToleranceRadians };
  for (let left = 0; left < systems.length; left += 1) {
    for (let right = left + 1; right < systems.length; right += 1) {
      if (areArchitecturallyConnected(systems[left], systems[right], connectivityOptions)) union(left, right);
    }
  }

  const groups = new Map<number, BosWallSystemCandidate[]>();
  systems.forEach((system, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), system]);
  });
  const components = [...groups.values()].map((wallSystems) => ({
    wallSystems,
    totalLength: wallSystems.reduce((sum, system) => sum + lineLength(system.centerline), 0),
  })).sort((a, b) => b.totalLength - a.totalLength);
  const largestLength = components[0]?.totalLength || 0;
  const retained = components.filter((component, index) => {
    if (index === 0) return true;
    return component.totalLength >= minRetainedComponentLengthMeters
      && component.totalLength >= largestLength * relativeComponentLengthFloor;
  });
  const retainedIds = new Set(retained.flatMap((component) => component.wallSystems.map((system) => system.id)));
  const wallSystems = systems.filter((system) => retainedIds.has(system.id));
  const rejectedSystemIds = input.filter((system) => !retainedIds.has(system.id)).map((system) => system.id);

  return {
    wallSystems,
    rejectedSystemIds,
    componentCount: components.length,
    retainedComponentCount: retained.length,
    repetitiveArtifactCount: repetitive.size,
    diagnostics: [
      `Raster structural selector retained ${wallSystems.length} of ${input.length} explicit wall systems across ${retained.length} of ${components.length} architectural components.`,
      `Raster structural selector rejected ${repetitive.size} repetitive short parallel systems before component selection.`,
      `Largest retained architectural component spans ${largestLength.toFixed(2)} m of wall centerline evidence; no unsupported long-distance bridging was used.`,
    ],
  };
}
