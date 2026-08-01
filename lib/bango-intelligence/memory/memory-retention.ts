import type { MemoryRecord, MemoryRetrievalQuery } from "./memory-types";

export function includeMemoryByRetention(record: MemoryRecord, query: MemoryRetrievalQuery): boolean {
  if (!query.includeArchived && (record.status === "archived" || record.archivedAt)) {
    return false;
  }

  if (!query.includeExpired && isExpired(record)) {
    return false;
  }

  // Verified lessons are retained indefinitely unless explicitly archived.
  if (record.category === "lesson_learned" && record.confidence === "verified" && !record.archivedAt) {
    return true;
  }

  return true;
}

function isExpired(record: MemoryRecord): boolean {
  if (record.status === "expired") {
    return true;
  }
  if (!record.expiresAt) {
    return false;
  }
  return Date.parse(record.expiresAt) <= Date.now();
}
