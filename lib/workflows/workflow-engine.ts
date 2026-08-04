import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  WorkflowTransitionInput,
  WorkflowTransitionResult,
} from "./types";

export type WorkflowEngine = {
  recordTransition: (input: WorkflowTransitionInput) => Promise<WorkflowTransitionResult>;
};

export function createWorkflowEngine(supabase: SupabaseClient<Database>): WorkflowEngine {
  type WorkflowInsertClient = {
    from: (table: "workflow_events") => {
      insert: (payload: Record<string, unknown>) => {
        select: (columns: "id") => {
          single: () => Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
        };
      };
    };
  };

  const db = supabase as unknown as WorkflowInsertClient;

  return {
    async recordTransition(input) {
      const { data, error } = await db
        .from("workflow_events")
        .insert({
          company_id: input.companyId,
          workflow_name: input.workflowName,
          event_type: input.eventType,
          current_state: input.currentState,
          next_state: input.nextState,
          actor_profile_id: input.actorProfileId,
          reference_entity: input.referenceEntity,
          reference_id: input.referenceId,
          occurred_at: input.occurredAt || new Date().toISOString(),
          metadata: input.metadata || {},
        })
        .select("id")
        .single();

      if (error || !data?.id) {
        throw new Error(error?.message || "Unable to record workflow transition.");
      }

      return { eventId: data.id as string };
    },
  };
}
