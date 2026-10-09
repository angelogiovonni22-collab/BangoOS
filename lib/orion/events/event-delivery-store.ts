import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { OrionEventRecord } from "./event-contracts";

export type OrionEventDeliveryStore = {
  initializeBatch: (event: OrionEventRecord, subscriberKeys: string[]) => Promise<string[]>;
  claimPending: (eventId: string, subscriberKeys: string[], leaseSeconds?: number) => Promise<string[]>;
  markDelivered: (eventId: string, subscriberKey: string) => Promise<void>;
  markFailed: (eventId: string, subscriberKey: string, error: unknown) => Promise<void>;
};

type RpcError = { message?: string } | null;

type OrionDeliveryRpcClient = {
  rpc: (
    functionName:
      | "initialize_workflow_event_delivery_batch"
      | "claim_workflow_event_deliveries"
      | "complete_workflow_event_delivery"
      | "fail_workflow_event_delivery",
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: RpcError }>;
};

function normalizeSubscriberKeys(subscriberKeys: string[]) {
  return Array.from(
    new Set(
      subscriberKeys
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ).sort();
}

function normalizeReturnedKeys(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      if (typeof row === "string") {
        return row;
      }

      if (row && typeof row === "object" && "subscriber_key" in row) {
        const value = (row as { subscriber_key?: unknown }).subscriber_key;
        return typeof value === "string" ? value : "";
      }

      return "";
    })
    .map((key) => key.trim())
    .filter(Boolean);
}

function deliveryErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Subscriber delivery failed.";
  }
}

export function createSupabaseOrionEventDeliveryStore(
  supabase: SupabaseClient<Database>,
): OrionEventDeliveryStore {
  const db = supabase as unknown as OrionDeliveryRpcClient;

  async function initializeBatch(event: OrionEventRecord, subscriberKeys: string[]) {
    const { data, error } = await db.rpc("initialize_workflow_event_delivery_batch", {
      p_event_id: event.event_id,
      p_subscriber_keys: normalizeSubscriberKeys(subscriberKeys),
    });

    if (error) {
      throw new Error(error.message || "Unable to initialize Orion event delivery state.");
    }

    return normalizeReturnedKeys(data);
  }

  async function claimPending(eventId: string, subscriberKeys: string[], leaseSeconds = 60) {
    const normalizedKeys = normalizeSubscriberKeys(subscriberKeys);
    if (normalizedKeys.length === 0) {
      return [];
    }

    const { data, error } = await db.rpc("claim_workflow_event_deliveries", {
      p_event_id: eventId,
      p_subscriber_keys: normalizedKeys,
      p_lease_seconds: leaseSeconds,
    });

    if (error) {
      throw new Error(error.message || "Unable to claim Orion event deliveries.");
    }

    return normalizeReturnedKeys(data);
  }

  async function markDelivered(eventId: string, subscriberKey: string) {
    const { error } = await db.rpc("complete_workflow_event_delivery", {
      p_event_id: eventId,
      p_subscriber_key: subscriberKey,
    });

    if (error) {
      throw new Error(error.message || "Unable to complete Orion event delivery.");
    }
  }

  async function markFailed(eventId: string, subscriberKey: string, errorValue: unknown) {
    const { error } = await db.rpc("fail_workflow_event_delivery", {
      p_event_id: eventId,
      p_subscriber_key: subscriberKey,
      p_error: deliveryErrorMessage(errorValue),
    });

    if (error) {
      throw new Error(error.message || "Unable to record Orion event delivery failure.");
    }
  }

  return {
    initializeBatch,
    claimPending,
    markDelivered,
    markFailed,
  };
}
