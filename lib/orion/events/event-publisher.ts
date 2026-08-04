import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { OrionEventInput, OrionPublishResult } from "./event-contracts";
import { computeDefaultIdempotencyKey, normalizeIdempotencyKey } from "./event-idempotency";
import { createSupabaseOrionEventStore, type OrionEventStore } from "./event-store";
import { createOrionSubscriberRegistry, type OrionSubscriberRegistry } from "./event-subscribers";
import { validateOrionEventInput } from "./event-validation";

export type OrionEventPublisher = {
  publishEvent: (input: OrionEventInput) => Promise<OrionPublishResult>;
  subscribers: OrionSubscriberRegistry;
};

export function createOrionEventPublisher(params: {
  store: OrionEventStore;
  subscribers?: OrionSubscriberRegistry;
}): OrionEventPublisher {
  const subscribers = params.subscribers || createOrionSubscriberRegistry();

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
        return {
          event: existing,
          idempotent: true,
        };
      }

      const persisted = await params.store.append({
        ...input,
        idempotency_key: idempotencyKey,
      });

      await subscribers.dispatch(persisted);

      return {
        event: persisted,
        idempotent: false,
      };
    },
  };
}

export function createSupabaseOrionEventPublisher(supabase: SupabaseClient<Database>) {
  const store = createSupabaseOrionEventStore(supabase);
  return createOrionEventPublisher({ store });
}
