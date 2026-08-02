export type BusinessSignalCategory =
  | "Schedule"
  | "Financial"
  | "Workforce"
  | "Safety"
  | "Equipment"
  | "Customer"
  | "Documents"
  | "Communication"
  | "Compliance"
  | "Weather"
  | "Productivity"
  | "Quality";

export type BusinessSignalSeverity = "info" | "low" | "medium" | "high" | "critical";

export type BusinessImpact = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SignalFreshness = "live" | "partial" | "stale" | "unknown";

export type EstimatedPriority = "low" | "medium" | "high" | "critical";

export type SignalEvidence = {
  id: string;
  label: string;
  value: string;
  source: string;
  observedAt: string;
};

export type SignalConfidence = {
  percent: number;
  reasons: string[];
};

export type AdvisoryRecommendation = {
  title: string;
  reason: string;
  expectedOutcome: string;
  estimatedPriority: EstimatedPriority;
  approvalRequired: string;
};

export type BusinessSignal = {
  id: string;
  category: BusinessSignalCategory;
  severity: BusinessSignalSeverity;
  confidence: SignalConfidence;
  observation: string;
  businessImpact: BusinessImpact;
  evidence: SignalEvidence[];
  missingInformation: string[];
  recommendation: AdvisoryRecommendation;
  approvalRequired: string;
  freshness: SignalFreshness;
  createdAt: string;
};

export type PulseContributionDimension =
  | "Operations"
  | "Financial"
  | "Workforce"
  | "Safety"
  | "Equipment"
  | "Customer";

export type PulseContributions = Record<PulseContributionDimension, number>;

export type ContributionWeights = Record<PulseContributionDimension, number>;

export type SignalContributionResult = {
  signalId: string;
  contributions: PulseContributions;
  weights: ContributionWeights;
  impactMultiplier: number;
  freshnessMultiplier: number;
  confidenceMultiplier: number;
};

export type DecisionPack = {
  signalId: string;
  observation: string;
  businessImpact: BusinessImpact;
  evidence: SignalEvidence[];
  confidence: SignalConfidence;
  missingInformation: string[];
  recommendation: AdvisoryRecommendation;
  approvalBoundary: string;
  relatedSignals: string[];
};

export type BusinessSignalInput = {
  category: BusinessSignalCategory;
  severity: BusinessSignalSeverity;
  observation: string;
  evidence: SignalEvidence[];
  missingInformation: string[];
  freshness: SignalFreshness;
  createdAt: string;
  recommendationHint?: string;
};
