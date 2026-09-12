import type { BosBuildingGraph, BosPoint2, BosPolygon2, BosRoom, BosSlab, BosStair, BosWall } from "./building-graph";
import type { BosTextToken } from "./dimensions";
import { pointInBosPolygon } from "./room-tracing";

export type ScaledTextToken = BosTextToken & { xMeters?: number; yMeters?: number; widthMeters?: number; heightMeters?: number };

function normalized(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function center(wall: BosWall) {
  return {
    x: (wall.centerline.start.x + wall.centerline.end.x) / 2,
    y: (wall.centerline.start.y + wall.centerline.end.y) / 2,
  };
}

function distance(a: BosPoint2, b: BosPoint2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function bboxPolygon(points: BosPoint2[]): BosPolygon2 | null {
  if (points.length < 2) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (maxX - minX < 0.5 || maxY - minY < 0.5) return null;
  return { points: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }] };
}

function nearbyWallPoints(walls: BosWall[], point: BosPoint2, radius: number) {
  return walls.filter((wall) => distance(center(wall), point) <= radius).flatMap((wall) => [wall.centerline.start, wall.centerline.end]);
}

function tokenPoint(token: ScaledTextToken): BosPoint2 | null {
  if (token.xMeters === undefined || token.yMeters === undefined) return null;
  return { x: token.xMeters + (token.widthMeters || 0) / 2, y: token.yMeters + (token.heightMeters || 0) / 2 };
}

function roomLabel(text: string) {
  const value = normalized(text);
  const labels: Array<[RegExp, string]> = [
    [/\b(2 car|two car|3 car|three car)?\s*garage\b/, "Garage"],
    [/\bgreat room\b/, "Great Room"],
    [/\bfamily room\b/, "Family Room"],
    [/\bliving room\b/, "Living Room"],
    [/\bdining( room)?\b/, "Dining Room"],
    [/\bkitchen\b/, "Kitchen"],
    [/\b(primary|master) bedroom\b/, "Primary Bedroom"],
    [/\bbed(room)?\b/, "Bedroom"],
    [/\b(primary|master) bath(room)?\b/, "Primary Bathroom"],
    [/\b(bath(room)?|powder room)\b/, "Bathroom"],
    [/\blaundry\b/, "Laundry"],
    [/\b(office|study)\b/, "Office"],
    [/\b(mud room|mudroom)\b/, "Mud Room"],
    [/\b(foyer|entry)\b/, "Foyer"],
    [/\bpantry\b/, "Pantry"],
    [/\b(walk in closet|wic|closet)\b/, "Closet"],
    [/\b(sun room|sunroom)\b/, "Sun Room"],
  ];
  return labels.find(([pattern]) => pattern.test(value))?.[1] || null;
}

export function scaleTextTokensToMeters(tokens: BosTextToken[], drawingUnitsPerMeter: number): ScaledTextToken[] {
  const factor = drawingUnitsPerMeter > 0 ? 1 / drawingUnitsPerMeter : 0;
  return tokens.map((token) => ({
    ...token,
    xMeters: token.x === undefined || !factor ? undefined : token.x * factor,
    yMeters: token.y === undefined || !factor ? undefined : token.y * factor,
    widthMeters: token.width === undefined || !factor ? undefined : token.width * factor,
    heightMeters: token.height === undefined || !factor ? undefined : token.height * factor,
  }));
}

export function recognizeArchitecturalSemantics(graph: BosBuildingGraph, tokens: ScaledTextToken[]) {
  const levelId = graph.levels[0]?.id;
  if (!levelId) return graph;
  let rooms: BosRoom[] = [...graph.rooms];
  const decksPorches: BosSlab[] = [...graph.decksPorches];
  const stairs: BosStair[] = [...graph.stairs];
  const seen = new Set<string>();

  for (const token of tokens) {
    const text = normalized(token.text);
    const point = tokenPoint(token);
    if (!point) continue;

    const semantic = (kind: string, score: number) => ({
      confidence: score,
      sourcePage: token.page,
      evidence: [{
        id: `semantic-${kind}-${token.page}-${Math.round(point.x * 100)}-${Math.round(point.y * 100)}`,
        page: token.page,
        kind: "pdf_text" as const,
        text: token.text,
        score,
      }],
      provenance: {
        createdBy: "deterministic" as const,
        algorithm: "bos-plan-label-semantics",
        algorithmVersion: "1.2.0",
        evidenceIds: [`semantic-${kind}-${token.page}-${Math.round(point.x * 100)}-${Math.round(point.y * 100)}`],
      },
    });

    const label = roomLabel(token.text);
    if (label) {
      const roomIndex = rooms.findIndex((room) => room.levelId === levelId && pointInBosPolygon(point, room.polygon));
      if (roomIndex >= 0) {
        const evidence = semantic(`room-label-${roomIndex + 1}`, 0.88);
        const existing = rooms[roomIndex];
        rooms = rooms.map((room, index) => index === roomIndex ? {
          ...existing,
          name: label,
          confidence: Math.max(existing.confidence, evidence.confidence),
          sourcePage: token.page,
          evidence: [...existing.evidence, ...evidence.evidence],
          provenance: evidence.provenance,
        } : room);
        if (label === "Garage") seen.add("garage");
      }
    }

    if (/\bgarage\b/.test(text) && !seen.has("garage")) {
      const polygon = bboxPolygon(nearbyWallPoints(graph.walls, point, 6.5));
      if (polygon) {
        seen.add("garage");
        rooms.push({
          id: `room-garage-${levelId}`,
          levelId,
          type: "room",
          name: token.text,
          polygon,
          ...semantic("garage", 0.86),
        });
      }
    }

    if (/\b(deck|porch|patio)\b/.test(text) && !seen.has("deck-porch")) {
      const polygon = bboxPolygon(nearbyWallPoints(graph.walls, point, 5.5));
      if (polygon) {
        seen.add("deck-porch");
        const kind = /porch/.test(text) ? "porch" : "deck";
        decksPorches.push({
          id: `${kind}-${levelId}`,
          levelId,
          type: kind,
          polygon,
          thickness: 0.15,
          elevation: 0,
          ...semantic(kind, 0.72),
        });
      }
    }
  }

  const stairTokens = tokens.filter((token) => {
    const text = normalized(token.text);
    return /^(up|dn|down)$/.test(text) && tokenPoint(token);
  });
  if (stairTokens.length) {
    // Direction labels near a stair core are intentionally lower confidence than explicit stair labels.
    const selected = stairTokens[0];
    const point = tokenPoint(selected);
    if (point) {
      const polygon = bboxPolygon(nearbyWallPoints(graph.walls, point, 2.5));
      if (polygon) {
        stairs.push({
          id: `stair-${levelId}-1`,
          levelId,
          type: "stair",
          polygon,
          direction: normalized(selected.text) === "up" ? "up" : "down",
          confidence: 0.58,
          sourcePage: selected.page,
          evidence: [{ id: `semantic-stair-${selected.page}`, page: selected.page, kind: "pdf_text", text: selected.text, score: 0.58 }],
          provenance: { createdBy: "deterministic", algorithm: "bos-stair-direction-label", algorithmVersion: "1.1.0", evidenceIds: [`semantic-stair-${selected.page}`] },
        });
      }
    }
  }

  return { ...graph, rooms, decksPorches, stairs } satisfies BosBuildingGraph;
}
