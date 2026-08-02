import type { DecisionPack } from "../decision-engine";
import { buildOrionMemoryEnrichment, type OrionEntityType, type OrionSignalMemoryInput, type OrionOrganizationalMemoryRecord } from "../memory";
import type { ExecutiveSignalFact, MemoryAdapterResult } from "./executive-intelligence-types";

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function toMemoryEntityType(value: ExecutiveSignalFact["entityReferences"][number]["entityType"]): OrionEntityType {
  if (value === "project_phase") {
    return "phase";
  }

  if (value === "change_order") {
    return "task";
  }

  if (value === "purchase_order" || value === "payment" || value === "document" || value === "inspection" || value === "invoice" || value === "schedule_event" || value === "company" || value === "estimate") {
    return "workspace";
  }

  if (value === "crew" || value === "customer" || value === "project" || value === "equipment" || value === "task" || value === "employee" || value === "vendor") {
    return value;
  }

  return "workspace";
}

function mapToMemoryInput(params: {
  fact: ExecutiveSignalFact;
  signalId: string;
}): OrionSignalMemoryInput {
  return {
    signalId: params.signalId,
    companyId: params.fact.companyId,
    category: params.fact.category,
    signalType: params.fact.signalType,
    entityReferences: params.fact.entityReferences.map((entity) => ({
      entityType: toMemoryEntityType(entity.entityType),
      entityId: entity.entityId,
      companyId: entity.companyId,
    })),
    normalizedObservation: params.fact.observation.toLowerCase(),
    normalizedEvidenceKeys: params.fact.evidence.map((item) => normalizeKey(item.label || item.value)).filter(Boolean),
    businessImpact: "MEDIUM",
    severity: params.fact.severity,
    freshness: params.fact.freshness,
    detectedAt: params.fact.createdAt,
    dataCompleteness: {
      isComplete: params.fact.missingInformation.length === 0,
      missingInformationKeys: params.fact.missingInformation.map((item) => normalizeKey(item)),
    },
    ruleId: `executive.${normalizeKey(params.fact.ruleFamily)}`,
    ruleVersion: "1.0.0",
  };
}

export function enrichDecisionPacksWithMemory(params: {
  companyId: string;
  nowIso: string;
  memoryRecords: OrionOrganizationalMemoryRecord[];
  pairs: Array<{
    decisionPackId: string;
    signalId: string;
    fact: ExecutiveSignalFact;
    decisionPack: DecisionPack;
  }>;
  minimumScore?: number;
  available: boolean;
}): MemoryAdapterResult {
  if (!params.available) {
    return {
      enrichmentByDecisionPackId: new Map(),
      limitations: ["Memory enrichment source is unavailable for this evaluation."],
      partialFailures: [{
        source: "memory",
        code: "MEMORY_SOURCE_UNAVAILABLE",
        message: "Memory source was unavailable; decision packs were evaluated without memory context.",
        fatal: false,
      }],
    };
  }

  const companyScopedRecords = params.memoryRecords.filter((record) => record.companyId === params.companyId);
  const enrichmentByDecisionPackId = new Map<string, ReturnType<typeof buildOrionMemoryEnrichment>>();
  const limitations: string[] = [];

  for (const pair of params.pairs) {
    const currentSignal = mapToMemoryInput({ fact: pair.fact, signalId: pair.signalId });
    const enrichment = buildOrionMemoryEnrichment({
      currentSignal,
      decisionPack: pair.decisionPack,
      memories: companyScopedRecords,
      nowIso: params.nowIso,
      minimumScore: params.minimumScore,
    });

    enrichmentByDecisionPackId.set(pair.decisionPackId, enrichment);
    limitations.push(...enrichment.memoryLimitations);
  }

  return {
    enrichmentByDecisionPackId,
    limitations: [...new Set(limitations)].sort((a, b) => a.localeCompare(b)),
    partialFailures: [],
  };
}
