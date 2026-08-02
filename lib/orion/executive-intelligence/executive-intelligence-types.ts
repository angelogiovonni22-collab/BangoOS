import type { BusinessImpact, BusinessSignal, BusinessSignalInput, BusinessSignalSeverity, DecisionPack, SignalFreshness } from "../decision-engine";
import type { GraphEdge, GraphEntityType, GraphNode, OrionGraphEnrichment } from "../knowledge-graph";
import type { OrionDecisionPackEnrichment, OrionEntityType, OrionOrganizationalMemoryRecord } from "../memory";

export type ExecutivePriorityStatus =
  | "new"
  | "ongoing"
  | "improving"
  | "worsening"
  | "unresolved"
  | "unverifiable";

export type ExecutivePriorityCategory =
  | "workforce"
  | "schedule"
  | "equipment"
  | "customer"
  | "financial"
  | "safety"
  | "operations";

export type ExecutiveUrgency = "immediate" | "today" | "soon" | "monitor";

export type ExecutiveDataCompleteness = {
  isComplete: boolean;
  missingFields: string[];
};

export type ExecutiveSignalEntityReference = {
  entityType: OrionEntityType | GraphEntityType;
  entityId: string;
  companyId: string;
};

export type ExecutiveSignalFact = {
  companyId: string;
  category: ExecutivePriorityCategory;
  severity: BusinessSignalSeverity;
  urgency: ExecutiveUrgency;
  observation: string;
  evidence: Array<{
    id: string;
    label: string;
    value: string;
    source: string;
    observedAt: string;
  }>;
  missingInformation: string[];
  freshness: SignalFreshness;
  createdAt: string;
  canonicalConditionType: string;
  ruleFamily: string;
  signalType: string;
  entityReferences: ExecutiveSignalEntityReference[];
  graphRootEntity?: {
    entityType: GraphEntityType;
    entityId: string;
  };
  approvalBoundary?: string;
};

export type ExecutivePipelineFixture = {
  scenarioId: string;
  companyId: string;
  evaluationWindow: {
    start: string;
    end: string;
  };
  signalFacts: ExecutiveSignalFact[];
  memoryRecords: OrionOrganizationalMemoryRecord[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  sourceAvailability: {
    memory: "available" | "unavailable";
    graph: "available" | "unavailable";
  };
};

export type SignalAdapterOutput = {
  adapted: Array<{
    fact: ExecutiveSignalFact;
    input: BusinessSignalInput;
  }>;
  limitations: string[];
  unsupported: string[];
};

export type MemoryAdapterResult = {
  enrichmentByDecisionPackId: Map<string, OrionDecisionPackEnrichment>;
  limitations: string[];
  partialFailures: ExecutivePartialFailure[];
};

export type GraphAdapterResult = {
  enrichmentByDecisionPackId: Map<string, OrionGraphEnrichment>;
  limitations: string[];
  partialFailures: ExecutivePartialFailure[];
  rejectedEdgeIds: string[];
};

export type ExecutivePartialFailure = {
  source: "signals" | "memory" | "graph" | "scope";
  code: string;
  message: string;
  fatal: boolean;
};

export type ExecutivePriority = {
  id: string;
  companyId: string;
  title: string;
  category: ExecutivePriorityCategory;
  severity: BusinessSignalSeverity;
  urgency: ExecutiveUrgency;
  observation: string;
  whyItMatters: string;
  businessImpact: BusinessImpact;
  evidence: string[];
  missingInformation: string[];
  recommendation: string;
  approvalBoundary: string;
  signalIds: string[];
  decisionPackIds: string[];
  relatedMemoryIds: string[];
  relatedGraphNodeIds: string[];
  relationshipPaths: string[];
  confidence: number;
  confidenceReasons: string[];
  freshness: SignalFreshness | "mixed";
  dataCompleteness: ExecutiveDataCompleteness;
  limitations: string[];
  status: ExecutivePriorityStatus;
  canonicalConditionType: string;
  ruleFamily: string;
  affectedEntityIds: string[];
  businessWindow: string;
};

export type ExecutiveBriefStatement = {
  statement: string;
  signalIds: string[];
  evidence: string[];
  memoryIds: string[];
  relationshipPathIds: string[];
};

export type ExecutiveBrief = {
  greetingContext: ExecutiveBriefStatement;
  companyState: ExecutiveBriefStatement;
  topPriorities: ExecutiveBriefStatement[];
  stableOperations: ExecutiveBriefStatement[];
  emergingRisks: ExecutiveBriefStatement[];
  opportunities: ExecutiveBriefStatement[];
  cashFlowContext: ExecutiveBriefStatement[];
  workforceContext: ExecutiveBriefStatement[];
  equipmentContext: ExecutiveBriefStatement[];
  scheduleContext: ExecutiveBriefStatement[];
  dataTrustSummary: ExecutiveBriefStatement;
  recommendedReviewOrder: string[];
  limitations: string[];
};

export type DataTrustSummary = {
  freshness: "fresh" | "mixed" | "stale" | "unknown";
  completeness: "complete" | "partial" | "incomplete" | "unknown";
  verifiedSourceCount: number;
  staleSourceCount: number;
  unavailableSourceCount: number;
  conflictingEvidenceCount: number;
  confidenceExplanation: string[];
  limitations: string[];
};

export type ExecutiveIntelligenceResult = {
  id: string;
  companyId: string;
  generatedAt: string;
  evaluationWindow: {
    start: string;
    end: string;
  };
  overallStatus: "stable" | "watch" | "critical" | "limited";
  dataFreshness: DataTrustSummary["freshness"];
  dataCompleteness: DataTrustSummary["completeness"];
  signalCount: number;
  decisionPackCount: number;
  memoryMatchCount: number;
  graphRelationshipCount: number;
  priorities: ExecutivePriority[];
  executiveBrief: ExecutiveBrief;
  limitations: string[];
  partialFailures: ExecutivePartialFailure[];
  sourceVersions: {
    decisionEngine: string;
    memory: string;
    knowledgeGraph: string;
    executiveIntelligence: string;
  };
  dataTrust: DataTrustSummary;
};

export type ExecutiveIntelligenceServiceInput = {
  fixture: ExecutivePipelineFixture;
  nowIso: string;
  memoryMinimumScore?: number;
};

export type PriorityRankingInput = {
  signal: BusinessSignal;
  fact: ExecutiveSignalFact;
  decisionPack: DecisionPack;
  memory: OrionDecisionPackEnrichment | null;
  graph: OrionGraphEnrichment | null;
  evaluationWindow: { start: string; end: string };
};

export const EXECUTIVE_INTELLIGENCE_VERSION = "orion-executive-intelligence-v1";
