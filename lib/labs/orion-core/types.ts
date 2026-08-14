export type OrionCoreStateId =
  | "READY"
  | "ANALYZING"
  | "NEW_INSIGHT"
  | "ATTENTION"
  | "CRITICAL"
  | "STALE_DATA"
  | "UNAVAILABLE"
  | "REDUCED_MOTION";

export type OrionRingStyle = "solid" | "arc" | "double-pulse" | "halo" | "critical-pulse" | "dashed" | "static";

export type OrionStateSeverity = "info" | "attention" | "critical" | "stale" | "unavailable";

export type OrionExecutiveSnapshot = {
  companyHealth: string;
  topPriority: string;
  whyItMatters: string;
  evidenceQuality: "High" | "Moderate" | "Limited";
  freshness: "fresh" | "mixed" | "stale" | "unknown";
  supportingSignalCount: number;
  memoryMatchCount: number;
  graphRelationshipCount: number;
  recommendedReviewOrder: string[];
  recommendedNextStep: string;
  approvalBoundary: string;
  limitations: string[];
};

export type OrionCoreScenario = {
  id: OrionCoreStateId;
  title: string;
  stateLabel: string;
  ariaStateLabel: string;
  severity: OrionStateSeverity;
  ringStyle: OrionRingStyle;
  hasPriorityIndicator: boolean;
  motionHint: string;
  textCue: string;
  badgeLabel: string;
  executiveSnapshot: OrionExecutiveSnapshot;
};
