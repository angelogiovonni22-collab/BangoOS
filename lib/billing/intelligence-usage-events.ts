import { createAdminClient } from "@/lib/supabase/admin";
import type { BosIntelligenceProduct } from "@/lib/billing/intelligence-usage";

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

function optionalUnit(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

/**
 * Best-effort, non-settling provider telemetry.
 * This function intentionally never throws so telemetry cannot break an Orion or Blueprint workflow.
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
      console.warn("B.O.S. Intelligence usage telemetry was not recorded:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      "B.O.S. Intelligence usage telemetry was not recorded:",
      error instanceof Error ? error.message : "unknown telemetry error",
    );
    return false;
  }
}
