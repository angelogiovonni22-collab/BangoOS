import type { BosPoint2 } from "./building-graph";
import { mergeCollinearSegments, type BosRawSegment } from "./geometry";

export type ArchitecturalTopologyOptions = {
  orthogonalToleranceRadians: number;
  endpointSnapTolerance: number;
  junctionExtensionTolerance: number;
  minSegmentLength: number;
};

export type ArchitecturalTopologyResult = {
  segments: BosRawSegment[];
  diagnostics: string[];
  snappedEndpointCount: number;
  repairedJunctionCount: number;
};

export const DEFAULT_ARCHITECTURAL_TOPOLOGY_OPTIONS: ArchitecturalTopologyOptions = {
  orthogonalToleranceRadians: Math.PI / 180 * 2.5,
  endpointSnapTolerance: 0.14,
  junctionExtensionTolerance: 0.28,
  minSegmentLength: 0.45,
};

function distance(a: BosPoint2, b: BosPoint2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function length(segment: BosRawSegment) {
  return distance(segment.start, segment.end);
}

function normalizedAngle(segment: BosRawSegment) {
  let value = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}

function angleDelta(a: number, b: number) {
  const raw = Math.abs(a - b);
  return Math.min(raw, Math.PI - raw);
}

function orthogonalize(segment: BosRawSegment, tolerance: number): BosRawSegment {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const angle = normalizedAngle(segment);
  const horizontalDelta = Math.min(angle, Math.PI - angle);
  const verticalDelta = Math.abs(angle - Math.PI / 2);
  if (horizontalDelta <= tolerance) {
    const y = (segment.start.y + segment.end.y) / 2;
    return { ...segment, start: { x: segment.start.x, y }, end: { x: segment.end.x, y } };
  }
  if (verticalDelta <= tolerance) {
    const x = (segment.start.x + segment.end.x) / 2;
    return { ...segment, start: { x, y: segment.start.y }, end: { x, y: segment.end.y } };
  }
  if (Math.abs(dx) < Number.EPSILON || Math.abs(dy) < Number.EPSILON) return segment;
  return segment;
}

function snapEndpointClusters(input: BosRawSegment[], tolerance: number) {
  type Endpoint = { segmentIndex: number; key: "start" | "end"; point: BosPoint2 };
  const endpoints: Endpoint[] = input.flatMap((segment, segmentIndex) => [
    { segmentIndex, key: "start" as const, point: segment.start },
    { segmentIndex, key: "end" as const, point: segment.end },
  ]);
  const parent = endpoints.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };

  for (let i = 0; i < endpoints.length; i += 1) {
    for (let j = i + 1; j < endpoints.length; j += 1) {
      if (endpoints[i].segmentIndex === endpoints[j].segmentIndex) continue;
      if (distance(endpoints[i].point, endpoints[j].point) <= tolerance) union(i, j);
    }
  }

  const groups = new Map<number, Endpoint[]>();
  endpoints.forEach((endpoint, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), endpoint]);
  });

  const output = input.map((segment) => ({ ...segment, start: { ...segment.start }, end: { ...segment.end } }));
  let snappedEndpointCount = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const point = {
      x: group.reduce((sum, endpoint) => sum + endpoint.point.x, 0) / group.length,
      y: group.reduce((sum, endpoint) => sum + endpoint.point.y, 0) / group.length,
    };
    for (const endpoint of group) {
      output[endpoint.segmentIndex][endpoint.key] = point;
      snappedEndpointCount += 1;
    }
  }
  return { segments: output, snappedEndpointCount };
}

function infiniteIntersection(a: BosRawSegment, b: BosRawSegment) {
  const r = { x: a.end.x - a.start.x, y: a.end.y - a.start.y };
  const s = { x: b.end.x - b.start.x, y: b.end.y - b.start.y };
  const denominator = r.x * s.y - r.y * s.x;
  if (Math.abs(denominator) < 1e-8) return null;
  const qMinusP = { x: b.start.x - a.start.x, y: b.start.y - a.start.y };
  const t = (qMinusP.x * s.y - qMinusP.y * s.x) / denominator;
  const u = (qMinusP.x * r.y - qMinusP.y * r.x) / denominator;
  return {
    point: { x: a.start.x + t * r.x, y: a.start.y + t * r.y },
    t,
    u,
  };
}

function endpointDistanceToIntersection(segment: BosRawSegment, point: BosPoint2) {
  const startDistance = distance(segment.start, point);
  const endDistance = distance(segment.end, point);
  return startDistance <= endDistance
    ? { key: "start" as const, distance: startDistance }
    : { key: "end" as const, distance: endDistance };
}

function parameterInside(parameter: number, tolerance = 0.02) {
  return parameter >= -tolerance && parameter <= 1 + tolerance;
}

function repairNearJunctions(input: BosRawSegment[], tolerance: number) {
  const output = input.map((segment) => ({ ...segment, start: { ...segment.start }, end: { ...segment.end } }));
  let repairedJunctionCount = 0;

  for (let i = 0; i < output.length; i += 1) {
    for (let j = i + 1; j < output.length; j += 1) {
      const a = output[i];
      const b = output[j];
      if (angleDelta(normalizedAngle(a), normalizedAngle(b)) < Math.PI / 8) continue;
      const intersection = infiniteIntersection(a, b);
      if (!intersection) continue;
      const aEndpoint = endpointDistanceToIntersection(a, intersection.point);
      const bEndpoint = endpointDistanceToIntersection(b, intersection.point);
      const aInside = parameterInside(intersection.t);
      const bInside = parameterInside(intersection.u);
      const aNear = aEndpoint.distance <= tolerance;
      const bNear = bEndpoint.distance <= tolerance;

      // Corner: both wall runs nearly meet at the same infinite-line intersection.
      if (aNear && bNear) {
        a[aEndpoint.key] = intersection.point;
        b[bEndpoint.key] = intersection.point;
        repairedJunctionCount += 1;
        continue;
      }

      // T junction: one dangling wall endpoint nearly reaches the finite body of another wall.
      if (aNear && bInside) {
        a[aEndpoint.key] = intersection.point;
        repairedJunctionCount += 1;
      } else if (bNear && aInside) {
        b[bEndpoint.key] = intersection.point;
        repairedJunctionCount += 1;
      }
    }
  }
  return { segments: output, repairedJunctionCount };
}

export function solveArchitecturalTopology(
  input: BosRawSegment[],
  options: ArchitecturalTopologyOptions = DEFAULT_ARCHITECTURAL_TOPOLOGY_OPTIONS,
): ArchitecturalTopologyResult {
  if (!input.length) {
    return { segments: [], diagnostics: [], snappedEndpointCount: 0, repairedJunctionCount: 0 };
  }

  const orthogonalized = input.map((segment) => orthogonalize(segment, options.orthogonalToleranceRadians));
  const firstSnap = snapEndpointClusters(orthogonalized, options.endpointSnapTolerance);
  const repaired = repairNearJunctions(firstSnap.segments, options.junctionExtensionTolerance);
  const secondSnap = snapEndpointClusters(repaired.segments, options.endpointSnapTolerance * 0.65);
  const merged = mergeCollinearSegments(secondSnap.segments, {
    snapTolerance: 0.06,
    collinearToleranceRadians: Math.PI / 180 * 2,
    minLength: options.minSegmentLength,
    wallThickness: 0.1524,
    wallHeight: 2.4384,
  }).filter((segment) => length(segment) >= options.minSegmentLength);

  const snappedEndpointCount = firstSnap.snappedEndpointCount + secondSnap.snappedEndpointCount;
  const repairedJunctionCount = repaired.repairedJunctionCount;
  const diagnostics: string[] = [];
  if (snappedEndpointCount > 0) diagnostics.push(`Architectural topology solver snapped ${snappedEndpointCount} near-coincident wall endpoints into shared junctions.`);
  if (repairedJunctionCount > 0) diagnostics.push(`Architectural topology solver repaired ${repairedJunctionCount} near-miss corner or T-junction connections.`);
  return { segments: merged, diagnostics, snappedEndpointCount, repairedJunctionCount };
}
