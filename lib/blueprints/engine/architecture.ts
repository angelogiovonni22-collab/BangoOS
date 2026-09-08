import type { BosBuildingGraph, BosPoint2, BosPolygon2, BosRoom, BosSlab, BosStair, BosWall } from "./building-graph";
import type { BosTextToken } from "./dimensions";

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

function bboxPolygon(points: BosPoint2[], fallback: { center: BosPoint2; width: number; height: number }): BosPolygon2 {
  if (points.length >= 2) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (maxX - minX >= 0.5 && maxY - minY >= 0.5) {
      return { points: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }] };
    }
  }
  const { center: c, width, height } = fallback;
  return { points: [
    { x: c.x - width / 2, y: c.y - height / 2 },
    { x: c.x + width / 2, y: c.y - height / 2 },
    { x: c.x + width / 2, y: c.y + height / 2 },
    { x: c.x - width / 2, y: c.y + height / 2 },
  ] };
}

function nearbyWallPoints(walls: BosWall[], point: BosPoint2, radius: number) {
  return walls.filter((wall) => distance(center(wall), point) <= radius).flatMap((wall) => [wall.centerline.start, wall.centerline.end]);
}

function tokenPoint(token: ScaledTextToken): BosPoint2 | null {
  if (token.xMeters === undefined || token.yMeters === undefined) return null;
  return { x: token.xMeters + (token.widthMeters || 0) / 2, y: token.yMeters + (token.heightMeters || 0) / 2 };
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
  const rooms: BosRoom[] = [...graph.rooms];
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
        algorithmVersion: "1.0.0",
        evidenceIds: [`semantic-${kind}-${token.page}-${Math.round(point.x * 100)}-${Math.round(point.y * 100)}`],
      },
    });

    if (/\bgarage\b/.test(text) && !seen.has("garage")) {
      seen.add("garage");
      rooms.push({
        id: `room-garage-${levelId}`,
        levelId,
        type: "room",
        name: token.text,
        polygon: bboxPolygon(nearbyWallPoints(graph.walls, point, 6.5), { center: point, width: 5.8, height: 6.2 }),
        ...semantic("garage", 0.86),
      });
    }

    if (/\b(deck|porch|patio)\b/.test(text) && !seen.has("deck-porch")) {
      seen.add("deck-porch");
      const kind = /porch/.test(text) ? "porch" : "deck";
      decksPorches.push({
        id: `${kind}-${levelId}`,
        levelId,
        type: kind,
        polygon: bboxPolygon(nearbyWallPoints(graph.walls, point, 5.5), { center: point, width: 6, height: 3.5 }),
        thickness: 0.15,
        elevation: 0,
        ...semantic(kind, 0.72),
      });
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
      stairs.push({
        id: `stair-${levelId}-1`,
        levelId,
        type: "stair",
        polygon: bboxPolygon(nearbyWallPoints(graph.walls, point, 2.5), { center: point, width: 1.4, height: 3.2 }),
        direction: normalized(selected.text) === "up" ? "up" : "down",
        confidence: 0.58,
        sourcePage: selected.page,
        evidence: [{ id: `semantic-stair-${selected.page}`, page: selected.page, kind: "pdf_text", text: selected.text, score: 0.58 }],
        provenance: { createdBy: "deterministic", algorithm: "bos-stair-direction-label", algorithmVersion: "1.0.0", evidenceIds: [`semantic-stair-${selected.page}`] },
      });
    }
  }

  return { ...graph, rooms, decksPorches, stairs } satisfies BosBuildingGraph;
}
