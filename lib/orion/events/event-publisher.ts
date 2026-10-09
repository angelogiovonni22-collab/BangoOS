import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { OrionEventInput, OrionEventRecord, OrionPublishResult } from "./event-contracts";
import { createSupabaseOrionEventDeliveryStore, type OrionEventDeliveryStore } from "./event-delivery-store";
import { computeDefaultIdempotencyKey, normalizeIdempotencyKey } from "./event-idempotency";
import { createSupabaseOrionEventStore, type OrionEventStore } from "./event-store";
import { createOrionSubscriberRegistry, type OrionSubscriberRegistry } from "./event-subscribers";
import { validateOrionEventInput } from "./event-validation";

export type OrionEventPublisher = {
  publishEvent: (input: OrionEventInput) => Promise<OrionPublishResult>;
  subscribers: OrionSubscriberRegistry;
};

function asError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

async function dispatchDurably(params: {
  event: OrionEventRecord;
  subscribers: OrionSubscriberRegistry;
  deliveryStore: OrionEventDeliveryStore;
}) {
  const registrations = params.subscribers.list(params.event.event_type);
  const handlers = new Map(registrations.map((registration) => [registration.key, registration.handler]));
  const currentKeys = registrations.map((registration) => registration.key);

  const snapshotKeys = await params.deliveryStore.initializeBatch(params.event, currentKeys);
  const availableSnapshotKeys = snapshotKeys.filter((subscriberKey) => handlers.has(subscriberKey));
  const claimedKeys = await params.deliveryStore.claimPending(
    params.event.event_id,
    availableSnapshotKeys,
  );

  const failures: Error[] = [];

  for (const subscriberKey of claimedKeys) {
    const handler = handlers.get(subscriberKey);
    if (!handler) {
      continue;
    }

    try {
      await handler(params.event);
      await params.deliveryStore.markDelivered(params.event.event_id, subscriberKey);
    } catch (error) {
      const subscriberError = asError(error);
      try {
        await params.deliveryStore.markFailed(
          params.event.event_id,
          subscriberKey,
          subscriberError,
        );
      } catch (deliveryStateError) {
        failures.push(
          new Error(
            `Orion subscriber ${subscriberKey} failed (${subscriberError.message}) and its retry state could not be saved: ${asError(deliveryStateError).message}`,
          ),
        );
        continue;
      }

      failures.push(
        new Error(`Orion subscriber ${subscriberKey} failed: ${subscriberError.message}`),
      );
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, "One or more Orion event subscribers failed.");
  }
}

export function createOrionEventPublisher(params: {
  store: OrionEventStore;
  subscribers?: OrionSubscriberRegistry;
  deliveryStore?: OrionEventDeliveryStore;
}): OrionEventPublisher {
  const subscribers = params.subscribers || createOrionSubscriberRegistry();

  async function dispatch(event: OrionEventRecord) {
    if (params.deliveryStore) {
      await dispatchDurably({
        event,
        subscribers,
        deliveryStore: params.deliveryStore,
      });
      return;
    }

    await subscribers.dispatch(event);
  }

  return {
    subscribers,
    async publishEvent(input) {
      const validation = validateOrionEventInput(input);
      if (!validation.ok) {
        throw new Error(validation.errors.join(" "));
      }

      const idempotencyKey = normalizeIdempotencyKey(input.idempotency_key)
        || computeDefaultIdempotencyKey(input);

      const existing = await params.store.findByIdempotency(
        input.company_id,
        input.event_type,
        idempotencyKey,
      );

      if (existing) {
        await dispatch(existing);
        return {
          event: existing,
          idempotent: true,
        };
      }

      let persisted;
      try {
        persisted = await params.store.append({
          ...input,
          idempotency_key: idempotencyKey,
        });
      } catch (error) {
        // Another request can win the unique-key race after our initial lookup.
        // Recover the committed event so a safe retry is reported as success and
        // replay only any subscriber deliveries that are still incomplete.
        const concurrent = await params.store.findByIdempotency(
          input.company_id,
          input.event_type,
          idempotencyKey,
        );
        if (!concurrent) {
          throw error;
        }

        await dispatch(concurrent);
        return {
          event: concurrent,
          idempotent: true,
        };
      }

      await dispatch(persisted);

      return {
        event: persisted,
        idempotent: false,
      };
    },
  };
}

export function createSupabaseOrionEventPublisher(supabase: SupabaseClient<Database>) {
  const store = createSupabaseOrionEventStore(supabase);
  const deliveryStore = createSupabaseOrionEventDeliveryStore(supabase);
  return createOrionEventPublisher({ store, deliveryStore });
}
