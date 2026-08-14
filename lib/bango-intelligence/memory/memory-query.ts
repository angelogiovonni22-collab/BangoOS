import type { MemoryCapabilities, MemoryRecord, MemoryRetrievalQuery } from "./memory-types";
import { rankMemories } from "./memory-ranking";

export function normalizeMemoryQuery(query: MemoryRetrievalQuery): MemoryRetrievalQuery {
  return {
    ...query,
    maxResults: query.maxResults && query.maxResults > 0 ? query.maxResults : 10,
  };
}

export function retrieveRankedMemoryEvidence(
  records: MemoryRecord[],
  query: MemoryRetrievalQuery,
  capabilities: MemoryCapabilities,
) {
  return rankMemories(records, normalizeMemoryQuery(query), capabilities);
}
