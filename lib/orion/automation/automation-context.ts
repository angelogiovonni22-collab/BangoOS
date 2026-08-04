import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseOrionEventPublisher, type OrionEventRecord } from "@/lib/orion/events";
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

  const issueDate = input.context.now().toISOString().slice(0, 10);
  const dueDate = new Date(input.context.now().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const db = input.context.supabase as unknown as LooseSupabase;
  const { data: invoice, error: invoiceError } = await db
    .from("invoices")
    .insert({
      company_id: input.companyId,
      title: `Deposit - ${estimate.title}`,
      customer_id: estimate.customer_id,
      project_id: input.context.state.projectId,
      estimate_id: estimate.id,
      issue_date: issueDate,
      due_date: dueDate,
      status: "draft",
      description: "Deposit invoice generated by Orion automation.",
      subtotal: depositAmount,
      discount_type: "none",
      discount_value: 0,
      discount_total: 0,
      tax_rate: 0,
      tax_amount: 0,
      additional_fee: 0,
      total_amount: depositAmount,
      amount_paid: 0,
      notes: "Automated deposit invoice.",
      payment_terms: estimate.payment_terms,
      created_by: input.event.actor_profile_id,
      updated_by: input.event.actor_profile_id,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice?.id) {
    throw new Error(invoiceError?.message || "Unable to create deposit invoice.");
  }

  const invoiceId = invoice.id as string;

  const { error: linkError } = await db
    .from("invoice_estimate_links")
    .upsert({
      company_id: input.companyId,
      invoice_id: invoiceId,
      estimate_id: estimate.id,
      link_type: "converted",
      created_by: input.event.actor_profile_id,
      metadata: {
        kind: "deposit",
        source: "orion_automation",
      },
    }, {
      onConflict: "invoice_id,estimate_id",
    });

  if (linkError) {
    throw new Error(linkError.message || "Unable to create invoice-estimate link.");
  }

  const { error: estimateUpdateError } = await db
    .from("estimates")
    .update({
      deposit_invoice_id: invoiceId,
      deposit_amount: depositAmount,
      updated_by: input.event.actor_profile_id,
    })
    .eq("company_id", input.companyId)
    .eq("id", estimate.id);

  if (estimateUpdateError) {
    throw new Error(estimateUpdateError.message || "Unable to update estimate deposit fields.");
  }

  const publisher = createSupabaseOrionEventPublisher(input.context.supabase);
  await publisher.publishEvent({
    company_id: input.companyId,
    actor_profile_id: input.event.actor_profile_id,
    event_type: "invoice.created",
    aggregate_type: "invoice",
    aggregate_id: invoiceId,
    source_module: "invoices",
    correlation_id: input.event.event_id,
    causation_id: input.event.event_id,
    idempotency_key: `${input.runId}:deposit-invoice-created`,
    payload: {
      estimate_id: estimate.id,
      project_id: input.context.state.projectId,
      customer_id: estimate.customer_id,
      total_amount: depositAmount,
      kind: "deposit",
    },
  });

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

  const db = input.context.supabase as unknown as LooseSupabase;
  const { error } = await db
    .from("projects")
    .update({
      status: "scheduled",
    })
    .eq("company_id", input.companyId)
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message || "Unable to set project status.");
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
