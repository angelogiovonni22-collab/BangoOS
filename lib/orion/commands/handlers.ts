import { saveEstimate } from "@/lib/estimates/service";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";
import { saveInvoice, sendInvoice, markInvoicePaid } from "@/lib/invoices/service";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import { createProjectExecutionService } from "@/lib/projects/execution";
import { createWorkforceService } from "@/lib/workforce/workforce-service";
import type { Database } from "@/types/database.types";
import type { OrionCommandDependencies, OrionCommandExecutionContext, OrionCommandExecutionOutput } from "./types";

function requireString(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function optionalString(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalBoolean(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === "boolean" ? value : null;
}

function asRecord(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${key} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function asArray(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array.`);
  }

  return value;
}

function parseLineItems(params: Record<string, unknown>, key: string) {
  return asArray(params, key).map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${key}[${index}] must be an object.`);
    }

    const row = entry as Record<string, unknown>;
    return {
      id: requireString(row, "id"),
      sortOrder: optionalNumber(row, "sortOrder") ?? index + 1,
      description: requireString(row, "description"),
      quantity: String(optionalNumber(row, "quantity") ?? row.quantity ?? "1"),
      unit: String(row.unit ?? "each"),
      unitCost: String(optionalNumber(row, "unitCost") ?? row.unitCost ?? "0"),
      markupPercent: String(optionalNumber(row, "markupPercent") ?? row.markupPercent ?? "0"),
      notes: String(optionalString(row, "notes") || ""),
      category: String(optionalString(row, "category") || "general"),
      itemCode: optionalString(row, "itemCode") || "",
    };
  });
}

export async function executeOpenEntityCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
): Promise<OrionCommandExecutionOutput> {
  void context;
  const entityType = requireString(params, "entityType");
  const entityId = requireString(params, "entityId");
  const href = optionalString(params, "deepLink") || `/${entityType}s/${entityId}`;

  return {
    publishedEvent: null,
    deepLink: href,
    entityUpdated: {
      type: entityType as OrionCommandExecutionOutput["entityUpdated"] extends { type: infer T } ? T : never,
      id: entityId,
    },
  };
}

export async function executeCreateCustomerCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const firstName = requireString(params, "firstName");
  const lastName = requireString(params, "lastName");
  const customerType = optionalString(params, "customerType") || "residential";

  const { data, error } = await deps.supabase
    .from("customers")
    .insert({
      company_id: context.companyId,
      customer_type: customerType,
      first_name: firstName,
      last_name: lastName,
      company_name: optionalString(params, "companyName"),
      email: optionalString(params, "email"),
      phone: optionalString(params, "phone"),
      address_line_1: optionalString(params, "addressLine1"),
      address_line_2: optionalString(params, "addressLine2"),
      city: optionalString(params, "city"),
      state: optionalString(params, "state"),
      postal_code: optionalString(params, "postalCode"),
      notes: optionalString(params, "notes"),
      created_by: context.actorProfileId,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Unable to create customer.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: "customer.created",
    aggregate_type: "customer",
    aggregate_id: data.id,
    source_module: "customers",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:customer-created`,
    payload: {
      customer_id: data.id,
      customer_type: customerType,
      customer_name: `${firstName} ${lastName}`.trim(),
      company_name: optionalString(params, "companyName"),
      deep_link: `/customers/${data.id}`,
    },
    metadata: {
      event_category: "customers",
      event_severity: "info",
      deep_link: `/customers/${data.id}`,
    },
  });

  return {
    entityCreated: { type: "customer", id: data.id },
    publishedEvent: "customer.created",
    deepLink: `/customers/${data.id}`,
  };
}

export async function executeUpdateCustomerCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const customerId = requireString(params, "customerId");
  const updates = asRecord(params, "updates");

  const { data: current, error: loadError } = await deps.supabase
    .from("customers")
    .select("id, customer_type, first_name, last_name, company_name, status")
    .eq("company_id", context.companyId)
    .eq("id", customerId)
    .maybeSingle();

  if (loadError || !current) {
    throw new Error(loadError?.message || "Customer not found.");
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(updates)) {
    patch[key] = value;
  }

  const customerPatch: Database["public"]["Tables"]["customers"]["Update"] = patch;

  const { error } = await deps.supabase
    .from("customers")
    .update(customerPatch)
    .eq("company_id", context.companyId)
    .eq("id", customerId);

  if (error) {
    throw new Error(error.message || "Unable to update customer.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: "customer.updated",
    aggregate_type: "customer",
    aggregate_id: customerId,
    source_module: "customers",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:customer-updated`,
    payload: {
      customer_id: customerId,
      customer_type: (updates.customer_type as string | undefined) || current.customer_type,
      customer_name: `${(updates.first_name as string | undefined) || current.first_name || ""} ${(updates.last_name as string | undefined) || current.last_name || ""}`.trim(),
      company_name: (updates.company_name as string | undefined) || current.company_name,
      deep_link: `/customers/${customerId}`,
    },
    metadata: {
      event_category: "customers",
      event_severity: "info",
      deep_link: `/customers/${customerId}`,
    },
  });

  const nextType = (updates.customer_type as string | undefined) || current.customer_type;
  if (nextType !== current.customer_type) {
    await orion.publishEvent({
      company_id: context.companyId,
      actor_profile_id: context.actorProfileId,
      event_type: "customer.converted",
      aggregate_type: "customer",
      aggregate_id: customerId,
      source_module: "customers",
      correlation_id: context.correlationId,
      idempotency_key: `${context.idempotencyKey}:customer-converted`,
      payload: {
        customer_id: customerId,
        previous_type: current.customer_type,
        next_type: nextType,
        deep_link: `/customers/${customerId}`,
      },
      metadata: {
        event_category: "customers",
        event_severity: "success",
        deep_link: `/customers/${customerId}`,
      },
    });
  }

  return {
    entityUpdated: { type: "customer", id: customerId },
    publishedEvent: nextType !== current.customer_type ? "customer.converted" : "customer.updated",
    deepLink: `/customers/${customerId}`,
  };
}

export async function executeArchiveCustomerCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const customerId = requireString(params, "customerId");

  const { error } = await deps.supabase
    .from("customers")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", context.companyId)
    .eq("id", customerId);

  if (error) {
    throw new Error(error.message || "Unable to archive customer.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: "customer.archived",
    aggregate_type: "customer",
    aggregate_id: customerId,
    source_module: "customers",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:customer-archived`,
    payload: {
      customer_id: customerId,
      status: "archived",
      deep_link: `/customers/${customerId}`,
    },
    metadata: {
      event_category: "customers",
      event_severity: "attention",
      deep_link: `/customers/${customerId}`,
    },
  });

  return {
    entityUpdated: { type: "customer", id: customerId },
    publishedEvent: "customer.archived",
    deepLink: `/customers/${customerId}`,
  };
}

export async function executeRestoreCustomerCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const customerId = requireString(params, "customerId");

  const { error } = await deps.supabase
    .from("customers")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", context.companyId)
    .eq("id", customerId);

  if (error) {
    throw new Error(error.message || "Unable to restore customer.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: "customer.restored",
    aggregate_type: "customer",
    aggregate_id: customerId,
    source_module: "customers",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:customer-restored`,
    payload: {
      customer_id: customerId,
      status: "active",
      deep_link: `/customers/${customerId}`,
    },
    metadata: {
      event_category: "customers",
      event_severity: "success",
      deep_link: `/customers/${customerId}`,
    },
  });

  return {
    entityUpdated: { type: "customer", id: customerId },
    publishedEvent: "customer.restored",
    deepLink: `/customers/${customerId}`,
  };
}

export async function executeCreateEstimateCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const values = asRecord(params, "values");
  const lineItems = parseLineItems(params, "lineItems");

  const result = await saveEstimate({
    supabase: deps.supabase,
    companyId: context.companyId,
    userId: context.actorProfileId || "",
    values: values as never,
    lineItems: lineItems as never,
    estimateId: optionalString(params, "estimateId") || undefined,
  });

  if (result.error || !result.estimateId) {
    throw new Error(result.error || "Unable to save estimate.");
  }

  return {
    entityCreated: { type: "estimate", id: result.estimateId },
    publishedEvent: optionalString(params, "estimateId") ? "estimate.updated" : "estimate.created",
    deepLink: `/estimates/${result.estimateId}`,
  };
}

export async function executeEstimateWorkflowCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const action = requireString(params, "action");
  const estimateId = requireString(params, "estimateId");
  const workflow = createEstimateWorkflowService(deps.supabase);

  if (action === "approve") {
    await workflow.approveEstimate({
      companyId: context.companyId,
      estimateId,
      actorProfileId: context.actorProfileId,
      typedName: requireString(params, "typedName"),
      consentAccepted: optionalBoolean(params, "consentAccepted") ?? false,
      idempotencyKey: context.idempotencyKey,
      metadata: {
        command_id: context.commandId,
      },
    });

    return {
      entityUpdated: { type: "estimate", id: estimateId },
      publishedEvent: "estimate.approved",
      deepLink: `/estimates/${estimateId}`,
    };
  }

  if (action === "decline") {
    await workflow.declineEstimate({
      companyId: context.companyId,
      estimateId,
      actorProfileId: context.actorProfileId,
      reason: requireString(params, "reason"),
      idempotencyKey: context.idempotencyKey,
      metadata: {
        command_id: context.commandId,
      },
    });

    return {
      entityUpdated: { type: "estimate", id: estimateId },
      publishedEvent: "estimate.declined",
      deepLink: `/estimates/${estimateId}`,
    };
  }

  if (action === "convert") {
    const conversion = await workflow.convertEstimateToProject({
      companyId: context.companyId,
      estimateId,
      actorProfileId: context.actorProfileId || "",
      idempotencyKey: context.idempotencyKey,
      createDepositInvoice: optionalBoolean(params, "createDepositInvoice") ?? true,
    });

    return {
      entityUpdated: { type: "estimate", id: estimateId },
      publishedEvent: "estimate.converted",
      deepLink: conversion.projectId ? `/projects/${conversion.projectId}` : `/estimates/${estimateId}`,
      details: {
        projectId: conversion.projectId,
        depositInvoiceId: conversion.depositInvoiceId,
      },
    };
  }

  if (action === "deposit_invoice") {
    const deposit = await workflow.createDepositInvoice({
      companyId: context.companyId,
      estimateId,
      actorProfileId: context.actorProfileId || "",
      idempotencyKey: context.idempotencyKey,
    });

    return {
      entityUpdated: { type: "estimate", id: estimateId },
      publishedEvent: "estimate.deposit_requested",
      deepLink: `/invoices/${deposit.invoiceId}`,
      details: {
        invoiceId: deposit.invoiceId,
        amount: deposit.amount,
      },
    };
  }

  throw new Error("Unsupported estimate workflow action.");
}

export async function executeSendEstimateCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const estimateId = requireString(params, "estimateId");

  const { data: estimate, error: readError } = await deps.supabase
    .from("estimates")
    .select("id, status, customer_id")
    .eq("company_id", context.companyId)
    .eq("id", estimateId)
    .maybeSingle();

  if (readError || !estimate) {
    throw new Error(readError?.message || "Estimate not found.");
  }

  const workflow = createEstimateWorkflowService(deps.supabase);
  await workflow.generatePublicToken({
    companyId: context.companyId,
    estimateId,
    actorProfileId: context.actorProfileId,
    metadata: {
      command_id: context.commandId,
    },
  });

  const { error: updateError } = await deps.supabase
    .from("estimates")
    .update({
      status: estimate.status === "approved" ? estimate.status : "sent",
      updated_by: context.actorProfileId,
      issue_date: new Date().toISOString().slice(0, 10),
    })
    .eq("company_id", context.companyId)
    .eq("id", estimateId);

  if (updateError) {
    throw new Error(updateError.message || "Unable to mark estimate as sent.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: "estimate.sent",
    aggregate_type: "estimate",
    aggregate_id: estimateId,
    source_module: "estimates",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:estimate-sent`,
    payload: {
      estimate_id: estimateId,
      customer_id: estimate.customer_id,
      deep_link: `/estimates/${estimateId}`,
    },
    metadata: {
      event_category: "estimates",
      event_severity: "info",
      deep_link: `/estimates/${estimateId}`,
    },
  });

  return {
    entityUpdated: { type: "estimate", id: estimateId },
    publishedEvent: "estimate.sent",
    deepLink: `/estimates/${estimateId}`,
    userMessage: "Estimate sent and customer link is available.",
  };
}

export async function executeCreateProjectCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const name = requireString(params, "name");
  const status = optionalString(params, "status") || "lead";

  const { data, error } = await deps.supabase
    .from("projects")
    .insert({
      company_id: context.companyId,
      created_by: context.actorProfileId,
      customer_id: optionalString(params, "customerId"),
      name,
      project_number: optionalString(params, "projectNumber"),
      project_type: optionalString(params, "projectType"),
      status,
      description: optionalString(params, "description"),
      address_line_1: optionalString(params, "addressLine1"),
      address_line_2: optionalString(params, "addressLine2"),
      city: optionalString(params, "city"),
      state: optionalString(params, "state"),
      postal_code: optionalString(params, "postalCode"),
      estimated_start_date: optionalString(params, "estimatedStartDate"),
      estimated_end_date: optionalString(params, "estimatedEndDate"),
      estimated_cost: optionalNumber(params, "estimatedCost"),
      contract_amount: optionalNumber(params, "contractAmount"),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Unable to create project.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: "project.created",
    aggregate_type: "project",
    aggregate_id: data.id,
    source_module: "projects",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:project-created`,
    payload: {
      project_id: data.id,
      name,
      status,
      deep_link: `/projects/${data.id}`,
    },
    metadata: {
      event_category: "projects",
      event_severity: "info",
      deep_link: `/projects/${data.id}`,
    },
  });

  if (status === "completed") {
    await orion.publishEvent({
      company_id: context.companyId,
      actor_profile_id: context.actorProfileId,
      event_type: "project.completed",
      aggregate_type: "project",
      aggregate_id: data.id,
      source_module: "projects",
      correlation_id: context.correlationId,
      idempotency_key: `${context.idempotencyKey}:project-completed`,
      payload: {
        project_id: data.id,
        status,
        deep_link: `/projects/${data.id}`,
      },
      metadata: {
        event_category: "projects",
        event_severity: "success",
        deep_link: `/projects/${data.id}`,
      },
    });
  }

  if (status === "cancelled") {
    await orion.publishEvent({
      company_id: context.companyId,
      actor_profile_id: context.actorProfileId,
      event_type: "project.archived",
      aggregate_type: "project",
      aggregate_id: data.id,
      source_module: "projects",
      correlation_id: context.correlationId,
      idempotency_key: `${context.idempotencyKey}:project-archived`,
      payload: {
        project_id: data.id,
        status,
        deep_link: `/projects/${data.id}`,
      },
      metadata: {
        event_category: "projects",
        event_severity: "attention",
        deep_link: `/projects/${data.id}`,
      },
    });
  }

  return {
    entityCreated: { type: "project", id: data.id },
    publishedEvent: status === "completed" ? "project.completed" : status === "cancelled" ? "project.archived" : "project.created",
    deepLink: `/projects/${data.id}`,
  };
}

export async function executeUpdateProjectStatusCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const projectId = requireString(params, "projectId");
  const nextStatus = requireString(params, "status");

  const { data: current, error: readError } = await deps.supabase
    .from("projects")
    .select("id, status")
    .eq("company_id", context.companyId)
    .eq("id", projectId)
    .maybeSingle();

  if (readError || !current) {
    throw new Error(readError?.message || "Project not found.");
  }

  const { error } = await deps.supabase
    .from("projects")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", context.companyId)
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message || "Unable to update project status.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: "project.status_changed",
    aggregate_type: "project",
    aggregate_id: projectId,
    source_module: "projects",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:project-status`,
    payload: {
      project_id: projectId,
      previous_status: current.status,
      next_status: nextStatus,
      deep_link: `/projects/${projectId}`,
    },
    metadata: {
      event_category: "projects",
      event_severity: "info",
      deep_link: `/projects/${projectId}`,
    },
  });

  if (nextStatus === "completed") {
    await orion.publishEvent({
      company_id: context.companyId,
      actor_profile_id: context.actorProfileId,
      event_type: "project.completed",
      aggregate_type: "project",
      aggregate_id: projectId,
      source_module: "projects",
      correlation_id: context.correlationId,
      idempotency_key: `${context.idempotencyKey}:project-completed`,
      payload: {
        project_id: projectId,
        previous_status: current.status,
        next_status: nextStatus,
        deep_link: `/projects/${projectId}`,
      },
      metadata: {
        event_category: "projects",
        event_severity: "success",
        deep_link: `/projects/${projectId}`,
      },
    });
  }

  if (nextStatus === "cancelled") {
    await orion.publishEvent({
      company_id: context.companyId,
      actor_profile_id: context.actorProfileId,
      event_type: "project.archived",
      aggregate_type: "project",
      aggregate_id: projectId,
      source_module: "projects",
      correlation_id: context.correlationId,
      idempotency_key: `${context.idempotencyKey}:project-archived`,
      payload: {
        project_id: projectId,
        previous_status: current.status,
        next_status: nextStatus,
        deep_link: `/projects/${projectId}`,
      },
      metadata: {
        event_category: "projects",
        event_severity: "attention",
        deep_link: `/projects/${projectId}`,
      },
    });
  }

  return {
    entityUpdated: { type: "project", id: projectId },
    publishedEvent: nextStatus === "completed" ? "project.completed" : nextStatus === "cancelled" ? "project.archived" : "project.status_changed",
    deepLink: `/projects/${projectId}`,
  };
}

export async function executeCreateInvoiceCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const values = asRecord(params, "values");
  const lineItems = asArray(params, "lineItems");

  const result = await saveInvoice({
    supabase: deps.supabase,
    companyId: context.companyId,
    userId: context.actorProfileId || "",
    values: values as never,
    lineItems: lineItems as never,
    invoiceId: optionalString(params, "invoiceId") || undefined,
  });

  if (result.error || !result.invoiceId) {
    throw new Error(result.error || "Unable to save invoice.");
  }

  return {
    entityCreated: { type: "invoice", id: result.invoiceId },
    publishedEvent: optionalString(params, "invoiceId") ? "invoice.updated" : "invoice.created",
    deepLink: `/invoices/${result.invoiceId}`,
  };
}

export async function executeRecordInvoicePaymentCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const invoiceId = requireString(params, "invoiceId");
  const amount = optionalNumber(params, "amount");
  if (!amount || amount <= 0) {
    throw new Error("amount must be greater than 0.");
  }

  const method = optionalString(params, "method") || "manual";
  const referenceNumber = optionalString(params, "referenceNumber");
  const notes = optionalString(params, "notes") || null;
  const isDeposit = context.commandId === "invoice.record_deposit" || optionalBoolean(params, "isDeposit") === true;

  const { data: invoice, error: readError } = await deps.supabase
    .from("invoices")
    .select("id, status, total_amount, amount_paid, customer_id, project_id")
    .eq("company_id", context.companyId)
    .eq("id", invoiceId)
    .maybeSingle();

  if (readError || !invoice) {
    throw new Error(readError?.message || "Invoice not found.");
  }

  const remaining = Number(Math.max(0, invoice.total_amount - invoice.amount_paid).toFixed(2));
  if (remaining <= 0) {
    throw new Error("Invoice is already fully paid.");
  }

  if (amount > remaining) {
    throw new Error("Payment amount exceeds remaining invoice balance.");
  }

  const paymentDate = new Date().toISOString().slice(0, 10);
  const { error: paymentError } = await deps.supabase
    .from("invoice_payment_history")
    .insert({
      company_id: context.companyId,
      invoice_id: invoiceId,
      payment_date: paymentDate,
      amount,
      method,
      reference_number: referenceNumber,
      notes,
      status: "recorded",
      created_by: context.actorProfileId,
      updated_by: context.actorProfileId,
    });

  if (paymentError) {
    throw new Error(paymentError.message || "Unable to record invoice payment.");
  }

  const nextAmountPaid = Number((invoice.amount_paid + amount).toFixed(2));
  const isPaid = nextAmountPaid >= Number(invoice.total_amount);
  const nextStatus = isPaid ? "paid" : "partially_paid";

  const { error: updateError } = await deps.supabase
    .from("invoices")
    .update({
      amount_paid: nextAmountPaid,
      status: nextStatus,
      paid_date: isPaid ? paymentDate : null,
      updated_by: context.actorProfileId,
    })
    .eq("company_id", context.companyId)
    .eq("id", invoiceId);

  if (updateError) {
    throw new Error(updateError.message || "Unable to update invoice balance.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: isPaid ? "invoice.paid" : "invoice.partial_payment",
    aggregate_type: "invoice",
    aggregate_id: invoiceId,
    source_module: "invoices",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:invoice-payment`,
    payload: {
      invoice_id: invoiceId,
      amount,
      amount_paid: nextAmountPaid,
      total_amount: invoice.total_amount,
      remaining_balance: Number(Math.max(0, invoice.total_amount - nextAmountPaid).toFixed(2)),
      deep_link: `/invoices/${invoiceId}`,
    },
    metadata: {
      event_category: "finance",
      event_severity: isPaid ? "success" : "info",
      deep_link: `/invoices/${invoiceId}`,
    },
  });

  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: isDeposit ? "deposit.received" : "payment.received",
    aggregate_type: isDeposit ? "deposit" : "payment",
    aggregate_id: invoiceId,
    source_module: "payments",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:${isDeposit ? "deposit" : "payment"}-received`,
    payload: {
      invoice_id: invoiceId,
      customer_id: invoice.customer_id,
      project_id: invoice.project_id,
      amount,
      method,
      payment_date: paymentDate,
      deep_link: `/invoices/${invoiceId}`,
    },
    metadata: {
      event_category: "finance",
      event_severity: "success",
      deep_link: `/invoices/${invoiceId}`,
    },
  });

  return {
    entityUpdated: { type: "invoice", id: invoiceId },
    publishedEvent: isPaid ? "invoice.paid" : "invoice.partial_payment",
    deepLink: `/invoices/${invoiceId}`,
    details: {
      amount,
      amountPaid: nextAmountPaid,
      status: nextStatus,
      remainingBalance: Number(Math.max(0, invoice.total_amount - nextAmountPaid).toFixed(2)),
    },
    userMessage: isPaid
      ? "Invoice marked paid from recorded payment."
      : "Payment recorded and invoice balance updated.",
  };
}

export async function executeAssignCrewToProjectCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const input = asRecord(params, "input");
  const projectId = requireString(input, "projectId");
  const crewId = requireString(input, "crewId");
  const title = optionalString(input, "title") || "Crew assignment";
  const startsAt = optionalString(input, "startsAt") || new Date().toISOString();
  const endsAt = optionalString(input, "endsAt") || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

  const { data: inserted, error } = await deps.supabase
    .from("workforce_assignments")
    .insert({
      company_id: context.companyId,
      project_id: projectId,
      assignment_type: "crew",
      crew_id: crewId,
      employee_id: null,
      phase_id: optionalString(input, "phaseId"),
      task_id: optionalString(input, "taskId"),
      title,
      description: optionalString(input, "description"),
      starts_at: startsAt,
      ends_at: endsAt,
      planned_hours: optionalNumber(input, "plannedHours") ?? 8,
      status: optionalString(input, "status") || "assigned",
      source_type: "manual",
      source_id: null,
      notes: optionalString(input, "notes"),
      created_by: context.actorProfileId,
      updated_by: context.actorProfileId,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    throw new Error(error?.message || "Unable to create crew assignment.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: "crew.assigned",
    aggregate_type: "crew",
    aggregate_id: crewId,
    source_module: "workforce",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:crew-assigned`,
    payload: {
      crew_id: crewId,
      project_id: projectId,
      assignment_id: inserted.id,
      starts_at: startsAt,
      ends_at: endsAt,
      deep_link: `/projects/${projectId}`,
    },
    metadata: {
      event_category: "workforce",
      event_severity: "info",
      deep_link: `/projects/${projectId}`,
    },
  });

  return {
    entityUpdated: { type: "project", id: projectId },
    publishedEvent: "crew.assigned",
    deepLink: `/projects/${projectId}`,
    details: {
      assignmentId: inserted.id,
      crewId,
      projectId,
    },
    userMessage: "Crew assignment created for project.",
  };
}

export async function executeInvoiceActionCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const action = requireString(params, "action");
  const invoiceId = requireString(params, "invoiceId");

  if (action === "send") {
    const result = await sendInvoice({
      supabase: deps.supabase,
      companyId: context.companyId,
      invoiceId,
      userId: context.actorProfileId || "",
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return {
      entityUpdated: { type: "invoice", id: invoiceId },
      publishedEvent: "invoice.sent",
      deepLink: `/invoices/${invoiceId}`,
    };
  }

  if (action === "record_payment") {
    const result = await markInvoicePaid({
      supabase: deps.supabase,
      companyId: context.companyId,
      invoiceId,
      userId: context.actorProfileId || "",
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return {
      entityUpdated: { type: "invoice", id: invoiceId },
      publishedEvent: "invoice.paid",
      deepLink: `/invoices/${invoiceId}`,
    };
  }

  throw new Error("Unsupported invoice action.");
}

export async function executeCreateEmployeeCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const workforce = createWorkforceService(deps.supabase);
  const created = await workforce.createEmployee(context.companyId, context.actorProfileId || "", asRecord(params, "input") as never);

  return {
    entityCreated: { type: "employee", id: created.id },
    publishedEvent: "employee.created",
    deepLink: `/employees/${created.id}`,
  };
}

export async function executeArchiveEmployeeCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const employeeId = requireString(params, "employeeId");
  const workforce = createWorkforceService(deps.supabase);
  const row = await workforce.archiveEmployee(context.companyId, context.actorProfileId || "", employeeId);

  if (!row) {
    throw new Error("Employee not found.");
  }

  return {
    entityUpdated: { type: "employee", id: employeeId },
    publishedEvent: "employee.archived",
    deepLink: `/employees/${employeeId}`,
  };
}

export async function executeCreateCrewCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const workforce = createWorkforceService(deps.supabase);
  const created = await workforce.createCrew(context.companyId, context.actorProfileId || "", asRecord(params, "input") as never);

  return {
    entityCreated: { type: "crew", id: created.id },
    publishedEvent: "crew.created",
    deepLink: `/crews/${created.id}`,
  };
}

export async function executeAssignCrewCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const workforce = createWorkforceService(deps.supabase);
  const membership = await workforce.addCrewMembership(context.companyId, context.actorProfileId || "", asRecord(params, "input") as never);

  return {
    entityUpdated: { type: "crew", id: membership.crew_id },
    publishedEvent: "crew.assigned",
    deepLink: `/crews/${membership.crew_id}`,
  };
}

export async function executeRemoveCrewCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const membershipId = requireString(params, "membershipId");
  const endsOn = requireString(params, "endsOn");
  const workforce = createWorkforceService(deps.supabase);
  const ended = await workforce.endCrewMembership(context.companyId, context.actorProfileId || "", membershipId, endsOn);

  if (!ended) {
    throw new Error("Crew membership not found.");
  }

  return {
    entityUpdated: { type: "crew", id: ended.crew_id },
    publishedEvent: "crew.unassigned",
    deepLink: `/crews/${ended.crew_id}`,
  };
}

export async function executeCreateTaskCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const title = requireString(params, "title");
  const projectId = requireString(params, "projectId");
  const taskNumber = optionalNumber(params, "taskNumber");
  if (!taskNumber) {
    throw new Error("taskNumber is required.");
  }

  const { data, error } = await deps.supabase
    .from("tasks")
    .insert({
      company_id: context.companyId,
      project_id: projectId,
      phase_id: optionalString(params, "phaseId"),
      title,
      description: optionalString(params, "description"),
      notes: optionalString(params, "notes"),
      status: optionalString(params, "status") || "not_started",
      priority: optionalString(params, "priority") || "medium",
      assigned_profile_id: optionalString(params, "assignedProfileId"),
      completion_percentage: optionalNumber(params, "completionPercentage") ?? 0,
      planned_start: optionalString(params, "plannedStart"),
      planned_finish: optionalString(params, "plannedFinish"),
      estimated_hours: optionalNumber(params, "estimatedHours"),
      task_number: taskNumber,
      created_by: context.actorProfileId,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Unable to create task.");
  }

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: "task.created",
    aggregate_type: "task",
    aggregate_id: data.id,
    source_module: "scheduling",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:task-created`,
    payload: {
      task_id: data.id,
      project_id: projectId,
      title,
      deep_link: `/projects/${projectId}`,
    },
    metadata: {
      event_category: "scheduling",
      event_severity: "info",
      deep_link: `/projects/${projectId}`,
    },
  });

  return {
    entityCreated: { type: "task", id: data.id },
    publishedEvent: "task.created",
    deepLink: `/projects/${projectId}`,
  };
}

export async function executeTaskStatusCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const taskId = requireString(params, "taskId");
  const nextStatus = requireString(params, "status");

  const { data: current, error: readError } = await deps.supabase
    .from("tasks")
    .select("id, project_id, status")
    .eq("company_id", context.companyId)
    .eq("id", taskId)
    .maybeSingle();

  if (readError || !current) {
    throw new Error(readError?.message || "Task not found.");
  }

  const patch: Database["public"]["Tables"]["tasks"]["Update"] = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  if (nextStatus === "in_progress") {
    patch.actual_start = new Date().toISOString();
  }

  if (nextStatus === "completed") {
    patch.actual_finish = new Date().toISOString();
    patch.completion_percentage = 100;
  }

  const { error } = await deps.supabase
    .from("tasks")
    .update(patch)
    .eq("company_id", context.companyId)
    .eq("id", taskId);

  if (error) {
    throw new Error(error.message || "Unable to update task.");
  }

  const eventType = current.status === "completed" && nextStatus !== "completed"
    ? "task.reopened"
    : nextStatus === "completed"
      ? "task.completed"
      : nextStatus === "on_hold" || nextStatus === "blocked"
        ? "task.reopened"
      : nextStatus === "in_progress"
        ? "task.started"
        : "task.started";

  const orion = createSupabaseOrionEventPublisher(deps.supabase);
  await orion.publishEvent({
    company_id: context.companyId,
    actor_profile_id: context.actorProfileId,
    event_type: eventType,
    aggregate_type: "task",
    aggregate_id: taskId,
    source_module: "scheduling",
    correlation_id: context.correlationId,
    idempotency_key: `${context.idempotencyKey}:task-status`,
    payload: {
      task_id: taskId,
      project_id: current.project_id,
      previous_status: current.status,
      next_status: nextStatus,
      deep_link: `/projects/${current.project_id}`,
    },
    metadata: {
      event_category: "scheduling",
      event_severity: eventType === "task.completed" ? "success" : "info",
      deep_link: `/projects/${current.project_id}`,
    },
  });

  return {
    entityUpdated: { type: "task", id: taskId },
    publishedEvent: eventType,
    deepLink: `/projects/${current.project_id}`,
  };
}

async function executeProjectExecutionAction(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const action = requireString(params, "action");
  const service = createProjectExecutionService(deps.supabase);
  const baseContext = {
    companyId: context.companyId,
    actorProfileId: context.actorProfileId,
    correlationId: context.correlationId,
    idempotencyKey: context.idempotencyKey,
  };

  if (action === "inspection.create") {
    const projectId = requireString(params, "projectId");
    const inspectionType = requireString(params, "inspectionType");
    const created = await service.createInspection({
      ...baseContext,
      projectId,
      inspectionType,
      jurisdiction: optionalString(params, "jurisdiction"),
      authority: optionalString(params, "authority"),
      inspectorName: optionalString(params, "inspectorName"),
      inspectorContact: optionalString(params, "inspectorContact"),
      scheduledAt: optionalString(params, "scheduledAt"),
      location: optionalString(params, "location"),
      notes: optionalString(params, "notes"),
      attachments: params.attachments,
    });

    return {
      entityCreated: { type: "inspection", id: created.id },
      publishedEvent: "inspection.created",
      deepLink: `/projects/${projectId}/inspections?inspectionId=${created.id}`,
    };
  }

  if (action === "inspection.schedule") {
    const inspectionId = requireString(params, "inspectionId");
    const scheduledAt = requireString(params, "scheduledAt");
    const updated = await service.scheduleInspection({ ...baseContext, inspectionId, scheduledAt });

    return {
      entityUpdated: { type: "inspection", id: inspectionId },
      publishedEvent: "inspection.scheduled",
      deepLink: `/projects/${updated.project_id}/inspections?inspectionId=${inspectionId}`,
    };
  }

  if (action === "inspection.reschedule") {
    const inspectionId = requireString(params, "inspectionId");
    const scheduledAt = requireString(params, "scheduledAt");
    const updated = await service.rescheduleInspection({ ...baseContext, inspectionId, scheduledAt });

    return {
      entityUpdated: { type: "inspection", id: inspectionId },
      publishedEvent: "inspection.rescheduled",
      deepLink: `/projects/${updated.project_id}/inspections?inspectionId=${inspectionId}`,
    };
  }

  if (action === "inspection.pass") {
    const inspectionId = requireString(params, "inspectionId");
    const updated = await service.passInspection({
      ...baseContext,
      inspectionId,
      notes: optionalString(params, "notes"),
    });

    return {
      entityUpdated: { type: "inspection", id: inspectionId },
      publishedEvent: "inspection.passed",
      deepLink: `/projects/${updated.project_id}/inspections?inspectionId=${inspectionId}`,
    };
  }

  if (action === "inspection.fail") {
    const inspectionId = requireString(params, "inspectionId");
    const updated = await service.failInspection({
      ...baseContext,
      inspectionId,
      correctionNotes: optionalString(params, "correctionNotes"),
      reinspectionRequired: optionalBoolean(params, "reinspectionRequired") ?? false,
      reinspectionDate: optionalString(params, "reinspectionDate"),
    });

    return {
      entityUpdated: { type: "inspection", id: inspectionId },
      publishedEvent: "inspection.failed",
      deepLink: `/projects/${updated.project_id}/inspections?inspectionId=${inspectionId}`,
    };
  }

  if (action === "inspection.cancel") {
    const inspectionId = requireString(params, "inspectionId");
    const updated = await service.cancelInspection({
      ...baseContext,
      inspectionId,
      notes: optionalString(params, "notes"),
    });

    return {
      entityUpdated: { type: "inspection", id: inspectionId },
      publishedEvent: "inspection.cancelled",
      deepLink: `/projects/${updated.project_id}/inspections?inspectionId=${inspectionId}`,
    };
  }

  if (action === "inspection.schedule_reinspection") {
    const inspectionId = requireString(params, "inspectionId");
    const reinspectionDate = requireString(params, "reinspectionDate");
    const updated = await service.scheduleReinspection({ ...baseContext, inspectionId, reinspectionDate });

    return {
      entityUpdated: { type: "inspection", id: inspectionId },
      publishedEvent: "inspection.reinspection_required",
      deepLink: `/projects/${updated.project_id}/inspections?inspectionId=${inspectionId}`,
    };
  }

  if (action === "permit.create") {
    const projectId = requireString(params, "projectId");
    const permitType = requireString(params, "permitType");
    const created = await service.createPermit({
      ...baseContext,
      projectId,
      permitType,
      permitNumber: optionalString(params, "permitNumber"),
      issuingAuthority: optionalString(params, "issuingAuthority"),
      jurisdiction: optionalString(params, "jurisdiction"),
      applicationDate: optionalString(params, "applicationDate"),
      responsibleParty: optionalString(params, "responsibleParty"),
      notes: optionalString(params, "notes"),
    });

    return {
      entityCreated: { type: "permit", id: created.id },
      publishedEvent: "permit.created",
      deepLink: `/projects/${projectId}/permits?permitId=${created.id}`,
    };
  }

  if (action === "permit.submit") {
    const permitId = requireString(params, "permitId");
    const updated = await service.submitPermit({
      ...baseContext,
      permitId,
      submittedAt: optionalString(params, "submittedAt"),
      notes: optionalString(params, "notes"),
    });

    return {
      entityUpdated: { type: "permit", id: permitId },
      publishedEvent: "permit.submitted",
      deepLink: `/projects/${updated.project_id}/permits?permitId=${permitId}`,
    };
  }

  if (action === "permit.approve") {
    const permitId = requireString(params, "permitId");
    const updated = await service.approvePermit({ ...baseContext, permitId, approvedAt: optionalString(params, "approvedAt") });

    return {
      entityUpdated: { type: "permit", id: permitId },
      publishedEvent: "permit.approved",
      deepLink: `/projects/${updated.project_id}/permits?permitId=${permitId}`,
    };
  }

  if (action === "permit.issue") {
    const permitId = requireString(params, "permitId");
    const updated = await service.issuePermit({
      ...baseContext,
      permitId,
      issuedAt: optionalString(params, "issuedAt"),
      expirationDate: optionalString(params, "expirationDate"),
    });

    return {
      entityUpdated: { type: "permit", id: permitId },
      publishedEvent: "permit.issued",
      deepLink: `/projects/${updated.project_id}/permits?permitId=${permitId}`,
    };
  }

  if (action === "permit.reject") {
    const permitId = requireString(params, "permitId");
    const reason = requireString(params, "reason");
    const updated = await service.rejectPermit({ ...baseContext, permitId, reason });

    return {
      entityUpdated: { type: "permit", id: permitId },
      publishedEvent: "permit.rejected",
      deepLink: `/projects/${updated.project_id}/permits?permitId=${permitId}`,
    };
  }

  if (action === "permit.renew") {
    const permitId = requireString(params, "permitId");
    const updated = await service.renewPermit({
      ...baseContext,
      permitId,
      expirationDate: optionalString(params, "expirationDate"),
      notes: optionalString(params, "notes"),
    });

    return {
      entityUpdated: { type: "permit", id: permitId },
      publishedEvent: "permit.renewed",
      deepLink: `/projects/${updated.project_id}/permits?permitId=${permitId}`,
    };
  }

  if (action === "permit.close") {
    const permitId = requireString(params, "permitId");
    const updated = await service.closePermit({ ...baseContext, permitId });

    return {
      entityUpdated: { type: "permit", id: permitId },
      publishedEvent: "permit.closed",
      deepLink: `/projects/${updated.project_id}/permits?permitId=${permitId}`,
    };
  }

  if (action === "permit.mark_not_required") {
    const permitId = requireString(params, "permitId");
    const updated = await service.markPermitNotRequired({
      ...baseContext,
      permitId,
      notes: optionalString(params, "notes"),
    });

    return {
      entityUpdated: { type: "permit", id: permitId },
      publishedEvent: "permit.not_required",
      deepLink: `/projects/${updated.project_id}/permits?permitId=${permitId}`,
    };
  }

  if (action === "project.start_closeout") {
    const projectId = requireString(params, "projectId");
    const closeout = await service.startCloseout({
      ...baseContext,
      projectId,
      notes: optionalString(params, "notes"),
    });

    return {
      entityUpdated: { type: "project", id: projectId },
      publishedEvent: "project.closeout_started",
      deepLink: `/projects/${projectId}/closeout?closeoutId=${closeout.id}`,
    };
  }

  if (action === "punch_item.create") {
    const projectId = requireString(params, "projectId");
    const title = requireString(params, "title");
    const created = await service.createPunchItem({
      ...baseContext,
      projectId,
      title,
      description: optionalString(params, "description"),
      location: optionalString(params, "location"),
      priority: optionalString(params, "priority"),
      dueDate: optionalString(params, "dueDate"),
      assignedProfileId: optionalString(params, "assignedProfileId"),
    });

    return {
      entityCreated: { type: "punch_item", id: created.id },
      publishedEvent: "punch_item.created",
      deepLink: `/projects/${projectId}/closeout?punchItemId=${created.id}`,
    };
  }

  if (action === "punch_item.assign") {
    const punchItemId = requireString(params, "punchItemId");
    const assignedProfileId = requireString(params, "assignedProfileId");
    const updated = await service.assignPunchItem({ ...baseContext, punchItemId, assignedProfileId });

    return {
      entityUpdated: { type: "punch_item", id: punchItemId },
      publishedEvent: "punch_item.created",
      deepLink: `/projects/${updated.project_id}/closeout?punchItemId=${punchItemId}`,
    };
  }

  if (action === "punch_item.complete") {
    const punchItemId = requireString(params, "punchItemId");
    const updated = await service.completePunchItem({ ...baseContext, punchItemId });

    return {
      entityUpdated: { type: "punch_item", id: punchItemId },
      publishedEvent: "punch_item.completed",
      deepLink: `/projects/${updated.project_id}/closeout?punchItemId=${punchItemId}`,
    };
  }

  if (action === "punch_item.reopen") {
    const punchItemId = requireString(params, "punchItemId");
    const updated = await service.reopenPunchItem({ ...baseContext, punchItemId, notes: optionalString(params, "notes") });

    return {
      entityUpdated: { type: "punch_item", id: punchItemId },
      publishedEvent: "punch_item.reopened",
      deepLink: `/projects/${updated.project_id}/closeout?punchItemId=${punchItemId}`,
    };
  }

  if (action === "project.record_walkthrough") {
    const projectId = requireString(params, "projectId");
    await service.recordWalkthrough({ ...baseContext, projectId, notes: optionalString(params, "notes") });

    return {
      entityUpdated: { type: "project", id: projectId },
      publishedEvent: "project.walkthrough_completed",
      deepLink: `/projects/${projectId}/closeout`,
    };
  }

  if (action === "project.complete_handover") {
    const projectId = requireString(params, "projectId");
    await service.completeHandover({ ...baseContext, projectId, notes: optionalString(params, "notes") });

    return {
      entityUpdated: { type: "project", id: projectId },
      publishedEvent: "project.handover_completed",
      deepLink: `/projects/${projectId}/closeout`,
    };
  }

  if (action === "project.complete") {
    const projectId = requireString(params, "projectId");
    const exceptionsRaw = Array.isArray(params.exceptions) ? params.exceptions : [];
    const exceptions = exceptionsRaw
      .map((entry) => toRecord(entry))
      .map((entry) => ({ blockerKey: optionalString(entry, "blockerKey") || "", reason: optionalString(entry, "reason") || "" }))
      .filter((entry) => entry.blockerKey && entry.reason);

    const result = await service.completeProject({
      ...baseContext,
      projectId,
      exceptions,
      notes: optionalString(params, "notes"),
      startWarranty: optionalBoolean(params, "startWarranty") ?? false,
      warrantyEndsAt: optionalString(params, "warrantyEndsAt"),
    });

    if (!result.ok) {
      return {
        status: "rejected",
        entityUpdated: { type: "project", id: projectId },
        publishedEvent: "project.closeout_blocked",
        deepLink: result.deepLink,
        userMessage: result.message,
        details: { blockers: result.blockers },
      };
    }

    return {
      entityUpdated: { type: "project", id: projectId },
      publishedEvent: "project.completed",
      deepLink: result.deepLink,
      userMessage: result.message,
    };
  }

  if (action === "project.archive") {
    const projectId = requireString(params, "projectId");
    await service.archiveProject({
      ...baseContext,
      projectId,
      reason: optionalString(params, "reason"),
    });

    return {
      entityUpdated: { type: "project", id: projectId },
      publishedEvent: "project.archived",
      deepLink: `/projects/${projectId}`,
    };
  }

  if (action === "customer_update.create") {
    const projectId = requireString(params, "projectId");
    const message = requireString(params, "message");
    const created = await service.createCommunicationDraft({
      ...baseContext,
      projectId,
      customerId: optionalString(params, "customerId"),
      channel: optionalString(params, "channel") || "email",
      direction: "outbound",
      recipientName: optionalString(params, "recipientName"),
      recipientAddress: optionalString(params, "recipientAddress"),
      subject: optionalString(params, "subject"),
      message,
      metadata: toRecord(params.metadata),
      correlationIdValue: optionalString(params, "correlationId"),
    });

    return {
      entityCreated: { type: "communication", id: created.id },
      publishedEvent: "customer_update.drafted",
      deepLink: `/projects/${projectId}/communications?communicationId=${created.id}`,
    };
  }

  if (action === "customer_update.preview") {
    const communicationId = requireString(params, "communicationId");
    const preview = await service.previewCommunication({ ...baseContext, communicationId });
    return {
      entityUpdated: { type: "communication", id: communicationId },
      publishedEvent: null,
      deepLink: `/projects/${preview.relatedProject}/communications?communicationId=${communicationId}`,
      details: { preview },
    };
  }

  if (action === "customer_update.send") {
    const communicationId = requireString(params, "communicationId");
    const confirmed = optionalBoolean(params, "confirmed") ?? false;
    const result = await service.sendCommunication({ ...baseContext, communicationId, confirmed });

    return {
      status: result.status === "failed" ? "failed" : "completed",
      entityUpdated: { type: "communication", id: communicationId },
      publishedEvent: result.status === "failed" ? "customer_update.failed" : "customer_update.sent",
      userMessage: result.message,
    };
  }

  if (action === "customer_update.cancel") {
    const communicationId = requireString(params, "communicationId");
    const cancelled = await service.cancelCommunication({
      ...baseContext,
      communicationId,
      reason: optionalString(params, "reason"),
    });

    return {
      entityUpdated: { type: "communication", id: communicationId },
      publishedEvent: "customer_update.failed",
      deepLink: `/projects/${cancelled.project_id}/communications?communicationId=${communicationId}`,
    };
  }

  if (action === "customer_update.log_phone_call" || action === "customer_update.log_in_person") {
    const projectId = requireString(params, "projectId");
    const message = requireString(params, "message");
    const channel = action === "customer_update.log_phone_call" ? "phone_note" : "in_person_note";

    const logged = await service.logInboundMessage({
      ...baseContext,
      projectId,
      customerId: optionalString(params, "customerId"),
      channel,
      message,
      recipientName: optionalString(params, "recipientName"),
      recipientAddress: optionalString(params, "recipientAddress"),
      metadata: toRecord(params.metadata),
      correlationIdValue: optionalString(params, "correlationId"),
    });

    return {
      entityCreated: { type: "communication", id: logged.id },
      publishedEvent: "customer_update.logged",
      deepLink: `/projects/${projectId}/communications?communicationId=${logged.id}`,
    };
  }

  throw new Error(`Unknown project execution action: ${action}`);
}

export async function executeProjectExecutionCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  return executeProjectExecutionAction(params, context, deps);
}

export async function executeUnsupportedCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
): Promise<OrionCommandExecutionOutput> {
  const reason = optionalString(params, "reason") || "Command is not yet supported in production.";
  const missingDependency = optionalString(params, "missingDependency") || "Missing production dependency.";

  return {
    status: "unsupported",
    publishedEvent: null,
    deepLink: "/dashboard",
    userMessage: `${context.commandId} is unsupported: ${reason}`,
    warnings: [`Missing dependency: ${missingDependency}`],
    details: {
      reason,
      missingDependency,
      commandId: context.commandId,
    },
  };
}

export async function executeNotYetImplementedCommand(
  _params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
): Promise<OrionCommandExecutionOutput> {
  return {
    publishedEvent: null,
    deepLink: "/dashboard",
    warnings: [`${context.commandId} is registered but not fully implemented in Phase 6A.`],
  };
}
