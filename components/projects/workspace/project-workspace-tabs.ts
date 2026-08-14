import type { ProjectWorkspaceTabKey } from "./types";

export const PROJECT_WORKSPACE_TABS: Array<{ key: ProjectWorkspaceTabKey; labelKey: string }> = [
  { key: "overview", labelKey: "projects.workspaceTabOverview" },
  { key: "tasks", labelKey: "projects.workspaceTabTasks" },
  { key: "daily_logs", labelKey: "projects.workspaceTabDailyLogs" },
  { key: "photos", labelKey: "projects.workspaceTabPhotos" },
  { key: "blueprints", labelKey: "projects.workspaceTabBlueprints" },
  { key: "documents", labelKey: "projects.workspaceTabDocuments" },
  { key: "subcontractors", labelKey: "projects.workspaceTabSubcontractors" },
  { key: "crew", labelKey: "projects.workspaceTabCrew" },
  { key: "financials", labelKey: "projects.workspaceTabFinancials" },
  { key: "change_orders", labelKey: "projects.workspaceTabChangeOrders" },
  { key: "rfis", labelKey: "projects.workspaceTabRfis" },
  { key: "submittals", labelKey: "projects.workspaceTabSubmittals" },
  { key: "inspections", labelKey: "projects.workspaceTabInspections" },
  { key: "activity", labelKey: "projects.workspaceTabActivity" },
];
