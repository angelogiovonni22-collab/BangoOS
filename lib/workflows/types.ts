export type DeterministicWorkflowEventType =
  | "estimate.created"
  | "estimate.sent"
  | "estimate.viewed"
  | "estimate.followup_due"
  | "estimate.approved"
  | "estimate.declined"
  | "estimate.request_changes"
  | "estimate.converted"
  | "deposit.created"
  | "deposit.received"
  | "project.created"
  | "project.ready_for_scheduling";

export type WorkflowName =
  | "estimate_lifecycle"
  | "project_lifecycle"
  | "invoice_lifecycle"
  | "scheduling_lifecycle"
  | "daily_reports_lifecycle"
  | "change_orders_lifecycle"
  | "warranty_lifecycle"
  | "deposit_lifecycle";

export type WorkflowTransitionInput = {
  companyId: string;
  workflowName: WorkflowName;
  eventType: DeterministicWorkflowEventType;
  currentState: string | null;
  nextState: string | null;
  actorProfileId: string | null;
  referenceEntity: string;
  referenceId: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export type WorkflowTransitionResult = {
  eventId: string;
};
