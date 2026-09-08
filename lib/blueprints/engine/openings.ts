import type { BosDoor, BosOpening, BosWall, BosWindow } from "./building-graph";

export type OpeningDetection = {
  openings: BosOpening[];
  doors: BosDoor[];
  windows: BosWindow[];
};

function wallLength(wall: BosWall) {
  return Math.hypot(wall.centerline.end.x - wall.centerline.start.x, wall.centerline.end.y - wall.centerline.start.y);
}

function direction(wall: BosWall) {
  const length = wallLength(wall) || 1;
  return {
    x: (wall.centerline.end.x - wall.centerline.start.x) / length,
    y: (wall.centerline.end.y - wall.centerline.start.y) / length,
  };
}

function angleDelta(a: BosWall, b: BosWall) {
  const da = direction(a);
  const db = direction(b);
  return Math.acos(Math.min(1, Math.abs(da.x * db.x + da.y * db.y)));
}

function pointLineDistance(point: { x: number; y: number }, wall: BosWall) {
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

export function detectWallGapOpenings(walls: BosWall[]): OpeningDetection {
  const openings: BosOpening[] = [];
  const doors: BosDoor[] = [];
  const windows: BosWindow[] = [];
  const seen = new Set<string>();

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
        provenance: { createdBy: "deterministic", algorithm: "bos-wall-gap-openings", algorithmVersion: "1.0.0", evidenceIds: [evidenceId] },
      };
      openings.push(base);
      if (kind === "door") doors.push({ ...base, type: "door", swing: "unknown" });
      if (kind === "window") windows.push({ ...base, type: "window" });
    }
  }
  return { openings, doors, windows };
}
