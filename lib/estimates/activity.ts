import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type EstimateActivity = Pick<Database["public"]["Tables"]["workflow_events"]["Row"], "id" | "event_type" | "occurred_at" | "current_state" | "next_state" | "payload">;

export async function loadEstimateActivity(supabase: SupabaseClient<Database>, companyId: string, estimateId: string) {
  return supabase.from("workflow_events")
    .select("id,event_type,occurred_at,current_state,next_state,payload")
    .eq("company_id", companyId)
    .eq("reference_entity", "estimate")
    .eq("reference_id", estimateId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
}

export function estimateActivityLabel(event: EstimateActivity) {
  const payload = event.payload;
  if (event.event_type === "estimate.expired" && payload && typeof payload === "object" && !Array.isArray(payload) && typeof payload.archived_at === "string") return "Estimate archived";
  return event.event_type.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
