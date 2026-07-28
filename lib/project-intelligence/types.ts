export const PROJECT_EVENT_TYPES = [
  "project_created",
  "project_updated",
  "customer_created",
  "customer_message",
  "estimate_created",
  "estimate_sent",
  "estimate_approved",
  "estimate_rejected",
  "contract_signed",
  "permit_submitted",
  "permit_approved",
  "permit_rejected",
  "inspection_scheduled",
  "inspection_passed",
  "inspection_failed",
  "task_created",
  "task_started",
  "task_completed",
  "task_delayed",
  "phase_started",
  "phase_completed",
  "employee_assigned",
  "employee_unassigned",
  "employee_clocked_in",
  "employee_clocked_out",
  "daily_report_created",
  "issue_created",
  "issue_resolved",
  "safety_incident",
  "material_ordered",
  "material_delivered",
  "material_delayed",
  "equipment_assigned",
  "site_photo_uploaded",
  "document_uploaded",
  "change_order_created",
  "change_order_approved",
  "change_order_rejected",
  "invoice_created",
  "invoice_sent",
  "invoice_paid",
  "invoice_overdue",
  "payment_received",
  "budget_updated",
  "schedule_updated",
  "note_added",
  "ai_insight_generated",
  "ai_action_recommended",
  "ai_action_completed",
] as const;

export type ProjectEventType = (typeof PROJECT_EVENT_TYPES)[number];

export const PROJECT_EVENT_CATEGORIES = [
  "project",
  "customer",
  "estimate",
  "contract",
  "permit",
  "schedule",
  "task",
  "employee",
  "daily_report",
  "inspection",
  "safety",
  "material",
  "equipment",
  "sitecam",
  "document",
  "change_order",
  "invoice",
  "payment",
  "budget",
  "ai",
] as const;

export type ProjectEventCategory = (typeof PROJECT_EVENT_CATEGORIES)[number];

export const PROJECT_EVENT_PRIORITIES = ["low", "normal", "high", "critical"] as const;
export type ProjectEventPriority = (typeof PROJECT_EVENT_PRIORITIES)[number];

export const PROJECT_EVENT_STATUSES = ["open", "in_progress", "resolved", "completed", "dismissed"] as const;
export type ProjectEventStatus = (typeof PROJECT_EVENT_STATUSES)[number];

export const PROJECT_EVENT_SOURCES = ["system", "manual", "integration", "sitecam", "ai"] as const;
export type ProjectEventSource = (typeof PROJECT_EVENT_SOURCES)[number];

export const PROJECT_EVENT_IMPACT_AREAS = [
  "none",
  "financial",
  "schedule",
  "safety",
  "customer",
  "documentation",
] as const;

export type ProjectEventImpactArea = (typeof PROJECT_EVENT_IMPACT_AREAS)[number];

export type ProjectEventActorType = "employee" | "customer" | "system" | "ai" | "vendor";

export type ProjectRelatedEntityType =
  | "project"
  | "customer"
  | "estimate"
  | "contract"
  | "permit"
  | "task"
  | "phase"
  | "inspection"
  | "daily_report"
  | "issue"
  | "material_order"
  | "site_photo"
  | "document"
  | "change_order"
  | "invoice"
  | "payment"
  | "note";

export type ProjectAttachmentType =
  | "photo"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "video"
  | "other";

export type EventMetadataValue =
  | string
  | number
  | boolean
  | null
  | EventMetadataValue[]
  | { [key: string]: EventMetadataValue };

export type ProjectEventActor = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  type: ProjectEventActorType;
};

export type ProjectRelatedEntity = {
  id: string;
  type: ProjectRelatedEntityType;
  label: string;
  href: string | null;
};

export type ProjectEventAttachment = {
  id: string;
  name: string;
  type: ProjectAttachmentType;
  url: string;
  thumbnailUrl: string | null;
};

export type ProjectFinancialImpact = {
  amount: number;
  currency: string;
  direction: "increase" | "decrease";
  budgetCategory: string;
  changeOrderId: string | null;
  invoiceId: string | null;
};

export type ProjectScheduleImpact = {
  delayDays: number;
  recoveredDays: number;
  affectedPhase: string | null;
  affectedTaskId: string | null;
  reason: string;
};

export type ProjectAIContext = {
  summary: string;
  keywords: string[];
  riskSignals: string[];
  confidence: number;
  requiresAttention: boolean;
};

export type ProjectAIExplanation = {
  summary?: string;
  factors?: string[];
  recommendedAction?: string;
};

export type ProjectEvent = {
  id: string;
  projectId: string;
  eventType: ProjectEventType;
  category: ProjectEventCategory;
  title: string;
  description: string;
  occurredAt: string;
  createdAt: string;
  actor: ProjectEventActor;
  source: ProjectEventSource;
  priority: ProjectEventPriority;
  status: ProjectEventStatus;
  impactAreas: ProjectEventImpactArea[];
  metadata: Record<string, EventMetadataValue>;
  relatedEntity: ProjectRelatedEntity | null;
  attachments: ProjectEventAttachment[];
  financialImpact: ProjectFinancialImpact | null;
  scheduleImpact: ProjectScheduleImpact | null;
  aiContext: ProjectAIContext | null;
  aiExplanation?: ProjectAIExplanation;
};

export type ProjectTimelineDateRange = "today" | "last_7_days" | "last_30_days" | "custom" | "all_time";

export type ProjectTimelineFilters = {
  category: ProjectEventCategory | "all";
  priority: ProjectEventPriority | "all";
  impact: ProjectEventImpactArea | "all";
  dateRange: ProjectTimelineDateRange;
};

export type ProjectTimelineSummary = {
  totalEvents: number;
  openRisks: number;
  financialImpactTotal: number;
  scheduleDelayDays: number;
  scheduleRecoveredDays: number;
  lastDailyReportAt: string | null;
  lastSiteCamUploadAt: string | null;
  latestCustomerActivityAt: string | null;
  latestInspectionResult: "passed" | "failed" | "scheduled" | "none";
  latestActivityAt: string | null;
  firstActivityAt: string | null;
};

export type ProjectTimelineRiskItem = {
  id: string;
  severity: ProjectEventPriority;
  message: string;
  sourceEventId: string;
  occurredAt: string;
  sourceLabel: string;
  recommendedAction: string;
  href: string | null;
};

export type ProjectTimelineDateGroup = {
  key: string;
  label: string;
  events: ProjectEvent[];
};

export type NewManualProjectNoteInput = {
  title: string;
  note: string;
  category: ProjectEventCategory;
  priority: ProjectEventPriority;
  occurredAt: string;
  relatedEntity: ProjectRelatedEntity | null;
};
