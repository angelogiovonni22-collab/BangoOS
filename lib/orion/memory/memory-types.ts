import type { BusinessImpact, BusinessSignalSeverity, DecisionPack, SignalFreshness } from "../decision-engine/types";

export type OrionMemoryOutcomeState =
  | "unresolved"
  | "resolved_successfully"
  | "resolved_partially"
  | "resolved_unsuccessfully"
  | "false_positive"
  | "insufficient_data"
  | "no_action_taken";

export type OrionMemoryAgeClass = "recent" | "established" | "historical" | "stale" | "unknown";

export type OrionEntityType =
  | "project"
  | "crew"
  | "equipment"
  | "customer"
  | "task"
  | "phase"
  | "employee"
  | "vendor"
  | "assignment"
  | "workspace";

export type OrionEntityReference = {
  entityType: OrionEntityType;
  entityId: string;
  companyId: string | null;
};

export type OrionMeasuredImpact = {
  metric: string;
  value: number | string | null;
  unit: string | null;
};

export type OrionMemoryOutcome = {
  state: OrionMemoryOutcomeState;
  summary: string | null;
  evidence: string[];
  actionTaken: string | null;
  result: string | null;
  measuredImpact: OrionMeasuredImpact | null;
  limitations: string[];
  verifiedAt: string | null;
  verifiedBy: string | null;
  confidence: number;
};

export type OrionDataCompleteness = {
  isComplete: boolean;
  missingInformationKeys: string[];
};

export type OrionOrganizationalMemoryRecord = {
  id: string;
  companyId: string;
  sourceSignalId: string;
  sourceDecisionPackId: string;
  category: string;
  signalType: string;
  entityReferences: OrionEntityReference[];
  normalizedObservation: string;
  normalizedEvidenceKeys: string[];
  businessImpact: BusinessImpact;
  severity: BusinessSignalSeverity;
  confidence: number;
  freshness: SignalFreshness;
  detectedAt: string;
  resolvedAt: string | null;
  outcome: OrionMemoryOutcome;
  actionsTaken: string[];
  measurableResult: OrionMeasuredImpact | null;
  lessonsLearned: string[];
  dataCompleteness: OrionDataCompleteness;
  ruleId: string;
  ruleVersion: string;
  memoryVersion: string;
};

export type OrionSignalMemoryInput = {
  signalId: string;
  companyId: string;
  category: string;
  signalType: string;
  entityReferences: OrionEntityReference[];
  normalizedObservation: string;
  normalizedEvidenceKeys: string[];
  businessImpact: BusinessImpact;
  severity: BusinessSignalSeverity;
  freshness: SignalFreshness;
  detectedAt: string;
  dataCompleteness: OrionDataCompleteness;
  ruleId: string;
  ruleVersion: string;
};

export type OrionMemorySignature = {
  companyId: string;
  category: string;
  signalType: string;
  affectedEntityTypes: string[];
  ruleId: string;
  ruleVersion: string;
  normalizedEvidenceKeys: string[];
  businessImpactClass: BusinessImpact;
  timeWindowClass: string;
  missingInformationClass: string;
  key: string;
};

export const ORION_MEMORY_SIMILARITY_THRESHOLDS = {
  exact_match: 0.92,
  strong_match: 0.78,
  moderate_match: 0.6,
  weak_match: 0.4,
} as const;

export type OrionSimilarityLevel = keyof typeof ORION_MEMORY_SIMILARITY_THRESHOLDS | "unrelated";

export const ORION_MEMORY_SIMILARITY_WEIGHTS = {
  sameCategory: 0.16,
  sameSignalType: 0.14,
  sameEntityType: 0.1,
  sameRule: 0.14,
  overlappingEvidence: 0.16,
  businessImpact: 0.08,
  severity: 0.06,
  freshness: 0.06,
  missingPattern: 0.06,
  samePrimaryEntity: 0.04,
} as const;

export type OrionSimilarityFactorResult = {
  factor: keyof typeof ORION_MEMORY_SIMILARITY_WEIGHTS;
  weight: number;
  contribution: number;
  matched: boolean;
};

export type OrionSimilarityResult = {
  memoryId: string;
  score: number;
  level: OrionSimilarityLevel;
  matchedFactors: OrionSimilarityFactorResult[];
  unmatchedFactors: OrionSimilarityFactorResult[];
  limitations: string[];
};

export type OrionPatternSummary = {
  key: string;
  statement: string;
  sampleSize: number;
  windowDays: number;
  evidence: string[];
};

export type OrionMemoryConfidence = {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
};

export type OrionHistoricalContextResult = {
  currentSignalId: string;
  matchedMemoryIds: string[];
  matchCount: number;
  strongestMatchScore: number;
  similarityLevel: OrionSimilarityLevel;
  commonEvidence: string[];
  commonOutcomes: OrionMemoryOutcomeState[];
  commonActions: string[];
  observedPatterns: OrionPatternSummary[];
  limitations: string[];
  confidence: OrionMemoryConfidence;
  freshness: OrionMemoryAgeClass;
  generatedAt: string;
};

export type OrionDecisionPackEnrichment = {
  historicalContext: OrionHistoricalContextResult;
  similarCaseCount: number;
  strongestSimilarity: number;
  priorActions: string[];
  priorOutcomes: OrionMemoryOutcomeState[];
  recurringPattern: string | null;
  memoryConfidence: OrionMemoryConfidence;
  memoryLimitations: string[];
};

export type OrionMemoryServiceInput = {
  currentSignal: OrionSignalMemoryInput;
  decisionPack: DecisionPack;
  memories: OrionOrganizationalMemoryRecord[];
  nowIso: string;
  minimumScore?: number;
};

export const ORION_MEMORY_DEFAULTS = {
  memoryVersion: "orion-memory-v1",
  patternMinimumSampleSize: 3,
  patternWindowDays: 365,
  maxMatches: 8,
} as const;
