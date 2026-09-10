import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BosIntelligenceProduct } from "@/lib/billing/intelligence-usage";
import type { Database } from "@/types/database.types";

export type BosIntelligenceUsageEventOutcome =
  | "succeeded"
  | "provider_failed"
  | "bos_failed"
  | "customer_canceled";

type UsageEventInput = {
  companyId: string;
  actorUserId?: string | null;
  product: BosIntelligenceProduct;
  outcome: BosIntelligenceUsageEventOutcome;
  operationKey: string;
  quantity?: number;
  internalNonBillable?: boolean;
  provider?: string | null;
  providerModel?: string | null;
  providerRequestId?: string | null;
  inputUnits?: number | null;
  outputUnits?: number | null;
  totalUnits?: number | null;
  providerCostMicros?: number;
  correlationId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
};

type InternalUsageEventInput = {
  companyId: string;
  product: Extract<BosIntelligenceProduct,
    | "orion_text"
    | "orion_voice"
    | "orion_document"
    | "orion_autonomous_action"
    | "blueprint_native_analysis"
    | "blueprint_3d_reconstruction"
  >;
  operationKey: string;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
};

function optionalUnit(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

/**
 * Best-effort provider telemetry. This path is service-role only and is reserved for
 * external/provider evidence that may later inform cost accounting.
 */
export async function recordBosIntelligenceUsageEvent(input: UsageEventInput) {
  try {
    const admin = createAdminClient();
    // Generated database types intentionally lag the migration until the next type refresh.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;
    const { error } = await db.from("bos_intelligence_usage_events").insert({
      company_id: input.companyId,
      actor_user_id: input.actorUserId || null,
      product: input.product,
      outcome: input.outcome,
      quantity: Math.max(1, Math.ceil(input.quantity ?? 1)),
      internal_non_billable: Boolean(input.internalNonBillable),
      provider: input.provider || null,
      provider_model: input.providerModel || null,
      provider_request_id: input.providerRequestId || null,
      input_units: optionalUnit(input.inputUnits),
      output_units: optionalUnit(input.outputUnits),
      total_units: optionalUnit(input.totalUnits),
      provider_cost_micros: Math.max(0, Math.round(input.providerCostMicros ?? 0)),
      operation_key: input.operationKey,
      correlation_id: input.correlationId || null,
      source_type: input.sourceType || null,
      source_id: input.sourceId || null,
      metadata: input.metadata || {},
    });
    if (error) {
      console.warn("B.O.S. Intelligence provider telemetry was not recorded:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      "B.O.S. Intelligence provider telemetry was not recorded:",
      error instanceof Error ? error.message : "unknown telemetry error",
    );
    return false;
  }
}

/**
 * Reliable authenticated path for native/internal B.O.S. intelligence only.
 * The database RPC independently verifies auth, membership and project ownership and
 * always forces the event to non-billable with zero provider cost.
 */
export async function recordBosInternalIntelligenceUsageEvent(
  supabase: SupabaseClient<Database>,
  input: InternalUsageEventInput,
) {
  try {
    // Generated database types intentionally lag the migration until the next type refresh.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { error } = await db.rpc("record_bos_internal_intelligence_usage_event", {
      p_company_id: input.companyId,
      p_product: input.product,
      p_operation_key: input.operationKey,
      p_source_type: input.sourceType || null,
      p_source_id: input.sourceId || null,
      p_metadata: input.metadata || {},
    });
    if (error) {
      console.warn("B.O.S. internal Intelligence telemetry was not recorded:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      "B.O.S. internal Intelligence telemetry was not recorded:",
      error instanceof Error ? error.message : "unknown telemetry error",
    );
    return false;
  }
}
