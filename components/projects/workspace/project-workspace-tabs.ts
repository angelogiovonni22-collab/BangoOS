import type { ProjectWorkspaceTabKey } from "./types";

export const PROJECT_WORKSPACE_TABS: Array<{ key: ProjectWorkspaceTabKey; labelKey: string }> = [
  { key: "overview", labelKey: "projects.workspaceTabOverview" },
  { key: "daily_reports", labelKey: "projects.workspaceTabDailyReports" },
  { key: "scheduling", labelKey: "projects.workspaceTabScheduling" },
  { key: "crew", labelKey: "projects.workspaceTabCrew" },
  { key: "equipment", labelKey: "projects.workspaceTabEquipment" },
  { key: "safety", labelKey: "projects.workspaceTabSafety" },
  { key: "plans", labelKey: "projects.workspaceTabPlans" },
  { key: "financials", labelKey: "projects.workspaceTabFinancials" },
  { key: "ai_insights", labelKey: "projects.workspaceTabAiInsights" },
];
