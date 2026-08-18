import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { OrionCommandHistoryRecord } from "./types";

type WorkflowHistoryRow = {
  id: string;
  company_id: string;
  actor_profile_id: string | null;
  occurred_at: string;
  correlation_id: string | null;
  idempotency_key: string | null;
  payload: Record<string, unknown>;
};

type WorkflowHistoryQueryResult = {
  data: WorkflowHistoryRow[] | null;
  error: { message?: string } | null;
};

type WorkflowHistoryQueryBuilder = {
  eq: (column: string, value: unknown) => WorkflowHistoryQueryBuilder;
  order: (column: string, options: { ascending: boolean }) => WorkflowHistoryQueryBuilder;
  limit: (count: number) => Promise<WorkflowHistoryQueryResult>;
};

type LooseWorkflowHistoryClient = {
  from: (table: string) => {
    select: (columns: string) => WorkflowHistoryQueryBuilder;
  };
};

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readBoolean(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "boolean" ? value : false;
}

function readNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringArray(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function mapHistoryRow(row: WorkflowHistoryRow) {
  const payload = row.payload || {};
  return {
    eventId: row.id,
    commandId: readString(payload, "command_id") || "unknown",
    commandName: readString(payload, "command_name") || "Unknown command",
    companyId: row.company_id,
    actorProfileId: row.actor_profile_id,
    occurredAt: row.occurred_at,
    durationMs: readNumber(payload, "duration_ms"),
    success: readBoolean(payload, "success"),
    failure: readString(payload, "failure"),
    validationErrors: readStringArray(payload, "validation_errors"),
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
    payload,
  };
}

export async function recordOrionCommandHistory(
  supabase: SupabaseClient<Database>,
  input: OrionCommandHistoryRecord,
) {
  const publisher = createSupabaseOrionEventPublisher(supabase);
  const result = await publisher.publishEvent({
    company_id: input.companyId,
    actor_profile_id: input.actorProfileId,
    event_type: "workflow.executed",
    aggregate_type: "workflow",
    aggregate_id: input.referenceId || input.commandId,
    source_module: "workflows",
    occurred_at: input.occurredAt,
    correlation_id: input.correlationId,
    idempotency_key: input.idempotencyKey,
    payload: {
      command_id: input.commandId,
      command_name: input.commandName,
      success: input.success,
      failure: input.failure,
      duration_ms: input.durationMs,
      validation_errors: input.validationErrors,
      ...input.payload,
    },
    metadata: {
      event_category: "system",
      event_severity: input.success ? "success" : "attention",
      deep_link: "/dashboard",
      command_history: true,
    },
  });

  return result.event.event_id;
}

export async function findOrionCommandHistoryByIdempotency(
  supabase: SupabaseClient<Database>,
  companyId: string,
  idempotencyKey: string,
) {
  const db = supabase as unknown as LooseWorkflowHistoryClient;
  const { data, error } = await db
    .from("workflow_events")
    .select("id, company_id, actor_profile_id, occurred_at, correlation_id, idempotency_key, payload")
    .eq("company_id", companyId)
    .eq("event_type", "workflow.executed")
    .eq("idempotency_key", idempotencyKey)
    .order("occurred_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message || "Unable to check Orion command history.");
  const row = data?.[0] ?? null;
  return row ? mapHistoryRow(row) : null;
}

export async function listOrionCommandHistory(
  supabase: SupabaseClient<Database>,
  companyId: string,
  limit = 100,
) {
  const db = supabase as unknown as LooseWorkflowHistoryClient;

  const { data, error } = await db
    .from("workflow_events")
    .select("id, company_id, actor_profile_id, occurred_at, correlation_id, idempotency_key, payload")
    .eq("company_id", companyId)
    .eq("event_type", "workflow.executed")
    .eq("reference_entity", "workflow")
    .order("occurred_at", { ascending: false })
    .limit(Math.max(1, Math.min(500, limit)));

  if (error) throw new Error(error.message || "Unable to load Orion command history.");
  return (data ?? []).map(mapHistoryRow).filter((row) => Boolean(row.commandId));
}
