import type { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { OfflineQueueItem, OfflineQueueProvider, OfflineSyncProvider } from "./mobile-field-operations-types";

const DATABASE_NAME = "bango-field-operations";
const STORE_NAME = "offline-actions";
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error ?? new Error("Unable to open the field operations queue."));
    request.onblocked = () => reject(new Error("Field operations storage is blocked by another open session."));
  });
}

function runTransaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    let result!:T;
    request.onsuccess = () => { result=request.result; };
    request.onerror = () => reject(request.error ?? new Error("Unable to access the field operations queue."));
    transaction.oncomplete = () => { database.close(); resolve(result); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Unable to commit the field operations queue transaction.")); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error("Field operations queue transaction was cancelled.")); };
  }));
}

function createQueueId(): string {
  return typeof crypto.randomUUID === "function"
    ? `field-${crypto.randomUUID()}`
    : `field-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type StoredOfflineQueueItem = OfflineQueueItem & { scopeKey: string };

export type FieldOfflineScope = { companyId: string; userId: string };

export async function resolveBrowserFieldQueueScope(client: ReturnType<typeof createClient>, previousScope?: FieldOfflineScope): Promise<FieldOfflineScope> {
  if (typeof navigator !== "undefined" && !navigator.onLine && previousScope && client) {
    // Cached session identity only partitions local device data. Server writes
    // still require the service's verified workspace and database authorization.
    const { data, error } = await client.auth.getSession();
    if (!error && data.session?.user.id === previousScope.userId) return previousScope;
    throw new Error("Sign in again before opening saved field actions on this device.");
  }
  const result = await resolveWorkspaceContext(client);
  if (!result.context) throw new Error(result.errorMessage || "Unable to verify access to saved field actions.");
  return { companyId: result.context.companyId, userId: result.context.userId };
}

export function createBrowserFieldOfflineProviders(resolveScope: (previousScope?: FieldOfflineScope) => Promise<FieldOfflineScope>): { queue: OfflineQueueProvider; sync: OfflineSyncProvider } {
  let previousScope: FieldOfflineScope | undefined;
  let scopeRequest: Promise<string> | null = null;
  const getScopeKey = async () => {
    if (scopeRequest) return scopeRequest;
    scopeRequest = (async () => {
      const scope = await resolveScope(previousScope);
      if (!scope.companyId || !scope.userId) throw new Error("Unable to verify access to saved field actions.");
      previousScope = scope;
      return `${scope.companyId}:${scope.userId}`;
    })();
    try {
      return await scopeRequest;
    } finally {
      scopeRequest = null;
    }
  };
  const queue: OfflineQueueProvider = {
    async enqueue(input) {
      const item: StoredOfflineQueueItem = {
        ...input,
        id: createQueueId(),
        createdAt: new Date().toISOString(),
        status: "queued",
        scopeKey: await getScopeKey(),
      };
      await runTransaction("readwrite", (store) => store.put(item));
      return item;
    },
    async list() {
      const scopeKey = await getScopeKey();
      const items = await runTransaction("readonly", (store) => store.getAll()) as StoredOfflineQueueItem[];
      return items.filter((item) => item.scopeKey === scopeKey).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async setStatus(id, status) {
      const scopeKey = await getScopeKey();
      const existing = await runTransaction("readonly", (store) => store.get(id)) as StoredOfflineQueueItem | undefined;
      if (existing?.scopeKey === scopeKey) await runTransaction("readwrite", (store) => store.put({ ...existing, status }));
    },
    async remove(id) {
      const scopeKey = await getScopeKey();
      const existing = await runTransaction("readonly", (store) => store.get(id)) as StoredOfflineQueueItem | undefined;
      if (existing?.scopeKey === scopeKey) await runTransaction("readwrite", (store) => store.delete(id));
    },
  };

  return {
    queue,
    sync: {
      async getStatus() {
        const items = await queue.list();
        const pending = items.some((item) => item.status === "queued");
        const latestSynced = items.find((item) => item.status === "synced")?.createdAt ?? null;
        return { state: pending ? "pending" : "idle", lastSyncedAt: latestSynced };
      },
    },
  };
}
