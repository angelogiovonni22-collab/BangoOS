import { localCalendarDate } from "../dates/calendar-date";

type RetryOperation = { id: string; receivedDate: string };
type RetryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const pending = new Map<string, RetryOperation>();

function browserStorage(): RetryStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.sessionStorage; }
  catch { return undefined; }
}

/** Keep the same operation after a lost response or failed overview refresh. */
export function fulfillmentOperation(
  companyId: string, userId: string, kind: "receive" | "allocate", input: object,
  date = new Date(), storage = browserStorage(), newId: () => string = () => crypto.randomUUID(),
) {
  const key = `bos:fulfillment:${companyId}:${userId}:${kind}:${JSON.stringify(input)}`;
  let operation = pending.get(key);
  if (!operation) {
    try {
      const stored = JSON.parse(storage?.getItem(key) || "null") as RetryOperation | null;
      if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored.id)
          && /^\d{4}-\d{2}-\d{2}$/.test(stored.receivedDate)) operation = stored;
    } catch { /* Storage failure still allows an in-memory retry. */ }
  }
  operation ??= { id: newId(), receivedDate: localCalendarDate(date) };
  pending.set(key, operation);
  try { storage?.setItem(key, JSON.stringify(operation)); } catch { /* Keep memory fallback. */ }
  return {
    ...operation,
    complete() {
      pending.delete(key);
      try { storage?.removeItem(key); } catch { /* No business writes depend on browser storage. */ }
    },
  };
}
