import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { OrionEventRecord } from "./event-contracts";

export type OrionDeliveryClaim = "claimed" | "delivered" | "leased";

export type OrionEventDeliveryStore = {
  claim: (event: OrionEventRecord, subscriberKey: string) => Promise<OrionDeliveryClaim>;
  markDelivered: (event: OrionEventRecord, subscriberKey: string) => Promise<void>;
  markFailed: (event: OrionEventRecord, subscriberKey: string, error: unknown) => Promise<void>;
};

type DeliveryRpcClient = {
  rpc: (
    fn: "claim_orion_event_delivery" | "complete_orion_event_delivery" | "fail_orion_event_delivery",
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function createSupabaseOrionEventDeliveryStore(
  supabase: SupabaseClient<Database>,
): OrionEventDeliveryStore {
  const db = supabase as unknown as DeliveryRpcClient;

  return {
    async claim(event, subscriberKey) {
      const { data, error } = await db.rpc("claim_orion_event_delivery", {
        p_company_id: event.company_id,
        p_event_id: event.event_id,
        p_subscriber_key: subscriberKey,
      });

      if (error) {
        throw new Error(error.message || "Unable to claim Orion event delivery.");
      }

      if (data !== "claimed" && data !== "delivered" && data !== "leased") {
        throw new Error("Unexpected Orion event delivery claim state.");
      }

      return data;
    },

    async markDelivered(event, subscriberKey) {
      const { error } = await db.rpc("complete_orion_event_delivery", {
        p_company_id: event.company_id,
        p_event_id: event.event_id,
        p_subscriber_key: subscriberKey,
      });

      if (error) {
        throw new Error(error.message || "Unable to complete Orion event delivery.");
      }
    },

    async markFailed(event, subscriberKey, cause) {
      const { error } = await db.rpc("fail_orion_event_delivery", {
        p_company_id: event.company_id,
        p_event_id: event.event_id,
        p_subscriber_key: subscriberKey,
        p_error: errorMessage(cause).slice(0, 4000),
      });

      if (error) {
        throw new Error(error.message || "Unable to record Orion event delivery failure.");
      }
    },
  };
}
