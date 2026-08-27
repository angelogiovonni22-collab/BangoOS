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

export type WorkspaceSummaryCardItem = { label: string; value: string; context: string; icon: ReactNode; tone: "blue" | "green" | "amber" | "indigo" | "slate" | "analytics" };
export type WorkspaceHealthItem = { label: string; value: string; tone: "success" | "warning" | "danger" | "neutral"; description: string };
export type WorkspaceActivityItem = { id: string; title: string; detail: string; timestamp: string; tone: "blue" | "green" | "amber" | "indigo" | "slate" | "analytics"; href?: string };
export type WorkspaceMilestoneItem = { id: string; title: string; dateLabel: string; detail: string; tone: "blue" | "green" | "amber" | "indigo" | "slate" | "analytics" | "danger"; href?: string };
export type WorkspaceContactItem = { id: string; label: string; value: string; role?: string; href?: string };
export type WorkspaceQuickAction = { id: string; label: string; disabled?: boolean; title?: string; href?: string };
export type ProjectExecutionTaskStatus = "not_started" | "in_progress" | "waiting" | "blocked" | "completed";
export type ProjectExecutionTaskKind = "task" | "milestone" | "deliverable";
export type ProjectExecutionTask = { id: string; kind: ProjectExecutionTaskKind; title: string; description: string; priority: string; status: ProjectExecutionTaskStatus; dueDate: string | null; assigneeId: string | null; assigneeLabel: string; completedAt: string | null; dependencyIds: string[] };
export type ProjectExecutionNoteCategory = "general" | "field" | "office" | "private";
export type ProjectExecutionNote = { id: string; category: ProjectExecutionNoteCategory; body: string; createdAt: string; createdByLabel: string };
export type ProjectExecutionIssueStatus = "open" | "resolved" | "blocked";
export type ProjectExecutionIssue = { id: string; title: string; status: ProjectExecutionIssueStatus; priority: string; ownerId: string | null; ownerLabel: string; dueDate: string | null; source: "punch_item" | "task" };
export type ProjectExecutionCalendarEventType = "task" | "delivery" | "inspection" | "crew_assignment" | "milestone";
export type ProjectExecutionCalendarEvent = { id: string; type: ProjectExecutionCalendarEventType; title: string; date: string; href?: string };
