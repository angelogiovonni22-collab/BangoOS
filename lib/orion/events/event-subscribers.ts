import type { OrionEventRecord } from "./event-contracts";
import type { OrionEventType } from "./event-types";

export type OrionEventSubscriber = (event: OrionEventRecord) => Promise<void> | void;

export type OrionSubscriberRegistry = {
  register: (eventType: OrionEventType, handler: OrionEventSubscriber) => () => void;
  unregister: (eventType: OrionEventType, handler: OrionEventSubscriber) => void;
  dispatch: (event: OrionEventRecord) => Promise<void>;
};

export function createOrionSubscriberRegistry(): OrionSubscriberRegistry {
  const byType = new Map<OrionEventType, OrionEventSubscriber[]>();

  function register(eventType: OrionEventType, handler: OrionEventSubscriber) {
    const existing = byType.get(eventType) || [];
    byType.set(eventType, [...existing, handler]);

    return () => {
      unregister(eventType, handler);
    };
  }

  function unregister(eventType: OrionEventType, handler: OrionEventSubscriber) {
    const existing = byType.get(eventType) || [];
    byType.set(
      eventType,
      existing.filter((registered) => registered !== handler),
    );
  }

  async function dispatch(event: OrionEventRecord) {
    const handlers = byType.get(event.event_type) || [];

    for (const handler of handlers) {
      await handler(event);
    }
  }

  return {
    register,
    unregister,
    dispatch,
  };
}
