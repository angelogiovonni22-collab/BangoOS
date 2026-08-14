import type { BangoAIRequestType } from "../types";

export const BANGO_ROLE_IDS = [
  "superintendent",
  "estimator",
  "scheduler",
  "safety_manager",
  "financial_advisor",
  "purchasing_assistant",
  "hr_assistant",
  "document_intelligence",
] as const;

export type BangoRoleId = (typeof BANGO_ROLE_IDS)[number];

export const BANGO_CAPABILITY_IDS = [
  "read_project",
  "read_tasks",
  "read_schedule",
  "read_financials",
  "read_employees",
  "read_documents",
  "read_safety_records",
  "read_purchasing",
  "read_customers",
  "recommend_task_priority",
  "recommend_schedule_change",
  "recommend_crew_assignment",
  "recommend_estimate_adjustment",
  "recommend_purchase",
  "recommend_collection_action",
  "recommend_safety_review",
  "draft_daily_report",
  "draft_customer_message",
  "draft_vendor_message",
  "draft_change_order",
  "draft_estimate_scope",
  "update_task",
  "update_schedule",
  "send_message",
  "approve_change_order",
  "create_purchase_order",
  "pay_invoice",
  "modify_payroll",
  "terminate_employee",
] as const;

export type BangoCapabilityId = (typeof BANGO_CAPABILITY_IDS)[number];

export const EXECUTION_CAPABILITIES: readonly BangoCapabilityId[] = [
  "update_task",
  "update_schedule",
  "send_message",
  "approve_change_order",
  "create_purchase_order",
  "pay_invoice",
  "modify_payroll",
  "terminate_employee",
] as const;

export const READ_CAPABILITIES: readonly BangoCapabilityId[] = [
  "read_project",
  "read_tasks",
  "read_schedule",
  "read_financials",
  "read_employees",
  "read_documents",
  "read_safety_records",
  "read_purchasing",
  "read_customers",
] as const;

export type ApprovalLevel =
  | "none_required"
  | "user_confirmation"
  | "manager_approval"
  | "owner_approval"
  | "qualified_professional_approval"
  | "prohibited";

export type RiskClassification =
  | "low"
  | "moderate"
  | "high"
  | "critical";

export type ContextScopeKey = "company" | "project" | "customer" | "phase" | "task";

export type BangoRoleRequestType =
  | BangoAIRequestType
  | "estimate_scope_review"
  | "schedule_optimization"
  | "safety_compliance_review"
  | "financial_health_review"
  | "purchasing_recommendation"
  | "hr_workforce_review"
  | "document_analysis";

export type RoleGroundingRequirements = {
  requireDeterministicBriefing: boolean;
  requireDeterministicIntelligence: boolean;
  requiredEvidenceSourceTypes: readonly BangoEvidenceSourceType[];
  minimumEvidenceCount: number;
};

export type RoleApprovalPolicy = {
  defaultLevel: ApprovalLevel;
  capabilityOverrides: Partial<Record<BangoCapabilityId, ApprovalLevel>>;
};

export type BangoRoleDefinition = {
  roleId: BangoRoleId;
  displayNameKey: string;
  descriptionKey: string;
  version: string;
  enabled: boolean;
  supportedRequestTypes: readonly BangoRoleRequestType[];
  requiredContextScopes: readonly ContextScopeKey[];
  requiredFutureContextScopes: readonly ContextScopeKey[];
  allowedCapabilities: readonly BangoCapabilityId[];
  deniedCapabilities: readonly BangoCapabilityId[];
  approvalPolicy: RoleApprovalPolicy;
  riskClassification: RiskClassification;
  groundingRequirements: RoleGroundingRequirements;
};

export type BangoBusinessRequestContext = {
  requestId: string;
  requestType: BangoRoleRequestType;
  locale: string;
  timestamp: string;
};

export type BangoIdentityMembership = {
  membershipId: string;
  companyId: string;
  role: string;
  status: string;
  isPrimary: boolean;
};

export type BangoIdentityContext = {
  userId: string;
  companyId: string;
  profileId: string;
  displayName: string | null;
  companyRole: string | null;
  memberships: BangoIdentityMembership[];
};

export type BangoScopeContext = {
  companyId: string;
  projectId: string | null;
  customerId: string | null;
  phaseId: string | null;
  taskId: string | null;
};

export type BangoCompanyContext = {
  id: string;
  name: string;
  timezone: string | null;
  defaultTaxRate: number | null;
};

export type DeterministicIntelligenceSummary = {
  healthScore: number | null;
  healthStatus: string;
  completionPercent: number;
  activeTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  activePhasesCount: number;
  tasksDueToday: number;
  tasksDueThisWeek: number;
  daysUntilDue: number | null;
  photosCount: number;
  documentationPresent: boolean;
  assignedWorkers: number;
  unassignedTaskCount: number;
  contractAmount: number | null;
  invoicePaid: number;
  invoiceTotal: number;
  budgetVariance: number | null;
  overdueInvoices: number;
  estimatesCount: number;
  changeOrdersCount: number;
  highestRiskSeverity: string | null;
  riskCount: number;
  risks: Array<{
    id: string;
    severity: string;
    message: string;
  }>;
};

export type DeterministicBriefingSnapshot = {
  state: string;
  briefingDate: string;
  generatedAt: string;
  executiveSummaryKey: string;
  focusCount: number;
  riskCount: number;
  actionCount: number;
};

export type BangoProjectContext = {
  id: string;
  name: string;
  status: string;
  customerId: string | null;
  projectNumber: string | null;
  intelligence: DeterministicIntelligenceSummary;
  briefing: DeterministicBriefingSnapshot;
};

export type BangoPermissionsContext = {
  allowedCapabilities: BangoCapabilityId[];
  deniedCapabilities: BangoCapabilityId[];
  approvalRequirements: Partial<Record<BangoCapabilityId, ApprovalLevel>>;
};

export type BangoEvidenceSourceType =
  | "project"
  | "task"
  | "phase"
  | "risk"
  | "invoice"
  | "estimate"
  | "change_order"
  | "project_photo"
  | "employee"
  | "document"
  | "generated_intelligence";

export type BangoEvidenceSensitivity =
  | "low"
  | "internal"
  | "sensitive"
  | "restricted";

export type BangoEvidence = {
  id: string;
  sourceType: BangoEvidenceSourceType;
  sourceId: string;
  companyId: string;
  projectId: string | null;
  label: string;
  value: string | number | boolean | null;
  timestamp: string | null;
  route: string | null;
  sensitivity: BangoEvidenceSensitivity;
};

export type BangoBusinessContext = {
  request: BangoBusinessRequestContext;
  identity: BangoIdentityContext;
  scope: BangoScopeContext;
  company: BangoCompanyContext;
  project: BangoProjectContext | null;
  permissions: BangoPermissionsContext;
  evidence: BangoEvidence[];
  limitations: string[];
};

export type BangoCoreRequest = {
  roleId: BangoRoleId;
  requestType: BangoRoleRequestType;
  locale: string;
  projectId?: string;
  customerId?: string;
  phaseId?: string;
  taskId?: string;
};

export type BangoMemoryScope = "user" | "project" | "customer" | "company";

export type BangoMemoryCategory =
  | "preference"
  | "decision"
  | "recommendation"
  | "outcome"
  | "lesson"
  | "conversation_summary"
  | "operational_pattern";

export type BangoMemoryImportance = "low" | "normal" | "high" | "critical";

export type BangoMemoryRecord = {
  id: string;
  scope: BangoMemoryScope;
  scopeId: string;
  companyId: string;
  category: BangoMemoryCategory;
  importance: BangoMemoryImportance;
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type MemoryRetrievalQuery = {
  companyId: string;
  scope?: BangoMemoryScope;
  scopeId?: string;
  categories?: BangoMemoryCategory[];
  minImportance?: BangoMemoryImportance;
  limit?: number;
};

export interface MemoryProvider {
  findRecords(query: MemoryRetrievalQuery): Promise<BangoMemoryRecord[]>;
  saveRecord(record: BangoMemoryRecord): Promise<void>;
}
