import { ORION_MEMORY_DEFAULTS, type OrionDecisionPackEnrichment, type OrionMemoryServiceInput, type OrionOrganizationalMemoryRecord } from "./memory-types";
import { rankSimilarMemories } from "./similarity-engine";
import { buildHistoricalContext } from "./memory-context-builder";

function filterCompanyScopedMemories(params: {
  companyId: string;
  memories: OrionOrganizationalMemoryRecord[];
}): OrionOrganizationalMemoryRecord[] {
  return params.memories
    .filter((memory) => memory.companyId === params.companyId)
    .filter((memory) => memory.entityReferences.every((entity) => !entity.companyId || entity.companyId === params.companyId));
}

export function buildOrionMemoryEnrichment(input: OrionMemoryServiceInput): OrionDecisionPackEnrichment {
  const companyScopedMemories = filterCompanyScopedMemories({
    companyId: input.currentSignal.companyId,
    memories: input.memories,
  });

  const rankedMatches = rankSimilarMemories({
    currentSignal: input.currentSignal,
    memories: companyScopedMemories,
    minimumScore: input.minimumScore,
  }).slice(0, ORION_MEMORY_DEFAULTS.maxMatches);

  const matchedRecordsById = new Map(companyScopedMemories.map((memory) => [memory.id, memory]));
  const matchedRecords = rankedMatches
    .map((match) => matchedRecordsById.get(match.memoryId) ?? null)
    .filter((memory): memory is OrionOrganizationalMemoryRecord => memory !== null);

  const historicalContext = buildHistoricalContext({
    currentSignalId: input.currentSignal.signalId,
    matches: rankedMatches,
    matchedRecords,
    nowIso: input.nowIso,
  });

  return {
    historicalContext,
    similarCaseCount: historicalContext.matchCount,
    strongestSimilarity: historicalContext.strongestMatchScore,
    priorActions: historicalContext.commonActions,
    priorOutcomes: historicalContext.commonOutcomes,
    recurringPattern: historicalContext.observedPatterns[0]?.statement ?? null,
    memoryConfidence: historicalContext.confidence,
    memoryLimitations: historicalContext.limitations,
  };
}
