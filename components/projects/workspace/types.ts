import type { ReactNode } from "react";

export type ProjectWorkspaceTabKey =
  | "overview"
  | "daily_reports"
  | "scheduling"
  | "crew"
  | "equipment"
  | "safety"
  | "plans"
  | "financials"
  | "ai_insights";

export type WorkspaceSummaryCardItem = {
  label: string;
  value: string;
  context: string;
  icon: ReactNode;
  tone: "blue" | "green" | "amber" | "indigo" | "slate" | "analytics";
};

export type WorkspaceHealthItem = {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "neutral";
  description: string;
};

export type WorkspaceActivityItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: "blue" | "green" | "amber" | "indigo" | "slate" | "analytics";
  href?: string;
};

export type WorkspaceMilestoneItem = {
  id: string;
  title: string;
  dateLabel: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "indigo" | "slate" | "analytics" | "danger";
  href?: string;
};

export type WorkspaceContactItem = {
  id: string;
  label: string;
  value: string;
  role?: string;
  href?: string;
};

export type WorkspaceQuickAction = {
  id: string;
  label: string;
  disabled?: boolean;
  title?: string;
  href?: string;
};
