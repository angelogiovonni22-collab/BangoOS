export type QuantumSeverity = "healthy" | "info" | "attention" | "critical" | "orion";

export type QuantumFreshness = "live" | "delayed" | "stale" | "unknown";

export type QuantumMetricData = {
  id: string;
  label: string;
  value: string;
  trend: string;
  status: QuantumSeverity;
  freshness: QuantumFreshness;
};

export type QuantumTimelineEvent = {
  id: string;
  title: string;
  detail: string;
  at: string;
  status: QuantumSeverity;
};

export type QuantumInsight = {
  id: string;
  topObservation: string;
  whyItMatters: string;
  evidenceQuality: string;
  confidence: string;
  nextStep: string;
  limitations: string[];
  status: QuantumSeverity;
};

export type QuantumAction = {
  id: string;
  title: string;
  owner: string;
  due: string;
  impact: string;
  status: QuantumSeverity;
};

export type QuantumPulse = {
  id: string;
  label: string;
  value: string;
  status: QuantumSeverity;
};

export type QuantumPulseDimension = {
  id: string;
  label: string;
  value: string;
  trend: string;
  freshness: QuantumFreshness;
  status: QuantumSeverity;
};

export type QuantumCompanyState = {
  id: string;
  executiveGreeting: string;
  companyName: string;
  healthScore: number;
  healthLabel: string;
  directionalTrend: string;
  freshness: QuantumFreshness;
  limitations: string[];
  dimensions: QuantumPulseDimension[];
};

export type QuantumTwinNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  group: "project" | "crew" | "equipment" | "operations";
  status: QuantumSeverity;
};

export type QuantumTwinLink = {
  id: string;
  from: string;
  to: string;
};
