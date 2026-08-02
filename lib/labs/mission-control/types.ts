export type MissionSeverity =
  | "healthy"
  | "info"
  | "attention"
  | "critical"
  | "orion"
  | "unknown"
  | "stale"
  | "unavailable";

export type MissionFreshness = "live" | "partial" | "stale" | "unknown";

export type MissionScenarioId = "normal-operations" | "weather-risk" | "labor-shortage";

export type CompanyDimension = {
  id: string;
  label: string;
  value: string;
  trend: string;
  status: MissionSeverity;
  freshness: MissionFreshness;
};

export type CompanyState = {
  greeting: string;
  companyName: string;
  stateLabel: string;
  summary: string;
  primaryOrionStatement: string;
  scenarioLabel: string;
  freshness: MissionFreshness;
  completenessPercent: number;
  healthScore: number;
  trend: string;
  limitations: string[];
  dimensions: CompanyDimension[];
};

export type OrionPriorityKind = "fact" | "prediction" | "recommendation";

export type OrionPriority = {
  id: string;
  status: MissionSeverity;
  kind: OrionPriorityKind;
  observation: string;
  whyItMatters: string;
  evidence: string;
  evidenceQuality: string;
  confidenceLabel: string;
  limitation: string;
  recommendedNextStep: string;
  approvalBoundary: string;
};

export type TwinNodeGroup = "project" | "crew" | "equipment" | "operations" | "schedule";

export type TwinNode = {
  id: string;
  label: string;
  group: TwinNodeGroup;
  status: MissionSeverity;
  x: number;
  y: number;
  detail: string;
};

export type TwinLink = {
  id: string;
  from: string;
  to: string;
  relation: string;
};

export type MissionMetric = {
  id: string;
  label: string;
  value: string;
  status: MissionSeverity;
  trend: string;
  freshness: MissionFreshness;
};

export type MissionTimelineEventType =
  | "crew-check-in"
  | "delivery-confirmation"
  | "inspection-update"
  | "schedule-adjustment"
  | "orion-evidence-update";

export type MissionTimelineEvent = {
  id: string;
  at: string;
  type: MissionTimelineEventType;
  entity: string;
  status: MissionSeverity;
  detail: string;
  source: string;
  freshness: MissionFreshness;
};

export type PriorityAction = {
  id: string;
  title: string;
  purpose: string;
  owner: string;
  due: string;
  urgency: "low" | "moderate" | "high";
  status: MissionSeverity;
  evidenceSource: string;
  approvalRequired: string;
  previewLabel: "Review" | "Inspect details" | "Preview plan";
};

export type MissionScenario = {
  id: MissionScenarioId;
  name: string;
  companyState: CompanyState;
  priorities: OrionPriority[];
  twinNodes: TwinNode[];
  twinLinks: TwinLink[];
  metrics: MissionMetric[];
  timeline: MissionTimelineEvent[];
  actions: PriorityAction[];
};
