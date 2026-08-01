import type { ProjectWorkspaceTabKey } from "./types";

export const PROJECT_WORKSPACE_TABS: Array<{ key: ProjectWorkspaceTabKey; labelKey: string }> = [
  { key: "overview", labelKey: "projects.workspaceTabOverview" },
  { key: "work", labelKey: "projects.workspaceTabWork" },
  { key: "financial", labelKey: "projects.workspaceTabFinancial" },
  { key: "resources", labelKey: "projects.workspaceTabResources" },
  { key: "documents", labelKey: "projects.workspaceTabDocuments" },
  { key: "timeline", labelKey: "projects.workspaceTabTimeline" },
];
