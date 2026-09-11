import sharp from "sharp";
import type { BosBuildingGraph, BosPoint2 } from "./engine/building-graph";

export const BLUEPRINT_GEOMETRY_LOCK_VERSION = "bos-geometry-lock-v1";

export type BlueprintFidelityGate = {
  allowed: boolean;
  score: number;
  blockers: string[];
  metrics: BosBuildingGraph["validation"]["metrics"];
};

export function assessBlueprintFidelity(graph: BosBuildingGraph | null, sourcePage: number): BlueprintFidelityGate {
  const emptyMetrics = { exteriorClosure: 0, footprintComplexity: 0, wallTopology: 0, scaleConfidence: 0, semanticCoverage: 0 };
  if (!graph) return { allowed: false, score: 0, blockers: ["No Building Graph is available."], metrics: emptyMetrics };
  const blockers: string[] = [];
  const metrics = graph.validation.metrics;
  if (graph.metadata.sourcePage !== sourcePage) blockers.push("The Building Graph is not bound to the selected source page.");
  if (graph.validation.status !== "reconstructed") blockers.push("The Building Graph has not passed structural review.");
  if (graph.confidence < 0.82) blockers.push("The Building Graph confidence is below the 82% production standard.");
  if (graph.validation.score < 0.82) blockers.push("The structural validation score is below the 82% production standard.");
  if (metrics.exteriorClosure < 0.75) blockers.push("The exterior footprint closure is below the 75% production standard.");
  if (metrics.wallTopology < 0.8) blockers.push("The wall topology closure is below the 80% production standard.");
  if (metrics.scaleConfidence < 0.9 || !graph.scale.drawingUnitsPerMeter) blockers.push("The drawing scale confidence is below the 90% production standard.");
  if (metrics.semanticCoverage < 0.7) blockers.push("The semantic coverage is below the 70% production standard.");
  if (graph.walls.length < 8) blockers.push("Too few walls were reconstructed for a faithful mockup.");
  if (graph.validation.issues.some((issue) => issue.severity === "error")) blockers.push("The Building Graph contains unresolved structural errors.");
  return { allowed: blockers.length === 0, score: graph.validation.score, blockers, metrics };
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] || character);
}

export async function renderBlueprintGeometryLock(graph: BosBuildingGraph) {
  const allPoints: BosPoint2[] = [
    ...graph.walls.flatMap((wall) => [wall.centerline.start, wall.centerline.end]),
    ...graph.rooms.flatMap((room) => room.polygon.points),
    ...graph.decksPorches.flatMap((item) => item.polygon.points),
    ...graph.stairs.flatMap((item) => item.polygon.points),
  ];
  if (!allPoints.length) throw new Error("The Building Graph has no renderable geometry.");
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const spanX = Math.max(0.1, maxX - minX);
  const spanY = Math.max(0.1, maxY - minY);
  const width = 1536;
  const height = 1024;
  const margin = 72;
  const scale = Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanY);
  const point = (input: BosPoint2) => `${margin + (input.x - minX) * scale},${margin + (input.y - minY) * scale}`;
  const polygon = (points: BosPoint2[]) => points.map(point).join(" ");
  const roomShapes = graph.rooms.filter((room) => room.polygon.points.length >= 3).map((room, index) => `<polygon points="${polygon(room.polygon.points)}" fill="${index % 2 ? "#dbeafe" : "#eff6ff"}" stroke="#93c5fd" stroke-width="2"/><text x="${margin + (room.polygon.points[0].x - minX) * scale + 8}" y="${margin + (room.polygon.points[0].y - minY) * scale + 20}" font-family="Arial" font-size="16" fill="#1e3a5f">${esc(room.name || room.id)}</text>`).join("");
  const deckShapes = graph.decksPorches.filter((item) => item.polygon.points.length >= 3).map((item) => `<polygon points="${polygon(item.polygon.points)}" fill="#fef3c7" stroke="#d97706" stroke-width="3" stroke-dasharray="10 6"/>`).join("");
  const stairShapes = graph.stairs.filter((item) => item.polygon.points.length >= 3).map((item) => `<polygon points="${polygon(item.polygon.points)}" fill="#f3e8ff" stroke="#7e22ce" stroke-width="3"/>`).join("");
  const walls = graph.walls.map((wall) => `<line x1="${margin + (wall.centerline.start.x - minX) * scale}" y1="${margin + (wall.centerline.start.y - minY) * scale}" x2="${margin + (wall.centerline.end.x - minX) * scale}" y2="${margin + (wall.centerline.end.y - minY) * scale}" stroke="${wall.type === "exterior" ? "#0f172a" : "#475569"}" stroke-width="${Math.max(4, wall.thickness * scale)}" stroke-linecap="square"/>`).join("");
  const openings = graph.openings.map((opening) => {
    const wall = graph.walls.find((candidate) => candidate.id === opening.wallId);
    if (!wall) return "";
    const dx = wall.centerline.end.x - wall.centerline.start.x;
    const dy = wall.centerline.end.y - wall.centerline.start.y;
    const length = Math.hypot(dx, dy);
    if (!length) return "";
    const center = Math.max(0, Math.min(length, opening.offset));
    const half = Math.min(opening.width / 2, length / 2);
    const startDistance = Math.max(0, center - half);
    const endDistance = Math.min(length, center + half);
    const start = { x: wall.centerline.start.x + dx * startDistance / length, y: wall.centerline.start.y + dy * startDistance / length };
    const end = { x: wall.centerline.start.x + dx * endDistance / length, y: wall.centerline.start.y + dy * endDistance / length };
    return `<line x1="${margin + (start.x - minX) * scale}" y1="${margin + (start.y - minY) * scale}" x2="${margin + (end.x - minX) * scale}" y2="${margin + (end.y - minY) * scale}" stroke="${opening.type === "window" ? "#06b6d4" : "#ffffff"}" stroke-width="${Math.max(7, wall.thickness * scale + 3)}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8fafc"/>${roomShapes}${deckShapes}${stairShapes}${walls}${openings}<text x="28" y="42" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">B.O.S. GEOMETRY LOCK — structure must not move</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
