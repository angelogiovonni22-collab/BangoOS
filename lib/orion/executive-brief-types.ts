import type { DashboardSectionErrors, ExecutiveDashboardData } from "@/lib/dashboard/types";
import type { LearningServiceResult } from "@/lib/bango-intelligence/learning/learning-service";
import type { MemorySummary } from "@/lib/bango-intelligence/memory/memory-types";

export type ExecutiveReadinessState = "ready" | "limited" | "attention";

export type ExecutiveSeverity = "critical" | "high" | "medium" | "low";

export type ExecutiveSummaryItem = {
  id: string;
  label: string;
  value: string;
  href: string | null;
  tone: "default" | "warning" | "success" | "muted";
};

export type ExecutiveGreeting = {
  eyebrow: string;
  title: string;
  description: string;
};

export type ExecutiveCompanySummary = {
  headline: string;
  items: ExecutiveSummaryItem[];
};

export type ExecutiveHealthSummary = {
  headline: string;
  state: ExecutiveReadinessState;
  items: ExecutiveSummaryItem[];
};

export type ExecutivePriorityItem = {
  id: string;
  title: string;
  description: string;
  severity: ExecutiveSeverity;
  category: "schedule" | "budget" | "quality" | "operations" | "documentation";
  affectedCount: number | null;
  href: string | null;
  source: "dashboard" | "memory" | "learning";
  score: number;
};

export type ExecutiveNotification = {
  id: string;
  tone: "info" | "warning" | "success";
  message: string;
};

export type ExecutiveLimitation = {
  id: string;
  message: string;
};

export type ExecutiveCommandDefinition = {
  id: string;
  label: string;
  example: string;
  href: string | null;
};

export type ExecutiveBrief = {
  greeting: ExecutiveGreeting;
  companySummary: ExecutiveCompanySummary;
  healthSummary: ExecutiveHealthSummary;
  priorityItems: ExecutivePriorityItem[];
  notifications: ExecutiveNotification[];
  readinessState: ExecutiveReadinessState;
  limitations: ExecutiveLimitation[];
  generatedAt: string;
  quickCommands: ExecutiveCommandDefinition[];
};

export type ExecutiveCommandResult = {
  supported: boolean;
  message: string;
  href: string | null;
};

export type ExecutiveBriefBuildInput = {
  companyId: string;
  companyName: string | null;
  companyRole: string | null;
  dashboardData: ExecutiveDashboardData;
  dashboardSectionErrors: DashboardSectionErrors;
  learning: LearningServiceResult;
  memorySummary: MemorySummary;
  now: Date;
  localeTag: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};