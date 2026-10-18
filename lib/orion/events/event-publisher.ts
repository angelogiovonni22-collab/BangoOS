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

async function dispatchWithDeliveryTracking(params: {
  event: OrionEventRecord;
  subscribers: OrionSubscriberRegistry;
  deliveryStore: OrionEventDeliveryStore;
}) {
  for (const subscriber of params.subscribers.list(params.event.event_type)) {
    const claim = await params.deliveryStore.claim(params.event, subscriber.key);

    if (claim === "delivered" || claim === "leased") {
      continue;
    }

    try {
      await subscriber.handler(params.event);
      await params.deliveryStore.markDelivered(params.event, subscriber.key);
    } catch (error) {
      try {
        await params.deliveryStore.markFailed(params.event, subscriber.key, error);
      } catch (deliveryError) {
        throw new AggregateError(
          [error, deliveryError],
          `Orion subscriber ${subscriber.key} failed and delivery state could not be recorded.`,
        );
      }
      throw error;
    }
  }
}

export function createOrionEventPublisher(params: {
  store: OrionEventStore;
  subscribers?: OrionSubscriberRegistry;
  deliveryStore?: OrionEventDeliveryStore;
}): OrionEventPublisher {
  const subscribers = params.subscribers || createOrionSubscriberRegistry();

  async function dispatchPersisted(event: OrionEventRecord) {
    if (params.deliveryStore) {
      await dispatchWithDeliveryTracking({
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
        if (params.deliveryStore) {
          await dispatchPersisted(existing);
        }
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
        // Recover the committed event so a safe retry is reported as success.
        const concurrent = await params.store.findByIdempotency(
          input.company_id,
          input.event_type,
          idempotencyKey,
        );
        if (!concurrent) {
          throw error;
        }

        if (params.deliveryStore) {
          await dispatchPersisted(concurrent);
        }

        return {
          event: concurrent,
          idempotent: true,
        };
      }

      await dispatchPersisted(persisted);

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
