export type PersistentOrionStateId =
  | "READY"
  | "ANALYZING"
  | "NEW_INSIGHT"
  | "ATTENTION"
  | "CRITICAL"
  | "STALE_DATA"
  | "UNAVAILABLE";

export type PersistentOrionFixture = {
  workspace: string;
  state: PersistentOrionStateId;
  observation: string;
  whyItMatters: string;
  evidenceStatus: "High" | "Moderate" | "Limited";
  dataFreshness: "Fresh" | "Mixed" | "Stale" | "Unavailable";
  recommendedNextReview: string;
  approvalBoundary: string;
  limitations: string;
};

export type PersistentOrionPalette = {
  ring: string;
  glow: string;
  core: string;
  accent: string;
  line: string;
  shadow: string;
};
