export type FieldPhotoCategory = "progress" | "safety" | "damage" | "materials" | "inspection" | "change_order" | "other";
export type UploadedFieldPhoto = { id: string; fileName: string; category: FieldPhotoCategory };
export type FieldPhotoDraft = {
  file: Blob;
  fileName: string;
  lastModified: number;
  note: string;
  category: FieldPhotoCategory;
  uploaded?: UploadedFieldPhoto;
};
export type FieldPhotoDraftScope = { companyId: string; userId: string; projectId: string; draftKey: string };
export type FieldPhotoDraftStorage = {
  read: (key: string) => Promise<FieldPhotoDraft | null>;
  write: (key: string, draft: FieldPhotoDraft | null) => Promise<void>;
};

const DATABASE_NAME = "bango-field-photo-drafts";
const STORE_NAME = "photos";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error ?? new Error("Unable to open photo recovery storage."));
    request.onblocked = () => reject(new Error("Photo recovery storage is blocked by another session."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, mode);
    const request = operation(tx.objectStore(STORE_NAME));
    let result!: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error("Unable to access photo recovery storage."));
    tx.oncomplete = () => { database.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { database.close(); reject(tx.error ?? new Error("Unable to save photo recovery data.")); };
  });
}

const browserStorage: FieldPhotoDraftStorage = {
  async read(key) { return (await transaction<FieldPhotoDraft | undefined>("readonly", store => store.get(key))) ?? null; },
  async write(key, draft) { await transaction("readwrite", store => draft ? store.put(draft, key) : store.delete(key)); },
};

/** One pending photo per account/project/crew/report-date; never a public URL or automatic upload. */
export function createFieldPhotoDraftStore(scope: FieldPhotoDraftScope, storage: FieldPhotoDraftStorage = browserStorage) {
  if (Object.values(scope).some(value => !value)) throw new Error("Choose an account and scheduled job before saving a photo.");
  const key = JSON.stringify([scope.companyId, scope.userId, scope.projectId, scope.draftKey]);
  let tail: Promise<unknown> = Promise.resolve();
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  }
  return {
    scope,
    load: () => serial(() => storage.read(key)),
    save: (draft: FieldPhotoDraft) => serial(() => storage.write(key, draft)),
    remove: () => serial(() => storage.write(key, null)),
  };
}
