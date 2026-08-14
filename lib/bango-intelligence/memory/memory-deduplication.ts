import type { MemoryCreateInput, MemoryDeduplicationOutcome, MemoryRecord } from "./memory-types";

export type MemoryDeduplicationDecision = {
  outcome: MemoryDeduplicationOutcome;
  existingRecord: MemoryRecord | null;
};

export function decideMemoryDeduplication(existingRecords: MemoryRecord[], candidate: MemoryCreateInput): MemoryDeduplicationDecision {
  const normalizedTitle = normalize(candidate.title);
  const sourceId = candidate.sourceReferences[0]?.id ?? "";

  const sameKeyRecords = existingRecords.filter((record) =>
    record.scope === candidate.scope
    && record.category === candidate.category
    && normalize(record.title) === normalizedTitle
    && (record.projectId ?? null) === (candidate.projectId ?? null)
    && (record.customerId ?? null) === (candidate.customerId ?? null)
    && (record.taskId ?? null) === (candidate.taskId ?? null)
    && (record.phaseId ?? null) === (candidate.phaseId ?? null)
    && (record.sourceReferences[0]?.id ?? "") === sourceId
    && record.status === "active"
  );

  const exact = sameKeyRecords.find((record) => normalize(record.summary) === normalize(candidate.summary));
  if (exact) {
    return { outcome: "rejected_exact_duplicate", existingRecord: exact };
  }

  const latest = sameKeyRecords.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null;
  if (!latest) {
    return { outcome: "created_new", existingRecord: null };
  }

  if (latest.confidence !== "verified" && candidate.confidence === "verified") {
    return { outcome: "updated_existing", existingRecord: latest };
  }

  return { outcome: "archived_previous_created_new", existingRecord: latest };
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
