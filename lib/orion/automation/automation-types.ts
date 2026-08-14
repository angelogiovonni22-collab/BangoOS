import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrionEventRecord } from "@/lib/orion/events";
import type { Database } from "@/types/database.types";

export const ORION_AUTOMATION_TRIGGER_EVENTS = [
  "estimate.created",
  "estimate.sent",
  "estimate.viewed",
  "estimate.approved",
  "estimate.declined",
  "customer.created",
  "project.created",
  "invoice.created",
  "invoice.paid",
  "deposit.received",
  "crew.assigned",
  "task.completed",
  "daily_report.created",
] as const;

export type OrionAutomationTriggerEvent = (typeof ORION_AUTOMATION_TRIGGER_EVENTS)[number];

export type OrionAutomationStepStatus = "completed" | "skipped";

export type OrionAutomationStepResult = {
  status: OrionAutomationStepStatus;
  details?: string;
  output?: Record<string, unknown>;
};

export type OrionAutomationRunState = {
  estimateId: string | null;
  projectId: string | null;
  depositInvoiceId: string | null;
  agreementVersionId: string | null;
  portalEnabled: boolean;
};

export type OrionAutomationExecutionContext = {
  supabase: SupabaseClient<Database>;
  now: () => Date;
  state: OrionAutomationRunState;
  config: {
    followupDays: number;
  };
};

export type OrionAutomationConditionContext = {
  event: OrionEventRecord;
  companyId: string;
  context: OrionAutomationExecutionContext;
};

export type OrionAutomationCondition = {
  id: string;
  description: string;
  evaluate: (context: OrionAutomationConditionContext) => Promise<boolean>;
};

export type OrionAutomationActionContext = {
  event: OrionEventRecord;
  companyId: string;
  runId: string;
  stepIndex: number;
  context: OrionAutomationExecutionContext;
};

export type OrionAutomationAction = {
  id: string;
  description: string;
  execute: (context: OrionAutomationActionContext) => Promise<OrionAutomationStepResult>;
};

export type OrionAutomationRule = {
  id: string;
  companyId: string | "*";
  enabled: boolean;
  triggerEvent: OrionAutomationTriggerEvent;
  conditions: OrionAutomationCondition[];
  actions: OrionAutomationAction[];
  priority: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OrionAutomationStepHistory = {
  ruleId: string;
  stepId: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  success: boolean;
  failureMessage: string | null;
  retryCount: number;
  relatedEventId: string;
};

export type OrionAutomationRunResult = {
  ruleId: string;
  runId: string;
  triggeredByEventId: string;
  status: "completed" | "failed" | "skipped";
  steps: OrionAutomationStepHistory[];
  failureMessage: string | null;
};
