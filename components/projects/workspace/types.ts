import type { ReactNode } from "react";

export type ProjectWorkspaceTabKey =
  | "overview"
  | "tasks"
  | "daily_logs"
  | "photos"
  | "measure"
  | "blueprints"
  | "documents"
  | "subcontractors"
  | "crew"
  | "financials"
  | "change_orders"
  | "rfis"
  | "submittals"
  | "inspections"
  | "activity";

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

export type WorkspaceProjectHealth = {
  schedule: WorkspaceHealthItem;
  budget: WorkspaceHealthItem;
  field: WorkspaceHealthItem;
  safety: WorkspaceHealthItem;
};

export type ProjectExecutionTaskStatus = "not_started" | "in_progress" | "blocked" | "completed";
export type ProjectExecutionTask = { id: string; title: string; kind: "task" | "milestone"; status: ProjectExecutionTaskStatus; priority: string; assigneeLabel: string; dueDate: string | null; completedAt: string | null; dependencyIds: string[] };
export type ProjectExecutionIssue = { id: string; title: string; status: "open" | "blocked" | "resolved"; priority: string; ownerLabel: string; createdAt: string };
export type ProjectExecutionNote = { id: string; body: string; category: "general" | "field" | "office" | "private"; authorLabel: string; createdAt: string };
export type ProjectExecutionCalendarEvent = { id: string; title: string; date: string; type: "task" | "milestone" | "inspection" | "crew" };
