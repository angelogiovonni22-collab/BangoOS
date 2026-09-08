import type { BosDoor, BosOpening, BosPoint2, BosWall, BosWindow } from "./building-graph";
import type { BosRawSegment } from "./geometry";

export type OpeningDetection = {
  openings: BosOpening[];
  doors: BosDoor[];
  windows: BosWindow[];
};

export type OpeningDetectionOptions = {
  symbolSegments?: readonly BosRawSegment[];
};

function wallLength(wall: BosWall) {
  return Math.hypot(wall.centerline.end.x - wall.centerline.start.x, wall.centerline.end.y - wall.centerline.start.y);
}

function segmentLength(segment: { start: BosPoint2; end: BosPoint2 }) {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
}

function direction(wall: BosWall) {
  const size = wallLength(wall) || 1;
  return {
    x: (wall.centerline.end.x - wall.centerline.start.x) / size,
    y: (wall.centerline.end.y - wall.centerline.start.y) / size,
  };
}

function segmentDirection(segment: { start: BosPoint2; end: BosPoint2 }) {
  const size = segmentLength(segment) || 1;
  return {
    x: (segment.end.x - segment.start.x) / size,
    y: (segment.end.y - segment.start.y) / size,
  };
}

function angleBetweenDirections(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
  return Math.acos(Math.abs(dot));
}

function angleDelta(a: BosWall, b: BosWall) {
  return angleBetweenDirections(direction(a), direction(b));
}

function pointLineDistance(point: BosPoint2, wall: BosWall) {
  const d = direction(wall);
  const nx = -d.y;
  const ny = d.x;
  return Math.abs((point.x - wall.centerline.start.x) * nx + (point.y - wall.centerline.start.y) * ny);
}

function nearestEndpoints(a: BosWall, b: BosWall) {
  const pairs = [
    [a.centerline.start, b.centerline.start],
    [a.centerline.start, b.centerline.end],
    [a.centerline.end, b.centerline.start],
    [a.centerline.end, b.centerline.end],
  ] as const;
  return pairs.map(([left, right]) => ({ left, right, gap: Math.hypot(right.x - left.x, right.y - left.y) })).sort((x, y) => x.gap - y.gap)[0];
}

function openingKind(width: number): "door" | "window" | "passage" {
  if (width >= 0.72 && width <= 1.35) return "door";
  if (width > 1.35 && width <= 2.6) return "window";
  return "passage";
}

function distance(a: BosPoint2, b: BosPoint2) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function project(point: BosPoint2, origin: BosPoint2, axis: { x: number; y: number }) {
  return (point.x - origin.x) * axis.x + (point.y - origin.y) * axis.y;
}

function orderedGapEndpoints(pair: ReturnType<typeof nearestEndpoints>, wall: BosWall) {
  const axis = direction(wall);
  const leftProjection = project(pair.left, wall.centerline.start, axis);
  const rightProjection = project(pair.right, wall.centerline.start, axis);
  return leftProjection <= rightProjection
    ? { start: pair.left, end: pair.right, axis }
    : { start: pair.right, end: pair.left, axis };
}

function evidenceForSegment(segment: BosRawSegment, id: string, score: number) {
  const minX = Math.min(segment.start.x, segment.end.x);
  const minY = Math.min(segment.start.y, segment.end.y);
  return {
    id,
    page: segment.sourcePage,
    kind: "pdf_vector" as const,
    bbox: {
      x: minX,
      y: minY,
      width: Math.abs(segment.end.x - segment.start.x),
      height: Math.abs(segment.end.y - segment.start.y),
    },
    sourceObjectId: segment.sourceObjectId,
    score,
  };
}

function recognizeDoorSwing(
  wall: BosWall,
  pair: ReturnType<typeof nearestEndpoints>,
  segments: readonly BosRawSegment[],
) {
  const gap = orderedGapEndpoints(pair, wall);
  const wallAxis = gap.axis;
  const hingeTolerance = Math.min(0.24, Math.max(0.14, pair.gap * 0.2));
  const candidates = segments.flatMap((segment) => {
    if (segment.sourcePage !== wall.sourcePage) return [];
    const size = segmentLength(segment);
    if (size < 0.5 || size > Math.min(1.55, pair.gap * 1.3)) return [];
    const symbolAxis = segmentDirection(segment);
    const delta = angleBetweenDirections(wallAxis, symbolAxis);
    if (delta < Math.PI / 180 * 18 || delta > Math.PI / 180 * 88) return [];

    const endpointCandidates = [
      { hinge: segment.start, free: segment.end },
      { hinge: segment.end, free: segment.start },
    ];
    for (const endpoint of endpointCandidates) {
      const startDistance = distance(endpoint.hinge, gap.start);
      const endDistance = distance(endpoint.hinge, gap.end);
      const side = startDistance <= endDistance ? "left" as const : "right" as const;
      const hingeDistance = Math.min(startDistance, endDistance);
      if (hingeDistance > hingeTolerance) continue;
      const freeAlongGap = project(endpoint.free, gap.start, wallAxis);
      if (freeAlongGap < -0.25 || freeAlongGap > pair.gap + 0.25) continue;
      if (distance(endpoint.free, { x: (gap.start.x + gap.end.x) / 2, y: (gap.start.y + gap.end.y) / 2 }) > pair.gap + 0.45) continue;
      return [{ segment, side, score: Math.max(0.66, 0.92 - hingeDistance) }];
    }
    return [];
  });

  const bestLeft = candidates.filter((item) => item.side === "left").sort((a, b) => b.score - a.score)[0];
  const bestRight = candidates.filter((item) => item.side === "right").sort((a, b) => b.score - a.score)[0];
  if (bestLeft && bestRight && bestLeft.segment !== bestRight.segment) {
    return { swing: "double" as const, segments: [bestLeft.segment, bestRight.segment], confidence: Math.min(bestLeft.score, bestRight.score) };
  }
  const bestLeaf = [bestLeft, bestRight].filter(Boolean).sort((a, b) => (b?.score || 0) - (a?.score || 0))[0];
  if (bestLeaf) return { swing: bestLeaf.side, segments: [bestLeaf.segment], confidence: bestLeaf.score };

  const slidingCandidates = segments.filter((segment) => {
    if (segment.sourcePage !== wall.sourcePage) return false;
    const size = segmentLength(segment);
    if (size < pair.gap * 0.45 || size > pair.gap * 1.15) return false;
    if (angleBetweenDirections(wallAxis, segmentDirection(segment)) > Math.PI / 180 * 6) return false;
    const midpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
    const along = project(midpoint, gap.start, wallAxis);
    return along >= pair.gap * 0.15 && along <= pair.gap * 0.85 && pointLineDistance(midpoint, wall) <= Math.max(0.3, wall.thickness * 2.5);
  });
  if (slidingCandidates.length) return { swing: "sliding" as const, segments: [slidingCandidates[0]], confidence: 0.74 };
  return null;
}

function recognizeWindowStyle(
  wall: BosWall,
  pair: ReturnType<typeof nearestEndpoints>,
  segments: readonly BosRawSegment[],
) {
  const gap = orderedGapEndpoints(pair, wall);
  const wallAxis = gap.axis;
  const matching = segments.filter((segment) => {
    if (segment.sourcePage !== wall.sourcePage) return false;
    if (angleBetweenDirections(wallAxis, segmentDirection(segment)) > Math.PI / 180 * 5) return false;
    const segmentStart = project(segment.start, gap.start, wallAxis);
    const segmentEnd = project(segment.end, gap.start, wallAxis);
    const min = Math.min(segmentStart, segmentEnd);
    const max = Math.max(segmentStart, segmentEnd);
    const overlap = Math.max(0, Math.min(pair.gap, max) - Math.max(0, min));
    if (overlap / pair.gap < 0.55) return false;
    const midpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
    return pointLineDistance(midpoint, wall) <= Math.max(0.28, wall.thickness * 2.2);
  });
  if (!matching.length) return null;

  const normal = { x: -wallAxis.y, y: wallAxis.x };
  const offsets = matching.map((segment) => {
    const midpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
    return project(midpoint, gap.start, normal);
  }).sort((a, b) => a - b);
  const distinctOffsets = offsets.filter((offset, index) => index === 0 || Math.abs(offset - offsets[index - 1]) >= 0.035);
  return {
    style: distinctOffsets.length >= 2 ? "double-line" : "single-line",
    segments: distinctOffsets.length >= 2 ? matching.slice(0, 2) : [matching[0]],
    confidence: distinctOffsets.length >= 2 ? 0.82 : 0.7,
  };
}

export function detectWallGapOpenings(
  walls: BosWall[],
  options: OpeningDetectionOptions = {},
): OpeningDetection {
  const openings: BosOpening[] = [];
  const doors: BosDoor[] = [];
  const windows: BosWindow[] = [];
  const seen = new Set<string>();
  const symbolSegments = options.symbolSegments || [];

  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const a = walls[i];
      const b = walls[j];
      if (a.levelId !== b.levelId || a.type !== b.type) continue;
      if (angleDelta(a, b) > Math.PI / 180 * 2) continue;
      if (pointLineDistance(b.centerline.start, a) > Math.max(0.08, (a.thickness + b.thickness) / 2)) continue;
      const pair = nearestEndpoints(a, b);
      if (pair.gap < 0.58 || pair.gap > 2.6) continue;
      const key = [a.id, b.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const kind = openingKind(pair.gap);
      const wall = wallLength(a) >= wallLength(b) ? a : b;
      const axis = direction(wall);
      const midpoint = { x: (pair.left.x + pair.right.x) / 2, y: (pair.left.y + pair.right.y) / 2 };
      const offset = Math.max(0, (midpoint.x - wall.centerline.start.x) * axis.x + (midpoint.y - wall.centerline.start.y) * axis.y);
      const evidenceId = `opening-gap-${openings.length + 1}`;
      const base: BosOpening = {
        id: `opening-${wall.levelId}-${openings.length + 1}`,
        levelId: wall.levelId,
        type: kind,
        wallId: wall.id,
        offset,
        width: pair.gap,
        height: kind === "window" ? 1.22 : 2.03,
        sillHeight: kind === "window" ? 0.9 : 0,
        confidence: kind === "passage" ? 0.48 : 0.62,
        sourcePage: wall.sourcePage,
        evidence: [{ id: evidenceId, page: wall.sourcePage, kind: "derived", score: kind === "passage" ? 0.48 : 0.62 }],
        provenance: { createdBy: "deterministic", algorithm: "bos-wall-gap-openings", algorithmVersion: "1.1.0", evidenceIds: [evidenceId] },
      };

      if (kind === "door") {
        const recognized = recognizeDoorSwing(wall, pair, symbolSegments);
        const vectorEvidence = recognized?.segments.map((segment, index) => evidenceForSegment(segment, `${base.id}-door-symbol-${index + 1}`, recognized.confidence)) || [];
        const door: BosDoor = {
          ...base,
          type: "door",
          swing: recognized?.swing || "unknown",
          confidence: recognized ? Math.max(base.confidence, recognized.confidence) : base.confidence,
          evidence: [...base.evidence, ...vectorEvidence],
          provenance: {
            createdBy: "deterministic",
            algorithm: recognized ? "bos-opening-symbol-recognition" : "bos-wall-gap-openings",
            algorithmVersion: "1.1.0",
            evidenceIds: [...base.provenance.evidenceIds, ...vectorEvidence.map((item) => item.id)],
          },
        };
        openings.push(door);
        doors.push(door);
        continue;
      }

      if (kind === "window") {
        const recognized = recognizeWindowStyle(wall, pair, symbolSegments);
        const vectorEvidence = recognized?.segments.map((segment, index) => evidenceForSegment(segment, `${base.id}-window-symbol-${index + 1}`, recognized.confidence)) || [];
        const window: BosWindow = {
          ...base,
          type: "window",
          style: recognized?.style,
          confidence: recognized ? Math.max(base.confidence, recognized.confidence) : base.confidence,
          evidence: [...base.evidence, ...vectorEvidence],
          provenance: {
            createdBy: "deterministic",
            algorithm: recognized ? "bos-opening-symbol-recognition" : "bos-wall-gap-openings",
            algorithmVersion: "1.1.0",
            evidenceIds: [...base.provenance.evidenceIds, ...vectorEvidence.map((item) => item.id)],
          },
        };
        openings.push(window);
        windows.push(window);
        continue;
      }

      openings.push(base);
    }
  }
  return { openings, doors, windows };
}
