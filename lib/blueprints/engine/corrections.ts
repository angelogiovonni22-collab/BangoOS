import type { BosBuildingGraph, BosPoint2, BosWall, BosOpening, BosRoom } from "./building-graph";

export type BosGraphCorrection =
  | { id: string; type: "move_wall"; wallId: string; start: BosPoint2; end: BosPoint2; actorId?: string; createdAt: string }
  | { id: string; type: "add_wall"; wall: BosWall; actorId?: string; createdAt: string }
  | { id: string; type: "remove_wall"; wallId: string; actorId?: string; createdAt: string }
  | { id: string; type: "classify_wall"; wallId: string; wallType: BosWall["type"]; actorId?: string; createdAt: string }
  | { id: string; type: "update_opening"; openingId: string; patch: Partial<Pick<BosOpening, "width" | "height" | "offset" | "sillHeight" | "wallId">>; actorId?: string; createdAt: string }
  | { id: string; type: "update_room"; roomId: string; patch: Partial<Pick<BosRoom, "name" | "polygon">>; actorId?: string; createdAt: string }
  | { id: string; type: "set_scale"; drawingUnitsPerMeter: number; actorId?: string; createdAt: string };

function corrected<T extends { correction?: { corrected: boolean; correctionId?: string; correctedAt?: string; correctedBy?: string }; provenance: { createdBy: "deterministic" | "ai_assisted" | "manual"; algorithm: string; algorithmVersion: string; evidenceIds: string[] } }>(value: T, correction: BosGraphCorrection): T {
  return {
    ...value,
    correction: { corrected: true, correctionId: correction.id, correctedAt: correction.createdAt, correctedBy: correction.actorId },
    provenance: { ...value.provenance, createdBy: "manual", algorithm: `manual:${correction.type}`, algorithmVersion: "1.0.0" },
  };
}

export function applyBosGraphCorrection(graph: BosBuildingGraph, correction: BosGraphCorrection): BosBuildingGraph {
  const next: BosBuildingGraph = structuredClone(graph);
  if (correction.type === "move_wall") {
    next.walls = next.walls.map((wall) => wall.id === correction.wallId
      ? corrected({ ...wall, centerline: { start: correction.start, end: correction.end } }, correction)
      : wall);
  } else if (correction.type === "add_wall") {
    next.walls.push(corrected(correction.wall, correction));
  } else if (correction.type === "remove_wall") {
    next.walls = next.walls.filter((wall) => wall.id !== correction.wallId);
    next.openings = next.openings.filter((opening) => opening.wallId !== correction.wallId);
    next.doors = next.doors.filter((opening) => opening.wallId !== correction.wallId);
    next.windows = next.windows.filter((opening) => opening.wallId !== correction.wallId);
  } else if (correction.type === "classify_wall") {
    next.walls = next.walls.map((wall) => wall.id === correction.wallId ? corrected({ ...wall, type: correction.wallType }, correction) : wall);
  } else if (correction.type === "update_opening") {
    const update = <T extends BosOpening>(opening: T): T => opening.id === correction.openingId
      ? corrected({ ...opening, ...correction.patch }, correction) as T
      : opening;
    next.openings = next.openings.map(update);
    next.doors = next.doors.map(update);
    next.windows = next.windows.map(update);
  } else if (correction.type === "update_room") {
    next.rooms = next.rooms.map((room) => room.id === correction.roomId ? corrected({ ...room, ...correction.patch }, correction) : room);
  } else if (correction.type === "set_scale") {
    if (!Number.isFinite(correction.drawingUnitsPerMeter) || correction.drawingUnitsPerMeter <= 0) throw new Error("Manual Blueprint scale must be greater than zero.");
    next.scale = { source: "manual", drawingUnitsPerMeter: correction.drawingUnitsPerMeter, confidence: 1 };
  }
  next.reconstructionVersion = `${graph.reconstructionVersion}+corrected`;
  next.metadata.algorithms = { ...next.metadata.algorithms, corrections: "manual-correction-1.0.0" };
  return next;
}

export function replayBosGraphCorrections(graph: BosBuildingGraph, corrections: BosGraphCorrection[]) {
  return corrections.reduce((current, correction) => applyBosGraphCorrection(current, correction), graph);
}
