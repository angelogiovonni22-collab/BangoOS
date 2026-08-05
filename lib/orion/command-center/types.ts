import type { OrionCommandConfirmationLevel, OrionCommandCoverage, OrionCommandPermission } from "@/lib/orion/commands";

export type OrionCommandCenterGroup =
  | "navigation"
  | "projects"
  | "customers"
  | "estimates"
  | "invoices"
  | "finance"
  | "employees"
  | "crews"
  | "scheduling"
  | "reports"
  | "settings";

export type OrionWorkspaceEntityRef = {
  id: string;
  label: string;
};

export type OrionWorkspaceContext = {
  currentPage: string;
  currentRoute: string;
  currentProject: OrionWorkspaceEntityRef | null;
  currentCustomer: OrionWorkspaceEntityRef | null;
  currentEstimate: OrionWorkspaceEntityRef | null;
  currentInvoice: OrionWorkspaceEntityRef | null;
  currentEmployee: OrionWorkspaceEntityRef | null;
  currentCrew: OrionWorkspaceEntityRef | null;
  currentDashboardWidget: string | null;
  currentTimelineItem: string | null;
  currentCompany: OrionWorkspaceEntityRef;
  currentAuthenticatedUser: OrionWorkspaceEntityRef;
  focusArea: "project" | "estimate" | "customer" | "dashboard" | "invoice" | "employee" | "crew" | "general";
};

export type OrionCommandPreview = {
  target: string;
  permission: OrionCommandPermission[];
  confirmationLevel: OrionCommandConfirmationLevel;
  expectedOutcome: string;
  eventsThatWillPublish: string[];
};

export type OrionRelatedRecordItem = {
  id: string;
  label: string;
  href: string | null;
  subtitle: string;
};

export type OrionCustomerRelatedRecords = {
  projects: OrionRelatedRecordItem[];
  estimates: OrionRelatedRecordItem[];
  invoices: OrionRelatedRecordItem[];
  documents: OrionRelatedRecordItem[];
  timeline: OrionRelatedRecordItem[];
  photos: OrionRelatedRecordItem[];
  tasks: OrionRelatedRecordItem[];
  crews: OrionRelatedRecordItem[];
};

export type OrionCommandCenterAction = {
  id: string;
  label: string;
  subtitle: string;
  group: OrionCommandCenterGroup;
  commandId: string;
  params: Record<string, unknown>;
  entityType: string | null;
  entityId: string | null;
  hrefPreview: string | null;
  keywords: string[];
  contextTags: string[];
  requiredPermissions: OrionCommandPermission[];
  confirmationLevel: OrionCommandConfirmationLevel;
  coverage: OrionCommandCoverage;
  preview: OrionCommandPreview;
};

export type OrionCommandCenterCommand = {
  id: string;
  name: string;
  description: string;
  requiredPermissions: OrionCommandPermission[];
  confirmationLevel: OrionCommandConfirmationLevel;
  coverage: OrionCommandCoverage;
};

export type OrionCommandCenterCatalog = {
  generatedAt: string;
  role: OrionCommandPermission;
  context: OrionWorkspaceContext;
  commands: OrionCommandCenterCommand[];
  actions: OrionCommandCenterAction[];
  suggestedActionIds: string[];
  recentTimeline: OrionRelatedRecordItem[];
};
