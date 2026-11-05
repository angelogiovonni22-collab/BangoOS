import type { FieldPhotoDraft, UploadedFieldPhoto } from "./field-photo-drafts";

export type PhotoUploadAttempt = { id: string; sha256: string; capturedAt: string };
export type PhotoMetadata = {
  id: string; company_id: string; project_id: string; uploaded_by: string;
  storage_path: string; original_filename: string; mime_type: string | null;
  file_size: number; category: UploadedFieldPhoto["category"]; note: string | null; captured_at: string;
};
export type PhotoUploadError = { message: string; code?: string; error?: string; statusCode?: string | number; status?: number };
export type PhotoUploadBackend = {
  find: (id: string) => Promise<PhotoMetadata | null>;
  upload: (path: string, file: Blob) => Promise<PhotoUploadError | null>;
  insert: (row: PhotoMetadata) => Promise<void>;
  download: (path: string) => Promise<Blob>;
};

export async function photoDigest(file: Blob): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** A duplicate response only permits reconciliation; it never proves the stored bytes match. */
export function isPhotoAlreadyStored(error: PhotoUploadError): boolean {
  const code = error.code || error.error;
  if (code === "ResourceAlreadyExists" || code === "KeyAlreadyExists" || code === "Duplicate") return true;
  const status = Number(error.statusCode ?? error.status);
  return (status === 400 || status === 409) && /^(Asset Already Exists|The resource already exists)\.?$/i.test(error.message);
}

/** Stable identity is committed on device before the first network write. No overwrite or compensating delete. */
export async function uploadFieldPhoto({ draft, companyId, userId, projectId, backend, persist }: {
  draft: FieldPhotoDraft; companyId: string; userId: string; projectId: string;
  backend: PhotoUploadBackend; persist: (draft: FieldPhotoDraft) => Promise<void>;
}): Promise<{ photo: UploadedFieldPhoto; recovered: boolean; draft: FieldPhotoDraft }> {
  const digest = await photoDigest(draft.file);
  const legacy = draft.uploaded && !draft.uploadAttempt ? await backend.find(draft.uploaded.id) : null;
  if (draft.uploaded && !draft.uploadAttempt && !legacy) throw new Error("The previously uploaded photo is no longer available. Keep this device copy and ask your supervisor to review it.");
  const attempt = draft.uploadAttempt ?? { id: draft.uploaded?.id ?? crypto.randomUUID(), sha256: digest, capturedAt: legacy?.captured_at ?? new Date().toISOString() };
  if (attempt.sha256 !== digest || (draft.uploaded && draft.uploaded.id !== attempt.id)) throw new Error("The saved photo reference does not match this file. Keep the device copy and ask your supervisor to review it.");
  const pending = { ...draft, uploadAttempt: attempt };
  await persist(pending);
  const name = draft.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "field-photo";
  const expected: PhotoMetadata = { id: attempt.id, company_id: companyId, project_id: projectId, uploaded_by: userId,
    storage_path: `${companyId}/${projectId}/${attempt.id}/${name}`, original_filename: draft.fileName,
    mime_type: draft.file.type || null, file_size: draft.file.size, category: draft.category,
    note: draft.note.trim() || null, captured_at: attempt.capturedAt };
  const reconcile = async (row: PhotoMetadata) => {
    const fields = Object.keys(expected) as Array<keyof PhotoMetadata>;
    // Postgres can normalize the timestamp representation while preserving the instant.
    if (fields.some(key => key === "captured_at" ? Date.parse(row[key]) !== Date.parse(expected[key]) : row[key] !== expected[key])) throw new Error("The saved photo details differ from this attempt. Keep this device copy and ask your supervisor to review the saved photo.");
    if (await photoDigest(await backend.download(expected.storage_path)) !== digest) throw new Error("The saved photo could not be matched to this device copy. Nothing was overwritten. Ask your supervisor to review it.");
    return { photo: { id: row.id, fileName: row.original_filename, category: row.category }, recovered: true, draft: pending };
  };
  const existing = await backend.find(attempt.id);
  if (existing) return reconcile(existing);
  if (draft.uploaded) throw new Error("The previously uploaded photo is no longer available. It was not uploaded again. Keep this device copy and ask your supervisor to review it.");
  const uploadError = await backend.upload(expected.storage_path, draft.file);
  if (uploadError && !isPhotoAlreadyStored(uploadError)) throw new Error(uploadError.message);
  try { await backend.insert(expected); }
  catch (error) {
    const saved = await backend.find(attempt.id);
    if (saved) return reconcile(saved);
    throw error;
  }
  // Private storage read access requires the metadata row. Verify bytes after registering an orphan.
  if (uploadError) {
    const saved = await backend.find(attempt.id);
    if (!saved) throw new Error("Photo upload is awaiting confirmation. Keep this page open and retry with the saved details.");
    return reconcile(saved);
  }
  return { photo: { id: attempt.id, fileName: draft.fileName, category: draft.category }, recovered: false, draft: pending };
}
