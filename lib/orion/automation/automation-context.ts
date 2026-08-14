import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseOrionEventPublisher, type OrionEventRecord } from "@/lib/orion/events";
import { createOrionCommandRouter } from "@/lib/orion/commands";
import type { Database } from "@/types/database.types";
import type {
  OrionAutomationActionContext,
  OrionAutomationExecutionContext,
  OrionAutomationStepResult,
} from "./automation-types";

type LooseSupabase = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

type EstimateAutomationRow = {
  id: string;
  company_id: string;
  customer_id: string | null;
  project_id: string | null;
  converted_project_id: string | null;
  deposit_invoice_id: string | null;
  agreement_version_id: string | null;
  title: string;
  description: string | null;
  status: string;
  deposit_type: string;
  deposit_value: number;
  total_amount: number;
  payment_terms: string | null;
  tax_rate: number;
  tax_amount: number;
  additional_fee: number;
  subtotal: number;
  customer_notes: string | null;
  internal_notes: string | null;
  scope_inclusions: string | null;
  scope_exclusions: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  prepared_by: string | null;
  followup_due_at: string | null;
};

type WorkflowLedgerRow = {
  id: string;
  company_id: string;
  actor_profile_id: string | null;
  event_type: string;
  reference_entity: string;
  reference_id: string;
  occurred_at: string;
  source_module: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  correlation_id: string | null;
  causation_id: string | null;
  idempotency_key: string | null;
};

export function createAutomationExecutionContext(supabase: SupabaseClient<Database>, options?: { followupDays?: number }): OrionAutomationExecutionContext {
  return {
    supabase,
    now: () => new Date(),
    state: {
      estimateId: null,
      projectId: null,
      depositInvoiceId: null,
      agreementVersionId: null,
      portalEnabled: false,
    },
    config: {
      followupDays: options?.followupDays && options.followupDays > 0 ? Math.floor(options.followupDays) : 3,
    },
  };
}

export async function loadLedgerEventById(supabase: SupabaseClient<Database>, eventId: string): Promise<OrionEventRecord | null> {
  const db = supabase as unknown as LooseSupabase;
  const { data, error } = await db
    .from("workflow_events" as never)
    .select("id, company_id, actor_profile_id, event_type, reference_entity, reference_id, occurred_at, source_module, payload, metadata, correlation_id, causation_id, idempotency_key")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load workflow event.");
  }

  const row = data as WorkflowLedgerRow | null;
  if (!row) {
    return null;
  }

  return {
    event_id: row.id,
    company_id: row.company_id,
    workspace_id: null,
    actor_profile_id: row.actor_profile_id,
    event_type: row.event_type as OrionEventRecord["event_type"],
    aggregate_type: row.reference_entity as OrionEventRecord["aggregate_type"],
    aggregate_id: row.reference_id,
    occurred_at: row.occurred_at,
    version: 1,
    source_module: (row.source_module || "workflows") as OrionEventRecord["source_module"],
    payload: row.payload || {},
    metadata: row.metadata || {},
    correlation_id: row.correlation_id,
    causation_id: row.causation_id,
    idempotency_key: row.idempotency_key,
  };
}

export async function loadEstimateForAutomation(context: OrionAutomationExecutionContext, companyId: string, estimateId: string): Promise<EstimateAutomationRow> {
  const db = context.supabase as unknown as LooseSupabase;
  const { data, error } = await db
    .from("estimates")
    .select("id, company_id, customer_id, project_id, converted_project_id, deposit_invoice_id, agreement_version_id, title, description, status, deposit_type, deposit_value, total_amount, payment_terms, tax_rate, tax_amount, additional_fee, subtotal, customer_notes, internal_notes, scope_inclusions, scope_exclusions, issue_date, expiration_date, prepared_by, followup_due_at")
    .eq("company_id", companyId)
    .eq("id", estimateId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load estimate for automation.");
  }

  if (!data) {
    throw new Error("Estimate not found for automation.");
  }

  return data as EstimateAutomationRow;
}

function normalizeDepositType(value: string) {
  const key = value.trim().toLowerCase();
  if (key === "percentage") {
    return "percentage";
  }

  if (key === "flat" || key === "fixed" || key === "custom") {
    return "fixed";
  }

  return "none";
}

function computeDepositAmount(row: EstimateAutomationRow) {
  const depositType = normalizeDepositType(row.deposit_type);
  const total = Math.max(0, Number(row.total_amount || 0));
  const value = Math.max(0, Number(row.deposit_value || 0));

  if (depositType === "percentage") {
    return Number(((total * value) / 100).toFixed(2));
  }

  if (depositType === "fixed") {
    return Number(Math.min(total, value).toFixed(2));
  }

  return 0;
}

export async function createProjectFromEstimateStep(input: OrionAutomationActionContext): Promise<OrionAutomationStepResult> {
  const estimateId = input.event.aggregate_id;
  const estimate = await loadEstimateForAutomation(input.context, input.companyId, estimateId);

  if (estimate.converted_project_id || estimate.project_id) {
    const projectId = estimate.converted_project_id || estimate.project_id;
    input.context.state.projectId = projectId;

    return {
      status: "completed",
      details: "Project already exists for estimate.",
      output: {
        project_id: projectId,
        idempotent: true,
      },
    };
  }

  const db = input.context.supabase as unknown as LooseSupabase;
  const { data, error } = await db.rpc("convert_estimate_to_project", {
    p_company_id: input.companyId,
    p_estimate_id: estimateId,
    p_actor_profile_id: input.event.actor_profile_id,
    p_idempotency_key: `${input.runId}:convert`,
    p_create_deposit_invoice: false,
  });

  if (error) {
    throw new Error(error.message || "Failed to convert estimate to project.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  const projectId = (row?.project_id as string | null) || null;

  if (!projectId) {
    throw new Error("Conversion did not return a project id.");
  }

  input.context.state.projectId = projectId;

  return {
    status: "completed",
    details: "Project created from approved estimate.",
    output: {
      conversion_id: (row?.conversion_id as string | null) || null,
      project_id: projectId,
      project_number: (row?.project_number as string | null) || null,
    },
  };
}

export async function bootstrapProjectWorkspaceStep(input: OrionAutomationActionContext): Promise<OrionAutomationStepResult> {
  const estimate = await loadEstimateForAutomation(input.context, input.companyId, input.event.aggregate_id);
  const projectId = input.context.state.projectId || estimate.converted_project_id || estimate.project_id;

  if (!projectId) {
    throw new Error("No project id available for workspace bootstrap.");
  }

  const db = input.context.supabase as unknown as LooseSupabase;
  const existingPhasesResponse = await db
    .from("project_phases")
    .select("id", { count: "exact", head: true })
    .eq("company_id", input.companyId)
    .eq("project_id", projectId);

  if (existingPhasesResponse.error) {
    throw new Error(existingPhasesResponse.error.message || "Unable to inspect existing project phases.");
  }

  const existingPhaseCount = existingPhasesResponse.count || 0;
  if (existingPhaseCount > 0) {
    return {
      status: "completed",
      details: "Project workspace phases already exist.",
      output: {
        project_id: projectId,
        seeded_phases: existingPhaseCount,
        idempotent: true,
      },
    };
  }

  const sectionsResponse = await db
    .from("estimate_sections")
    .select("name, sort_order")
    .eq("company_id", input.companyId)
    .eq("estimate_id", estimate.id)
    .order("sort_order", { ascending: true });

  if (sectionsResponse.error) {
    throw new Error(sectionsResponse.error.message || "Unable to load estimate sections for workspace bootstrap.");
  }

  const sectionRows = (sectionsResponse.data || []) as Array<{ name: string; sort_order: number }>;

  const fallbackPhases = [
    { name: "Pre-Construction", sort_order: 100 },
    { name: "Execution", sort_order: 200 },
    { name: "Closeout", sort_order: 300 },
  ];

  const dedupe = new Set<string>();
  const phaseSeed = (sectionRows.length > 0 ? sectionRows : fallbackPhases)
    .map((row, index) => ({
      name: row.name.trim(),
      sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : (index + 1) * 100,
    }))
    .filter((row) => row.name.length > 0)
    .filter((row) => {
      const normalized = row.name.toLowerCase();
      if (dedupe.has(normalized)) {
        return false;
      }

      dedupe.add(normalized);
      return true;
    });

  if (phaseSeed.length === 0) {
    return {
      status: "skipped",
      details: "No estimate sections were available for workspace bootstrap.",
      output: {
        project_id: projectId,
      },
    };
  }

  const insertRows = phaseSeed.map((phase) => ({
    company_id: input.companyId,
    project_id: projectId,
    name: phase.name,
    sort_order: phase.sortOrder,
  }));

  const insertResponse = await db
    .from("project_phases")
    .insert(insertRows)
    .select("id");

  if (insertResponse.error) {
    throw new Error(insertResponse.error.message || "Unable to create project phases from estimate sections.");
  }

  const publisher = createSupabaseOrionEventPublisher(input.context.supabase);
  await publisher.publishEvent({
    company_id: input.companyId,
    actor_profile_id: input.event.actor_profile_id,
    event_type: "project.workspace_bootstrapped",
    aggregate_type: "project",
    aggregate_id: projectId,
    source_module: "automation",
    correlation_id: input.event.event_id,
    causation_id: input.event.event_id,
    idempotency_key: `${input.runId}:project-workspace-bootstrap`,
    payload: {
      project_id: projectId,
      estimate_id: estimate.id,
      seeded_phases: phaseSeed.map((phase) => phase.name),
      seeded_phase_count: phaseSeed.length,
    },
  });

  return {
    status: "completed",
    details: "Project workspace phases seeded from estimate sections.",
    output: {
      project_id: projectId,
      seeded_phase_count: phaseSeed.length,
    },
  };
}

export async function createDepositInvoiceStep(input: OrionAutomationActionContext): Promise<OrionAutomationStepResult> {
  const estimateId = input.event.aggregate_id;
  const estimate = await loadEstimateForAutomation(input.context, input.companyId, estimateId);
  const depositAmount = computeDepositAmount(estimate);

  if (depositAmount <= 0) {
    return {
      status: "skipped",
      details: "Deposit is not configured for this estimate.",
      output: {
        deposit_amount: 0,
      },
    };
  }

  if (estimate.deposit_invoice_id) {
    input.context.state.depositInvoiceId = estimate.deposit_invoice_id;
    return {
      status: "completed",
      details: "Deposit invoice already exists.",
      output: {
        invoice_id: estimate.deposit_invoice_id,
        deposit_amount: depositAmount,
        idempotent: true,
      },
    };
  }

  const router = createOrionCommandRouter({
    supabase: input.context.supabase,
  });

  const execution = await router.executeCommand({
    commandId: "estimate.generate_deposit_invoice",
    params: {
      estimateId,
      action: "deposit_invoice",
    },
    companyContext: {
      companyId: input.companyId,
    },
    userContext: {
      actorProfileId: input.event.actor_profile_id,
      role: "accountant",
    },
    executionContext: {
      origin: "automation",
      automationRunId: input.runId,
      automationRuleId: input.event.event_type,
    },
    correlationId: input.event.event_id,
    idempotencyKey: `${input.runId}:deposit-invoice`,
  });

  if (!execution.success || execution.status === "failed" || execution.status === "rejected") {
    throw new Error(execution.failure || execution.userMessage || "Unable to create deposit invoice.");
  }

  const invoiceId = (execution.details?.invoiceId as string | undefined)
    || (execution.entityId && execution.entityType === "invoice" ? execution.entityId : null)
    || estimate.deposit_invoice_id;

  if (!invoiceId) {
    throw new Error("Deposit invoice command completed without invoice id.");
  }

  input.context.state.depositInvoiceId = invoiceId;

  return {
    status: "completed",
    details: "Deposit invoice generated.",
    output: {
      invoice_id: invoiceId,
      deposit_amount: depositAmount,
      remaining_balance: Number(Math.max(0, estimate.total_amount - depositAmount).toFixed(2)),
    },
  };
}

export async function createCustomerPortalStep(input: OrionAutomationActionContext): Promise<OrionAutomationStepResult> {
  const estimate = await loadEstimateForAutomation(input.context, input.companyId, input.event.aggregate_id);
  input.context.state.portalEnabled = true;

  const publisher = createSupabaseOrionEventPublisher(input.context.supabase);
  await publisher.publishEvent({
    company_id: input.companyId,
    actor_profile_id: input.event.actor_profile_id,
    event_type: "portal.created",
    aggregate_type: "customer",
    aggregate_id: estimate.customer_id || estimate.id,
    source_module: "automation",
    correlation_id: input.event.event_id,
    causation_id: input.event.event_id,
    idempotency_key: `${input.runId}:portal`,
    payload: {
      estimate_id: estimate.id,
      project_id: input.context.state.projectId,
      customer_id: estimate.customer_id,
      resources: [
        "estimate",
        "service_agreement",
        "deposit_invoice",
        "project_status",
        "messages",
        "documents",
        "change_orders",
        "payments",
      ],
    },
  });

  return {
    status: "completed",
    details: "Customer portal access initialized.",
    output: {
      customer_id: estimate.customer_id,
      portal_enabled: true,
    },
  };
}

export async function generateServiceAgreementStep(input: OrionAutomationActionContext): Promise<OrionAutomationStepResult> {
  const estimate = await loadEstimateForAutomation(input.context, input.companyId, input.event.aggregate_id);

  if (estimate.agreement_version_id) {
    input.context.state.agreementVersionId = estimate.agreement_version_id;
    return {
      status: "completed",
      details: "Service agreement already exists.",
      output: {
        agreement_version_id: estimate.agreement_version_id,
        idempotent: true,
      },
    };
  }

  const db = input.context.supabase as unknown as LooseSupabase;
  const snapshot = {
    estimate_id: estimate.id,
    title: estimate.title,
    description: estimate.description,
    scope_inclusions: estimate.scope_inclusions,
    scope_exclusions: estimate.scope_exclusions,
    payment_terms: estimate.payment_terms,
    customer_notes: estimate.customer_notes,
    generated_by: "orion_automation",
    generated_at: input.context.now().toISOString(),
  };

  const agreementHash = `auto-${estimate.id}-${input.runId}`;

  const { data: version, error: versionError } = await db
    .from("estimate_agreement_versions")
    .insert({
      company_id: input.companyId,
      estimate_id: estimate.id,
      version_number: 1,
      agreement_snapshot: snapshot,
      agreement_hash: agreementHash,
      source_terms: estimate.scope_inclusions,
      source_payment_terms: estimate.payment_terms,
      created_by: input.event.actor_profile_id,
    })
    .select("id")
    .single();

  if (versionError || !version?.id) {
    throw new Error(versionError?.message || "Unable to create service agreement version.");
  }

  const agreementVersionId = version.id as string;
  input.context.state.agreementVersionId = agreementVersionId;

  const { error: estimateUpdateError } = await db
    .from("estimates")
    .update({
      agreement_version_id: agreementVersionId,
      agreement_hash: agreementHash,
      agreement_snapshot: snapshot,
      updated_by: input.event.actor_profile_id,
    })
    .eq("company_id", input.companyId)
    .eq("id", estimate.id);

  if (estimateUpdateError) {
    throw new Error(estimateUpdateError.message || "Unable to attach agreement version to estimate.");
  }

  const publisher = createSupabaseOrionEventPublisher(input.context.supabase);
  await publisher.publishEvent({
    company_id: input.companyId,
    actor_profile_id: input.event.actor_profile_id,
    event_type: "service_agreement.generated",
    aggregate_type: "estimate",
    aggregate_id: estimate.id,
    source_module: "automation",
    correlation_id: input.event.event_id,
    causation_id: input.event.event_id,
    idempotency_key: `${input.runId}:service-agreement`,
    payload: {
      estimate_id: estimate.id,
      agreement_version_id: agreementVersionId,
      downloadable: true,
      customer_acceptance_enabled: true,
    },
  });

  return {
    status: "completed",
    details: "Service agreement generated.",
    output: {
      agreement_version_id: agreementVersionId,
    },
  };
}

export async function generateWelcomePacketStep(input: OrionAutomationActionContext): Promise<OrionAutomationStepResult> {
  const estimate = await loadEstimateForAutomation(input.context, input.companyId, input.event.aggregate_id);

  const publisher = createSupabaseOrionEventPublisher(input.context.supabase);
  await publisher.publishEvent({
    company_id: input.companyId,
    actor_profile_id: input.event.actor_profile_id,
    event_type: "welcome_packet.generated",
    aggregate_type: "project",
    aggregate_id: input.context.state.projectId || estimate.id,
    source_module: "automation",
    correlation_id: input.event.event_id,
    causation_id: input.event.event_id,
    idempotency_key: `${input.runId}:welcome-packet`,
    payload: {
      estimate_id: estimate.id,
      project_id: input.context.state.projectId,
      includes: ["project_status", "payment_schedule", "next_steps", "contact_points"],
    },
  });

  return {
    status: "completed",
    details: "Welcome packet generated.",
    output: {
      includes: ["project_status", "payment_schedule", "next_steps", "contact_points"],
    },
  };
}

export async function assignProjectStatusStep(input: OrionAutomationActionContext): Promise<OrionAutomationStepResult> {
  const estimate = await loadEstimateForAutomation(input.context, input.companyId, input.event.aggregate_id);
  const projectId = input.context.state.projectId || estimate.converted_project_id || estimate.project_id;

  if (!projectId) {
    throw new Error("No project id available for status assignment.");
  }

  const router = createOrionCommandRouter({
    supabase: input.context.supabase,
  });

  const execution = await router.executeCommand({
    commandId: "project.update_status",
    params: {
      projectId,
      status: "scheduled",
    },
    companyContext: {
      companyId: input.companyId,
    },
    userContext: {
      actorProfileId: input.event.actor_profile_id,
      role: "operations_manager",
    },
    executionContext: {
      origin: "automation",
      automationRunId: input.runId,
      automationRuleId: input.event.event_type,
    },
    correlationId: input.event.event_id,
    idempotencyKey: `${input.runId}:project-status`,
  });

  if (!execution.success || execution.status === "failed" || execution.status === "rejected") {
    throw new Error(execution.failure || execution.userMessage || "Unable to set project status.");
  }

  input.context.state.projectId = projectId;

  return {
    status: "completed",
    details: "Project status assigned to Pre-Construction.",
    output: {
      project_id: projectId,
      status: "scheduled",
      display_status: "Pre-Construction",
    },
  };
}

export async function seedProjectTimelineStep(input: OrionAutomationActionContext): Promise<OrionAutomationStepResult> {
  const estimate = await loadEstimateForAutomation(input.context, input.companyId, input.event.aggregate_id);
  const projectId = input.context.state.projectId || estimate.converted_project_id || estimate.project_id;

  if (!projectId) {
    throw new Error("No project id available for timeline seed.");
  }

  const publisher = createSupabaseOrionEventPublisher(input.context.supabase);
  await publisher.publishEvent({
    company_id: input.companyId,
    actor_profile_id: input.event.actor_profile_id,
    event_type: "project.timeline_seeded",
    aggregate_type: "project",
    aggregate_id: projectId,
    source_module: "automation",
    correlation_id: input.event.event_id,
    causation_id: input.event.event_id,
    idempotency_key: `${input.runId}:timeline-seed`,
    payload: {
      project_id: projectId,
      estimate_id: estimate.id,
      seed: [
        "project_created_from_approved_estimate",
        "deposit_schedule_initialized",
        "customer_portal_enabled",
      ],
    },
  });

  return {
    status: "completed",
    details: "Project timeline seeded.",
    output: {
      project_id: projectId,
    },
  };
}

export async function createEstimateFollowupReminderStep(input: OrionAutomationActionContext): Promise<OrionAutomationStepResult> {
  const estimate = await loadEstimateForAutomation(input.context, input.companyId, input.event.aggregate_id);

  if (estimate.status === "approved" || estimate.status === "rejected") {
    return {
      status: "skipped",
      details: "Estimate is already finalized.",
    };
  }

  const viewedAt = new Date(input.event.occurred_at);
  const dueAt = new Date(viewedAt.getTime() + input.context.config.followupDays * 24 * 60 * 60 * 1000);

  const db = input.context.supabase as unknown as LooseSupabase;
  await db
    .from("estimates")
    .update({
      followup_due_at: dueAt.toISOString(),
      updated_by: input.event.actor_profile_id,
    })
    .eq("company_id", input.companyId)
    .eq("id", estimate.id);

  if (input.context.now().getTime() < dueAt.getTime()) {
    return {
      status: "skipped",
      details: "Follow-up due date has not been reached yet.",
      output: {
        followup_due_at: dueAt.toISOString(),
      },
    };
  }

  const publisher = createSupabaseOrionEventPublisher(input.context.supabase);
  await publisher.publishEvent({
    company_id: input.companyId,
    actor_profile_id: input.event.actor_profile_id,
    event_type: "estimate.followup_due",
    aggregate_type: "estimate",
    aggregate_id: estimate.id,
    source_module: "automation",
    correlation_id: input.event.event_id,
    causation_id: input.event.event_id,
    idempotency_key: `${input.runId}:followup`,
    payload: {
      estimate_id: estimate.id,
      followup_due_at: dueAt.toISOString(),
      reminder_type: "approval_followup",
      days_since_viewed: input.context.config.followupDays,
    },
  });

  return {
    status: "completed",
    details: "Follow-up reminder recorded.",
    output: {
      followup_due_at: dueAt.toISOString(),
      reminder_event: "estimate.followup_due",
    },
  };
}
