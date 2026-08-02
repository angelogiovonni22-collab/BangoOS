import {
  buildBusinessSignal,
  buildDecisionPack,
  normalizeBusinessSignals,
  GRAPH_DEFAULTS,
  ORION_MEMORY_DEFAULTS,
  type BusinessSignal,
  type DecisionPack,
} from "../index";
import { buildExecutiveBrief } from "./executive-brief-builder";
import { adaptFixtureSignals } from "./signal-adapter";
import { enrichDecisionPacksWithMemory } from "./memory-enrichment-adapter";
import { enrichDecisionPacksWithGraph } from "./graph-enrichment-adapter";
import { rankExecutivePriorities } from "./priority-ranker";
import {
  EXECUTIVE_INTELLIGENCE_VERSION,
  type DataTrustSummary,
  type ExecutiveIntelligenceResult,
  type ExecutiveIntelligenceServiceInput,
  type ExecutivePartialFailure,
} from "./executive-intelligence-types";

function stableId(parts: Array<string | number>): string {
  return parts.join("::").toLowerCase().replace(/[^a-z0-9:._-]/g, "_");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function computeDataTrust(params: {
  priorities: ExecutiveIntelligenceResult["priorities"];
  partialFailures: ExecutivePartialFailure[];
  limitations: string[];
}): DataTrustSummary {
  const staleCount = params.priorities.filter((priority) => priority.freshness === "stale" || priority.freshness === "mixed").length;
  const unknownCount = params.priorities.filter((priority) => priority.freshness === "unknown").length;
  const incompleteCount = params.priorities.filter((priority) => !priority.dataCompleteness.isComplete).length;

  const freshness: DataTrustSummary["freshness"] =
    unknownCount > 0 ? "unknown" :
      staleCount > 0 && staleCount < params.priorities.length ? "mixed" :
        staleCount > 0 ? "stale" : "fresh";

  const completeness: DataTrustSummary["completeness"] =
    params.priorities.length === 0 ? "unknown" :
      incompleteCount === 0 ? "complete" :
        incompleteCount < params.priorities.length ? "partial" : "incomplete";

  const conflictingEvidenceCount = params.priorities
    .filter((priority) => priority.status === "worsening" || priority.status === "unresolved")
    .length;

  const unavailableSourceCount = params.partialFailures.filter((failure) => !failure.fatal).length;

  const confidenceExplanation = [
    `Freshness=${freshness} based on ${staleCount} stale/mixed priorities and ${unknownCount} unknown priorities.`,
    `Completeness=${completeness} with ${incompleteCount} incomplete priorities out of ${params.priorities.length}.`,
    `Unavailable sources=${unavailableSourceCount}.`,
  ];

  return {
    freshness,
    completeness,
    verifiedSourceCount: Math.max(0, 3 - unavailableSourceCount),
    staleSourceCount: staleCount,
    unavailableSourceCount,
    conflictingEvidenceCount,
    confidenceExplanation,
    limitations: params.limitations,
  };
}

function overallStatus(params: {
  priorities: ExecutiveIntelligenceResult["priorities"];
  partialFailures: ExecutivePartialFailure[];
}): ExecutiveIntelligenceResult["overallStatus"] {
  if (params.partialFailures.some((failure) => failure.fatal)) {
    return "critical";
  }

  if (params.priorities.some((priority) => priority.severity === "critical")) {
    return "critical";
  }

  if (params.partialFailures.length > 0) {
    return "limited";
  }

  if (params.priorities.some((priority) => priority.severity === "high" || priority.severity === "medium")) {
    return "watch";
  }

  return "stable";
}

export function evaluateExecutiveIntelligence(input: ExecutiveIntelligenceServiceInput): ExecutiveIntelligenceResult {
  if (!input.fixture.companyId) {
    throw new Error("Company scope is required for executive intelligence evaluation.");
  }

  const fixtureSnapshot = clone(input.fixture);

  const signalAdapter = adaptFixtureSignals({
    companyId: fixtureSnapshot.companyId,
    facts: fixtureSnapshot.signalFacts,
  });

  if (signalAdapter.adapted.length === 0) {
    throw new Error("No company-scoped signals were available for executive intelligence evaluation.");
  }

  const signals = normalizeBusinessSignals(signalAdapter.adapted.map((item) => buildBusinessSignal(item.input)));
  const signalByObservation = new Map(signals.map((signal) => [signal.observation, signal]));

  const packs: Array<{
    decisionPackId: string;
    signalId: string;
    fact: (typeof signalAdapter.adapted)[number]["fact"];
    signal: BusinessSignal;
    decisionPack: DecisionPack;
  }> = signalAdapter.adapted
    .map((item) => {
      const signal = signalByObservation.get(item.input.observation.trim()) ?? signals[0];
      const related = signals.filter((candidate) => candidate.id !== signal.id).slice(0, 3);
      const decisionPack = buildDecisionPack(signal, related);
      const decisionPackId = stableId(["decision-pack", fixtureSnapshot.companyId, signal.id, item.fact.ruleFamily]);

      return {
        decisionPackId,
        signalId: signal.id,
        fact: item.fact,
        signal,
        decisionPack,
      };
    })
    .sort((left, right) => left.decisionPackId.localeCompare(right.decisionPackId));

  const memoryResult = enrichDecisionPacksWithMemory({
    companyId: fixtureSnapshot.companyId,
    nowIso: input.nowIso,
    memoryRecords: fixtureSnapshot.memoryRecords,
    pairs: packs.map((pack) => ({
      decisionPackId: pack.decisionPackId,
      signalId: pack.signalId,
      fact: pack.fact,
      decisionPack: pack.decisionPack,
    })),
    minimumScore: input.memoryMinimumScore,
    available: fixtureSnapshot.sourceAvailability.memory === "available",
  });

  const graphResult = enrichDecisionPacksWithGraph({
    companyId: fixtureSnapshot.companyId,
    nowIso: input.nowIso,
    nodes: fixtureSnapshot.graph.nodes,
    edges: fixtureSnapshot.graph.edges,
    pairs: packs.map((pack) => ({
      decisionPackId: pack.decisionPackId,
      fact: pack.fact,
    })),
    available: fixtureSnapshot.sourceAvailability.graph === "available",
    maxDepth: GRAPH_DEFAULTS.defaultTraversalDepth,
  });

  const rankedPriorities = rankExecutivePriorities(
    packs.map((pack) => ({
      signal: pack.signal,
      fact: pack.fact,
      decisionPack: {
        ...pack.decisionPack,
        signalId: pack.decisionPackId,
      },
      memory: memoryResult.enrichmentByDecisionPackId.get(pack.decisionPackId) ?? null,
      graph: graphResult.enrichmentByDecisionPackId.get(pack.decisionPackId) ?? null,
      evaluationWindow: fixtureSnapshot.evaluationWindow,
    })),
  );

  const limitations = [
    ...signalAdapter.limitations,
    ...signalAdapter.unsupported,
    ...memoryResult.limitations,
    ...graphResult.limitations,
  ];

  const partialFailures: ExecutivePartialFailure[] = [
    ...memoryResult.partialFailures,
    ...graphResult.partialFailures,
  ];

  const dataTrust = computeDataTrust({
    priorities: rankedPriorities,
    partialFailures,
    limitations: [...new Set(limitations)].sort((a, b) => a.localeCompare(b)),
  });

  const executiveBrief = buildExecutiveBrief({
    companyId: fixtureSnapshot.companyId,
    priorities: rankedPriorities,
    dataTrust,
    limitations: dataTrust.limitations,
  });

  const id = stableId([
    "executive-intelligence",
    fixtureSnapshot.companyId,
    fixtureSnapshot.scenarioId,
    fixtureSnapshot.evaluationWindow.start,
    fixtureSnapshot.evaluationWindow.end,
    rankedPriorities.map((priority) => priority.id).join("|"),
  ]);

  return {
    id,
    companyId: fixtureSnapshot.companyId,
    generatedAt: input.nowIso,
    evaluationWindow: fixtureSnapshot.evaluationWindow,
    overallStatus: overallStatus({ priorities: rankedPriorities, partialFailures }),
    dataFreshness: dataTrust.freshness,
    dataCompleteness: dataTrust.completeness,
    signalCount: signals.length,
    decisionPackCount: packs.length,
    memoryMatchCount: rankedPriorities.reduce((sum, priority) => sum + priority.relatedMemoryIds.length, 0),
    graphRelationshipCount: rankedPriorities.reduce((sum, priority) => sum + priority.relatedGraphNodeIds.length, 0),
    priorities: rankedPriorities,
    executiveBrief,
    limitations: dataTrust.limitations,
    partialFailures,
    sourceVersions: {
      decisionEngine: "orion-decision-engine-v1",
      memory: ORION_MEMORY_DEFAULTS.memoryVersion,
      knowledgeGraph: GRAPH_DEFAULTS.graphVersion,
      executiveIntelligence: EXECUTIVE_INTELLIGENCE_VERSION,
    },
    dataTrust,
  };
}
