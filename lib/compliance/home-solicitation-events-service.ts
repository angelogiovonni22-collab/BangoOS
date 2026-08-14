import type { SupabaseClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export type HomeSolicitationEventType =
  | "profile_checked" | "notice_prepared" | "notice_delivered" | "oral_disclosure_confirmed"
  | "contract_signed" | "cancellation_received" | "work_hold_created" | "work_hold_released";

export async function recordHomeSolicitationEvent(db: AnySupabase, input: {
  companyId: string;
  estimateId: string;
  eventType: HomeSolicitationEventType;
  actorType?: "system" | "customer" | "company_user";
  actorProfileId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await db.from("estimate_home_solicitation_events").insert({
    company_id: input.companyId,
    estimate_id: input.estimateId,
    event_type: input.eventType,
    actor_type: input.actorType || "system",
    actor_profile_id: input.actorProfileId || null,
    metadata: input.metadata || {},
  });
  if (error) throw new Error(error.message || "Unable to preserve home-solicitation compliance event.");
}
