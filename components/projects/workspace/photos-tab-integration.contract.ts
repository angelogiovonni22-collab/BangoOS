export const PROJECT_PHOTOS_TAB_INTEGRATION = {
  tabKey: "photos",
  workspaceComponent: "SiteCamWorkspace",
  requiredProps: ["companyId", "projectId", "projectName", "userId", "locale", "profilesById"] as const,
} as const;
