import type { OrionEventRecord } from "./event-contracts";
import type { OrionEventType } from "./event-types";

export type OrionEventSubscriber = (event: OrionEventRecord) => Promise<void> | void;

export type OrionRegisteredSubscriber = {
  key: string;
  handler: OrionEventSubscriber;
};

export type OrionSubscriberRegistry = {
  register: (eventType: OrionEventType, key: string, handler: OrionEventSubscriber) => () => void;
  unregister: (eventType: OrionEventType, key: string) => void;
  list: (eventType: OrionEventType) => OrionRegisteredSubscriber[];
  dispatch: (event: OrionEventRecord) => Promise<void>;
};

export function createOrionSubscriberRegistry(): OrionSubscriberRegistry {
  const byType = new Map<OrionEventType, OrionRegisteredSubscriber[]>();

  function register(eventType: OrionEventType, key: string, handler: OrionEventSubscriber) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      throw new Error("Orion subscriber key is required.");
    }

    const existing = byType.get(eventType) || [];
    if (existing.some((registered) => registered.key === normalizedKey)) {
      throw new Error(`Orion subscriber key already registered for ${eventType}: ${normalizedKey}`);
    }

    byType.set(eventType, [...existing, { key: normalizedKey, handler }]);

    return () => {
      unregister(eventType, normalizedKey);
    };
  }

  function unregister(eventType: OrionEventType, key: string) {
    const existing = byType.get(eventType) || [];
    byType.set(
      eventType,
      existing.filter((registered) => registered.key !== key),
    );
  }

  function list(eventType: OrionEventType) {
    return [...(byType.get(eventType) || [])];
  }

  async function dispatch(event: OrionEventRecord) {
    for (const { handler } of list(event.event_type)) {
      await handler(event);
    }
  }

  return {
    register,
    unregister,
    list,
    dispatch,
  };
}
