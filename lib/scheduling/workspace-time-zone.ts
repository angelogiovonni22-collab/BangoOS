import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { resolveScheduleTimeZone } from "./time-zone";

export async function loadScheduleTimeZone(supabase: SupabaseClient<Database>, companyId: string): Promise<string> {
  const { data, error } = await supabase.from("companies").select("timezone").eq("id", companyId).maybeSingle();
  if (error) throw new Error(error.message || "Unable to load the company scheduling time zone.");
  if (!data) throw new Error("The scheduling company could not be found.");
  return resolveScheduleTimeZone(data.timezone);
}
