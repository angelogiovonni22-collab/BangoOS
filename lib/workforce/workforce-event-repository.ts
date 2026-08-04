import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import type { WorkforceEventInput } from "./workforce-types";

export type WorkforceEventRepository = {
  recordEvent: (input: WorkforceEventInput) => Promise<void>;
};

export function createWorkforceEventRepository(supabase: SupabaseClient<Database>): WorkforceEventRepository {
  const orion = createSupabaseOrionEventPublisher(supabase);

  const resolveOrionEventType = (eventType: WorkforceEventInput["eventType"]) => {
    switch (eventType) {
      case "workforce.employee.created":
        return "employee.created" as const;
      case "workforce.employee.updated":
      case "workforce.employee.archived":
        return "employee.updated" as const;
      case "workforce.crew.created":
        return "crew.created" as const;
      case "workforce.crew.updated":
        return "crew.updated" as const;
      case "workforce.crew_membership.added":
      case "workforce.crew_membership.updated":
      case "workforce.crew_membership.ended":
        return "crew.assigned" as const;
      default:
        return null;
    }
  };

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

      const orionEventType = resolveOrionEventType(input.eventType);
      if (!orionEventType) {
        return;
      }

      await orion.publishEvent({
        company_id: input.companyId,
        actor_profile_id: input.actorProfileId,
        event_type: orionEventType,
        aggregate_type: input.entityType === "employee"
          ? "employee"
          : input.entityType === "crew"
            ? "crew"
            : "crew",
        aggregate_id: input.entityId,
        source_module: "workforce",
        payload: {
          workforce_event_type: input.eventType,
          workforce_action: input.action,
          ...input.payload,
        },
        metadata: {
          workflow_name: "workforce_lifecycle",
        },
      });
    },
  };
}
