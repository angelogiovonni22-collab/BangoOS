import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { WorkforceEventInput } from "./workforce-types";

export type WorkforceEventRepository = {
  recordEvent: (input: WorkforceEventInput) => Promise<void>;
};

export function createWorkforceEventRepository(supabase: SupabaseClient<Database>): WorkforceEventRepository {
  return {
    async recordEvent(input) {
      const { error } = await supabase
        .from("workforce_events")
        .insert({
          company_id: input.companyId,
          event_type: input.eventType,
          entity_type: input.entityType,
          entity_id: input.entityId,
          action: input.action,
          actor_profile_id: input.actorProfileId,
          payload: input.payload as Database["public"]["Tables"]["workforce_events"]["Insert"]["payload"],
        });

      if (error) {
        throw error;
      }
    },
  };
}
