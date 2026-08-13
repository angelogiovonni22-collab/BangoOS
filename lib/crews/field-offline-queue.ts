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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the field operations queue."));
  });
}

function runTransaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to access the field operations queue."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  }));
}

function createQueueId(): string {
  return typeof crypto.randomUUID === "function"
    ? `field-${crypto.randomUUID()}`
    : `field-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type StoredOfflineQueueItem = OfflineQueueItem & { scopeKey: string };

export function createBrowserFieldOfflineProviders(resolveScope: () => Promise<{ companyId: string; userId: string }>): { queue: OfflineQueueProvider; sync: OfflineSyncProvider } {
  let cachedScopeKey: string | null = null;
  const getScopeKey = async () => {
    if (cachedScopeKey) return cachedScopeKey;
    const scope = await resolveScope();
    cachedScopeKey = `${scope.companyId}:${scope.userId}`;
    return cachedScopeKey;
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
