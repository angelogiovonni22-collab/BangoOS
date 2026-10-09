import type { OrionEventRecord } from "./event-contracts";
import type { OrionEventType } from "./event-types";

export type OrionEventSubscriber = (event: OrionEventRecord) => Promise<void> | void;

export type OrionSubscriberRegistration = {
  key: string;
  handler: OrionEventSubscriber;
};

export type OrionSubscriberRegistry = {
  register: (eventType: OrionEventType, subscriberKey: string, handler: OrionEventSubscriber) => () => void;
  unregister: (eventType: OrionEventType, subscriberKey: string) => void;
  list: (eventType: OrionEventType) => OrionSubscriberRegistration[];
  dispatch: (event: OrionEventRecord) => Promise<void>;
};

function normalizeSubscriberKey(subscriberKey: string) {
  const normalized = subscriberKey.trim();
  if (!normalized) {
    throw new Error("Orion subscriber key is required.");
  }
  return normalized;
}

export function createOrionSubscriberRegistry(): OrionSubscriberRegistry {
  const byType = new Map<OrionEventType, OrionSubscriberRegistration[]>();

  function register(
    eventType: OrionEventType,
    subscriberKey: string,
    handler: OrionEventSubscriber,
  ) {
    const key = normalizeSubscriberKey(subscriberKey);
    const existing = byType.get(eventType) || [];

    if (existing.some((registration) => registration.key === key)) {
      throw new Error(`Orion subscriber key already registered for ${eventType}: ${key}`);
    }

    byType.set(eventType, [...existing, { key, handler }]);

    return () => {
      unregister(eventType, key);
    };
  }

  function unregister(eventType: OrionEventType, subscriberKey: string) {
    const key = normalizeSubscriberKey(subscriberKey);
    const existing = byType.get(eventType) || [];
    byType.set(
      eventType,
      existing.filter((registration) => registration.key !== key),
    );
  }

  function list(eventType: OrionEventType) {
    return [...(byType.get(eventType) || [])];
  }

  async function dispatch(event: OrionEventRecord) {
    const registrations = list(event.event_type);

    for (const registration of registrations) {
      await registration.handler(event);
    }
  }

  return {
    register,
    unregister,
    list,
    dispatch,
  };
}
