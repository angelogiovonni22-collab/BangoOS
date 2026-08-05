import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { OrionEventInput, OrionEventRecord } from "./event-contracts";
import { resolveEventId } from "./event-idempotency";

type WorkflowEventRow = {
  id: string;
  company_id: string;
  workspace_id: string | null;
  actor_profile_id: string | null;
  event_type: string;
  reference_entity: string;
  reference_id: string | null;
  occurred_at: string;
  version: number;
  source_module: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  correlation_id: string | null;
  causation_id: string | null;
  idempotency_key: string | null;
};

type ProfileScopeRow = {
  id: string;
  company_id: string;
};

type WorkflowEventsSelectBuilder = {
  eq: (column: string, value: string) => WorkflowEventsSelectBuilder;
  maybeSingle: () => Promise<{ data: WorkflowEventRow | null; error: { message?: string } | null }>;
};

type WorkflowEventsReadClient = {
  from: (table: "workflow_events") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => WorkflowEventsSelectBuilder;
    };
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: WorkflowEventRow | null; error: { message?: string } | null }>;
      };
    };
  };
};

type ProfilesReadClient = {
  from: (table: "profiles") => {
    select: (columns: "id, company_id") => {
      eq: (column: "id" | "company_id", value: string) => {
        eq: (column2: "id" | "company_id", value2: string) => {
          maybeSingle: () => Promise<{ data: ProfileScopeRow | null; error: { message?: string } | null }>;
        };
      };
    };
  };
};

function mapRowToRecord(row: WorkflowEventRow): OrionEventRecord {
  return {
    event_id: row.id,
    company_id: row.company_id,
    workspace_id: row.workspace_id,
    actor_profile_id: row.actor_profile_id,
    event_type: row.event_type as OrionEventRecord["event_type"],
    aggregate_type: row.reference_entity as OrionEventRecord["aggregate_type"],
    aggregate_id: row.reference_id || "",
    occurred_at: row.occurred_at,
    version: row.version,
    source_module: (row.source_module || "system") as OrionEventRecord["source_module"],
    payload: row.payload || {},
    metadata: row.metadata || {},
    correlation_id: row.correlation_id,
    causation_id: row.causation_id,
    idempotency_key: row.idempotency_key,
  };
}

function normalizeUuidReference(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(normalized) ? normalized : null;
}

function inferEventCategory(eventType: string) {
  if (eventType.startsWith("customer.")) {
    return "customers";
  }

  if (eventType.startsWith("estimate.")) {
    return "sales";
  }

  if (eventType.startsWith("project.") || eventType.startsWith("change_order.")) {
    return "projects";
  }

  if (eventType.startsWith("inspection.") || eventType.startsWith("permit.") || eventType.startsWith("punch_item.") || eventType.startsWith("warranty.")) {
    return "projects";
  }

  if (eventType.startsWith("invoice.") || eventType.startsWith("payment.") || eventType.startsWith("deposit.") || eventType.startsWith("refund.")) {
    return "finance";
  }

  if (eventType.startsWith("employee.") || eventType.startsWith("crew.")) {
    return "workforce";
  }

  if (eventType.startsWith("task.") || eventType.startsWith("schedule.")) {
    return "scheduling";
  }

  if (eventType.startsWith("daily_report.") || eventType.startsWith("document.")) {
    return "field";
  }

  if (eventType.startsWith("customer_update.") || eventType.startsWith("customer_message.")) {
    return "customers";
  }

  return "system";
}

function inferEventSeverity(eventType: string) {
  if (
    eventType.endsWith(".declined")
    || eventType.endsWith(".rejected")
    || eventType.endsWith(".cancelled")
    || eventType.endsWith(".overdue")
    || eventType.endsWith(".expired")
  ) {
    return "attention";
  }

  if (
    eventType.endsWith(".approved")
    || eventType.endsWith(".paid")
    || eventType.endsWith(".completed")
    || eventType.endsWith(".received")
    || eventType.endsWith(".restored")
  ) {
    return "success";
  }

  return "info";
}

function deepLinkForAggregate(aggregateType: OrionEventInput["aggregate_type"], aggregateId: string) {
  if (aggregateType === "customer") {
    return `/customers/${aggregateId}`;
  }

  if (aggregateType === "estimate") {
    return `/estimates/${aggregateId}`;
  }

  if (aggregateType === "project") {
    return `/projects/${aggregateId}`;
  }

  if (aggregateType === "invoice" || aggregateType === "payment" || aggregateType === "deposit") {
    return `/invoices/${aggregateId}`;
  }

  if (aggregateType === "change_order") {
    return `/change-orders/${aggregateId}`;
  }

  if (aggregateType === "employee") {
    return `/employees/${aggregateId}`;
  }

  if (aggregateType === "crew") {
    return `/crews/${aggregateId}`;
  }

  if (aggregateType === "task") {
    return `/projects`;
  }

  if (aggregateType === "schedule") {
    return `/scheduling`;
  }

  if (aggregateType === "daily_report") {
    return `/daily-reports/${aggregateId}`;
  }

  if (aggregateType === "inspection") {
    return "/projects";
  }

  if (aggregateType === "permit") {
    return "/projects";
  }

  if (aggregateType === "punch_item") {
    return "/projects";
  }

  if (aggregateType === "warranty") {
    return "/projects";
  }

  if (aggregateType === "communication") {
    return "/projects";
  }

  if (aggregateType === "document") {
    return `/projects`;
  }

  if (aggregateType === "decision") {
    return `/dashboard`;
  }

  return "/dashboard";
}

export type OrionEventStore = {
  append: (input: OrionEventInput & { idempotency_key: string; event_id?: string }) => Promise<OrionEventRecord>;
  findByIdempotency: (companyId: string, eventType: string, idempotencyKey: string) => Promise<OrionEventRecord | null>;
  ensureActorScope: (companyId: string, actorProfileId: string | null) => Promise<void>;
};

export function createSupabaseOrionEventStore(supabase: SupabaseClient<Database>): OrionEventStore {
  const workflowDb = supabase as unknown as WorkflowEventsReadClient;
  const profilesDb = supabase as unknown as ProfilesReadClient;

  async function ensureActorScope(companyId: string, actorProfileId: string | null) {
    if (!actorProfileId) {
      return;
    }

    const { data, error } = await profilesDb
      .from("profiles")
      .select("id, company_id")
      .eq("id", actorProfileId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message || "actor_profile_id is outside company scope.");
    }
  }

  async function findByIdempotency(companyId: string, eventType: string, idempotencyKey: string) {
    const { data, error } = await workflowDb
      .from("workflow_events")
      .select("id, company_id, workspace_id, actor_profile_id, event_type, reference_entity, reference_id, occurred_at, version, source_module, payload, metadata, correlation_id, causation_id, idempotency_key")
      .eq("company_id", companyId)
      .eq("event_type", eventType)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Unable to check event idempotency.");
    }

    return data ? mapRowToRecord(data) : null;
  }

  async function append(input: OrionEventInput & { idempotency_key: string; event_id?: string }) {
    await ensureActorScope(input.company_id, input.actor_profile_id);

    const occurredAt = input.occurred_at || new Date().toISOString();
    const category = inferEventCategory(input.event_type);
    const severity = inferEventSeverity(input.event_type);
    const deepLink = deepLinkForAggregate(input.aggregate_type, input.aggregate_id);
    const referenceId = normalizeUuidReference(input.aggregate_id);

    const payload = {
      ...input.payload,
      company_id: input.company_id,
      entity_type: input.aggregate_type,
      entity_id: input.aggregate_id,
      actor_profile_id: input.actor_profile_id,
      occurred_at: occurredAt,
      deep_link: (input.payload.deep_link as string | undefined) || deepLink,
    };

    const metadata = {
      ...input.metadata,
      event_category: (input.metadata?.event_category as string | undefined) || category,
      event_severity: (input.metadata?.event_severity as string | undefined) || severity,
      deep_link: (input.metadata?.deep_link as string | undefined) || deepLink,
    };

    const { data, error } = await workflowDb
      .from("workflow_events")
      .insert({
        id: resolveEventId(input.event_id),
        company_id: input.company_id,
        workflow_name: `${input.aggregate_type}_lifecycle`,
        event_type: input.event_type,
        current_state: null,
        next_state: null,
        actor_profile_id: input.actor_profile_id,
        reference_entity: input.aggregate_type,
        reference_id: referenceId,
        occurred_at: occurredAt,
        version: input.version ?? 1,
        source_module: input.source_module,
        payload,
        metadata,
        correlation_id: input.correlation_id || null,
        causation_id: input.causation_id || null,
        idempotency_key: input.idempotency_key,
        workspace_id: input.workspace_id || null,
      })
      .select("id, company_id, workspace_id, actor_profile_id, event_type, reference_entity, reference_id, occurred_at, version, source_module, payload, metadata, correlation_id, causation_id, idempotency_key")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Unable to persist Orion event.");
    }

    return mapRowToRecord(data);
  }

  return {
    append,
    findByIdempotency,
    ensureActorScope,
  };
}
