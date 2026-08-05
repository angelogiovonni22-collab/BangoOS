import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrionEventRecord } from "@/lib/orion/events";
import type { OrionCommandConfirmationLevel, OrionCommandPermission } from "@/lib/orion/commands";
import type { Database } from "@/types/database.types";

export const ORION_DECISION_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type OrionDecisionPriority = (typeof ORION_DECISION_PRIORITIES)[number];

export const ORION_DECISION_CATEGORIES = [
  "estimates",
  "customers",
  "projects",
  "finance",
  "workforce",
  "operations",
] as const;
export type OrionDecisionCategory = (typeof ORION_DECISION_CATEGORIES)[number];

export const ORION_DECISION_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type OrionDecisionSeverity = (typeof ORION_DECISION_SEVERITIES)[number];

export const ORION_DECISION_STATUSES = ["new", "acknowledged", "resolved", "dismissed"] as const;
export type OrionDecisionStatus = (typeof ORION_DECISION_STATUSES)[number];

export type OrionDecisionEntityType =
  | "estimate"
  | "customer"
  | "project"
  | "invoice"
  | "crew"
  | "employee"
  | "schedule"
  | "company";

export type OrionDecisionEntityRef = {
  type: OrionDecisionEntityType;
  id: string | null;
  href: string;
};

export type OrionDecisionRecord = {
  decisionId: string;
  companyId: string;
  ruleId: string;
  priority: OrionDecisionPriority;
  category: OrionDecisionCategory;
  severity: OrionDecisionSeverity;
  title: string;
  summary: string;
  recommendation: string;
  relatedEntity: OrionDecisionEntityRef;
  relatedEventId: string | null;
  detectedAt: string;
  status: OrionDecisionStatus;
  acknowledged: boolean;
  resolved: boolean;
  dismissed: boolean;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  dismissedAt: string | null;
  actionLabel: string;
  actionHref: string;
  commandKey: string;
  commandInput: Record<string, unknown>;
  confirmationLevel: OrionCommandConfirmationLevel;
  hrefFallback: string;
  permissionRequirement: OrionCommandPermission[];
  unsupportedReason: string | null;
};

export type OrionDecisionCandidate = Omit<OrionDecisionRecord, "status" | "acknowledged" | "resolved" | "dismissed" | "acknowledgedAt" | "resolvedAt" | "dismissedAt">;

export type OrionDecisionRuleContext = {
  companyId: string;
  detectedAt: string;
  now: Date;
  eventHistory: OrionEventRecord[];
};

export type OrionDecisionRule = {
  id: string;
  enabled: boolean;
  category: OrionDecisionCategory;
  evaluate: (context: OrionDecisionContext) => Promise<OrionDecisionCandidate[]>;
};

export type OrionDecisionHealthRating = "Excellent" | "Good" | "Attention" | "Critical";

export type OrionDecisionHealthItem = {
  id: "sales" | "operations" | "financial" | "scheduling" | "customer" | "overall";
  score: number;
  rating: OrionDecisionHealthRating;
};

export type OrionDecisionEngineResult = {
  companyId: string;
  detectedAt: string;
  decisions: OrionDecisionRecord[];
  topPriorities: OrionDecisionRecord[];
  criticalAlerts: OrionDecisionRecord[];
  todaysDecisions: OrionDecisionRecord[];
  recommendations: OrionDecisionRecord[];
  riskSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  businessHealth: OrionDecisionHealthItem[];
  morningBriefing: {
    greeting: string;
    lines: string[];
  };
};

export type OrionDecisionEventType =
  | "decision.created"
  | "decision.acknowledged"
  | "decision.resolved"
  | "decision.dismissed";

export type OrionDecisionContext = {
  supabase: SupabaseClient<Database>;
  companyId: string;
  now: () => Date;
  load: {
    estimates: () => Promise<Array<{
      id: string;
      company_id: string;
      customer_id: string | null;
      title: string;
      estimate_number: string | null;
      status: string;
      total_amount: number;
      expiration_date: string | null;
      created_at: string;
      viewed_at?: string | null;
      sent_at?: string | null;
      followup_due_at?: string | null;
      agreement_version_id?: string | null;
      deposit_invoice_id?: string | null;
    }>>;
    customers: () => Promise<Array<{
      id: string;
      company_id: string;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>>;
    projects: () => Promise<Array<{
      id: string;
      company_id: string;
      name: string;
      status: string;
      estimated_end_date: string | null;
      created_at: string;
      customer_id: string | null;
      description: string | null;
    }>>;
    tasks: () => Promise<Array<{
      id: string;
      project_id: string;
      company_id: string;
      status: string;
      assigned_profile_id: string | null;
      planned_finish: string | null;
      planned_start: string | null;
      estimated_completion_date: string | null;
    }>>;
    crews: () => Promise<Array<{
      id: string;
      company_id: string;
      name: string;
      status: string;
      supervisor_profile_id: string | null;
    }>>;
    crewMemberships: () => Promise<Array<{
      id: string;
      company_id: string;
      crew_id: string;
      employee_id: string;
      status: string;
      starts_on: string;
      ends_on: string | null;
    }>>;
    employees: () => Promise<Array<{
      id: string;
      company_id: string;
      primary_crew_id: string | null;
      supervisor_profile_id: string | null;
      employment_status: string;
      availability_status: string;
      updated_at: string;
    }>>;
    invoices: () => Promise<Array<{
      id: string;
      company_id: string;
      customer_id: string | null;
      project_id: string | null;
      estimate_id: string | null;
      status: string;
      total_amount: number;
      amount_paid: number;
      due_date: string | null;
      created_at: string;
    }>>;
    inspections: () => Promise<Array<{
      id: string;
      company_id: string;
      project_id: string;
      inspection_type: string;
      status: string;
      scheduled_at: string | null;
      reinspection_required: boolean;
      reinspection_date: string | null;
      updated_at: string;
    }>>;
    permits: () => Promise<Array<{
      id: string;
      company_id: string;
      project_id: string;
      permit_type: string;
      status: string;
      submitted_at: string | null;
      expiration_date: string | null;
      rejection_reason: string | null;
      updated_at: string;
    }>>;
    closeouts: () => Promise<Array<{
      id: string;
      company_id: string;
      project_id: string;
      status: string;
      handover_status: string;
      final_payment_recorded: boolean;
      customer_approval_recorded: boolean;
      required_documents_completed: boolean;
      permit_closure_completed: boolean;
      crew_removal_completed: boolean;
      equipment_return_completed: boolean;
      completion_blockers: unknown;
      updated_at: string;
    }>>;
    punchItems: () => Promise<Array<{
      id: string;
      company_id: string;
      project_id: string;
      status: string;
      due_date: string | null;
      updated_at: string;
    }>>;
    workflowEvents: (eventTypes?: string[], limit?: number) => Promise<Array<{
      id: string;
      company_id: string;
      event_type: string;
      reference_entity: string;
      reference_id: string;
      occurred_at: string;
      payload: Record<string, unknown>;
      actor_profile_id: string | null;
    }>>;
  };
};
