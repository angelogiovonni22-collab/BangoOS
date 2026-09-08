import type { BosBuildingGraph, BosValidationIssue } from "./building-graph";
import {
  replayBosGraphCorrectionsWithConflicts,
  type BosGraphCorrection,
  type BosGraphCorrectionConflict,
} from "./corrections";
import { applyBosValidation } from "./validation";

export type PersistedBosGraphCorrectionRow = {
  id: string;
  correction_type: BosGraphCorrection["type"];
  payload: unknown;
  created_by?: string | null;
  created_at: string;
};

export type PersistedBosGraphCorrectionReplay = {
  graph: BosBuildingGraph;
  corrections: BosGraphCorrection[];
  conflicts: BosGraphCorrectionConflict[];
};

const CORRECTION_TYPES = new Set<BosGraphCorrection["type"]>([
  "move_wall",
  "add_wall",
  "remove_wall",
  "classify_wall",
  "update_opening",
  "update_room",
  "set_scale",
]);

function toCorrection(row: PersistedBosGraphCorrectionRow): BosGraphCorrection | null {
  if (!CORRECTION_TYPES.has(row.correction_type)) return null;
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return null;

  const payload = row.payload as Record<string, unknown>;
  return {
    ...payload,
    id: row.id,
    type: row.correction_type,
    actorId: row.created_by || (typeof payload.actorId === "string" ? payload.actorId : undefined),
    createdAt: row.created_at || (typeof payload.createdAt === "string" ? payload.createdAt : new Date(0).toISOString()),
  } as BosGraphCorrection;
}

export function normalizePersistedBosGraphCorrections(rows: PersistedBosGraphCorrectionRow[]) {
  return rows
    .map(toCorrection)
    .filter((correction): correction is BosGraphCorrection => correction !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function latestPersistedManualScale(rows: PersistedBosGraphCorrectionRow[]) {
  const corrections = normalizePersistedBosGraphCorrections(rows);
  for (let index = corrections.length - 1; index >= 0; index -= 1) {
    const correction = corrections[index];
    if (correction.type === "set_scale" && Number.isFinite(correction.drawingUnitsPerMeter) && correction.drawingUnitsPerMeter > 0) {
      return correction.drawingUnitsPerMeter;
    }
  }
  return undefined;
}

function conflictIssue(conflicts: BosGraphCorrectionConflict[]): BosValidationIssue {
  const objectIds = conflicts.flatMap((conflict) => conflict.objectId ? [conflict.objectId] : []);
  return {
    id: "validation-correction-conflict",
    code: "CORRECTION_CONFLICT",
    severity: "warning",
    message: `${conflicts.length} saved Blueprint correction${conflicts.length === 1 ? "" : "s"} could not be replayed against the regenerated graph and require review.`,
    objectIds: objectIds.length ? objectIds : undefined,
  };
}

export function replayPersistedBosGraphCorrections(
  graph: BosBuildingGraph,
  rows: PersistedBosGraphCorrectionRow[],
): PersistedBosGraphCorrectionReplay {
  const corrections = normalizePersistedBosGraphCorrections(rows);
  if (!corrections.length) return { graph, corrections: [], conflicts: [] };

  const replayed = replayBosGraphCorrectionsWithConflicts(graph, corrections);
  let corrected = applyBosValidation(replayed.graph);

  if (replayed.conflicts.length) {
    corrected = {
      ...corrected,
      confidence: Math.min(corrected.confidence, 0.69),
      validation: {
        ...corrected.validation,
        status: corrected.validation.status === "failed" ? "failed" : "needs_review",
        issues: [
          ...corrected.validation.issues.filter((issue) => issue.code !== "CORRECTION_CONFLICT"),
          conflictIssue(replayed.conflicts),
        ],
      },
    };
  }

  return { graph: corrected, corrections, conflicts: replayed.conflicts };
}
