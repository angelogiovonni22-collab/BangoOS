import type { SupabaseClient } from "@supabase/supabase-js";

// Phase 6 RPC/table types are migration-backed until the next generated-type refresh.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export type OperationalWorkStartDecision = {
  decision: "ALLOWED" | "BLOCKED";
  projectId: string | null;
  estimateId: string;
  changeOrderId: string | null;
  blockerCode: string | null;
  blockerMessage: string | null;
};

export class OperationalWorkStartBlockedError extends Error {
  readonly code = "OPERATIONAL_WORK_START_BLOCKED";
  readonly decision: OperationalWorkStartDecision;

  constructor(decision: OperationalWorkStartDecision) {
    super(decision.blockerMessage || "Work start is blocked by compliance.");
    this.name = "OperationalWorkStartBlockedError";
    this.decision = decision;
  }
}

type AuthorizationInput = {
  companyId: string;
  estimateId: string;
  changeOrderId?: string | null;
  actorProfileId: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

function normalizeDecision(value: unknown, input: AuthorizationInput): OperationalWorkStartDecision {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const decision = row.decision === "ALLOWED" ? "ALLOWED" : "BLOCKED";

  return {
    decision,
    projectId: typeof row.projectId === "string" ? row.projectId : null,
    estimateId: typeof row.estimateId === "string" ? row.estimateId : input.estimateId,
    changeOrderId: typeof row.changeOrderId === "string" ? row.changeOrderId : input.changeOrderId || null,
    blockerCode: typeof row.blockerCode === "string" ? row.blockerCode : null,
    blockerMessage: typeof row.blockerMessage === "string" ? row.blockerMessage : null,
  };
}

export async function evaluateOperationalWorkStart(db: AnySupabase, input: AuthorizationInput) {
  const { data, error } = await db.rpc("get_operational_work_start_decision", {
    p_company_id: input.companyId,
    p_estimate_id: input.estimateId,
    p_change_order_id: input.changeOrderId || null,
  });

  if (error) {
    throw new Error(error.message || "Unable to evaluate operational work-start compliance.");
  }

  return normalizeDecision(data, input);
}

export async function recordOperationalWorkStartDecision(
  db: AnySupabase,
  input: AuthorizationInput,
  decision: OperationalWorkStartDecision,
) {
  const { error } = await db.from("operational_work_start_authorizations").insert({
    company_id: input.companyId,
    project_id: decision.projectId,
    estimate_id: input.estimateId,
    change_order_id: input.changeOrderId || null,
    action_type: input.changeOrderId ? "change_order_work_start" : "project_work_start",
    decision: decision.decision,
    blocker_code: decision.blockerCode,
    blocker_message: decision.blockerMessage,
    source: input.source || "operational_work_start",
    actor_profile_id: input.actorProfileId,
    metadata: input.metadata || {},
  });

  if (error) {
    throw new Error(error.message || "Unable to preserve work-start authorization evidence.");
  }
}

export async function authorizeOperationalWorkStart(db: AnySupabase, input: AuthorizationInput) {
  const decision = await evaluateOperationalWorkStart(db, input);
  await recordOperationalWorkStartDecision(db, input, decision);

  if (decision.decision !== "ALLOWED") {
    throw new OperationalWorkStartBlockedError(decision);
  }

  return decision;
}
