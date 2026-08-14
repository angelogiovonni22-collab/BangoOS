import type { OrionCommandConfirmationLevel, OrionCommandPermission } from "@/lib/orion/commands";

export type OrionIntentKind =
  | "navigation"
  | "search"
  | "open"
  | "create"
  | "start"
  | "pause"
  | "update"
  | "assign"
  | "complete"
  | "archive"
  | "send"
  | "view"
  | "record_payment"
  | "record_deposit"
  | "generate_invoice"
  | "generate_estimate"
  | "convert_estimate"
  | "inspection_schedule"
  | "inspection_pass"
  | "inspection_fail"
  | "inspection_reinspection"
  | "permit_submit"
  | "permit_approve"
  | "permit_issue"
  | "permit_reject"
  | "customer_update_log"
  | "show_timeline"
  | "show_dashboard"
  | "show_priorities";

export type OrionIntentEntityType =
  | "workflow"
  | "customer"
  | "project"
  | "estimate"
  | "invoice"
  | "employee"
  | "crew"
  | "task"
  | "inspection"
  | "permit"
  | "communication"
  | "document"
  | "timeline"
  | "dashboard"
  | "settings"
  | "operations";

export type OrionIntentCandidate = {
  entityType: OrionIntentEntityType;
  entityId: string;
  label: string;
  subtitle: string;
  score: number;
};

export type OrionIntentCommandPreview = {
  commandId: string;
  target: string;
  permission: OrionCommandPermission[];
  confirmationLevel: OrionCommandConfirmationLevel;
  expectedOutcome: string;
  eventsThatWillPublish: string[];
};

export type OrionIntentSuggestedCommand = {
  commandId: string;
  params: Record<string, unknown>;
  entityType: OrionIntentEntityType | null;
  entityId: string | null;
};

export type OrionIntentResult = {
  resolvedIntent: OrionIntentKind | null;
  resolvedEntity: {
    entityType: OrionIntentEntityType;
    entityId: string;
    label: string;
  } | null;
  confidence: number;
  candidates: OrionIntentCandidate[];
  suggestedCommand: OrionIntentSuggestedCommand | null;
  commandPreview: OrionIntentCommandPreview | null;
  requiresClarification: boolean;
  message: string;
};

export type OrionIntentRouteContext = {
  pathname: string;
  projectId: string | null;
  customerId: string | null;
  estimateId: string | null;
  invoiceId: string | null;
  employeeId: string | null;
  crewId: string | null;
  dashboardWidgetId: string | null;
  timelineItemId: string | null;
};

export type OrionIntentInput = {
  input: string;
  route: OrionIntentRouteContext;
  selectedCandidateId?: string | null;
  pinnedCommandIds?: string[];
  recentCommandIds?: string[];
};

export type OrionIntentEntityRecord = {
  entityType: OrionIntentEntityType;
  entityId: string;
  label: string;
  subtitle: string;
  terms: string[];
  projectId?: string | null;
  customerId?: string | null;
};
