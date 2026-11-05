"use client";

import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createFieldPhotoDraftStore, type FieldPhotoDraft, type UploadedFieldPhoto } from "@/lib/crews/field-photo-drafts";
import { uploadFieldPhoto } from "@/lib/crews/field-photo-upload";
import { createFieldPhotoPreview } from "@/lib/crews/field-photo-preview";
import { Button, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const categories = ["progress", "safety", "damage", "materials", "inspection", "change_order", "other"] as const;

export type FieldPhotoUpload = UploadedFieldPhoto;


export function FieldPhotoCapture({ projectId, projectName, draftKey, onUploaded }: { projectId: string; projectName: string; draftKey: string; onUploaded: (photo: FieldPhotoUpload) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef<FieldPhotoDraft["uploadAttempt"]>(undefined);
  const [attemptStarted, setAttemptStarted] = useState(false);
  const uploadInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [file, setFile] = useState<File | null>(null);
  const [preview] = useState(createFieldPhotoPreview);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => () => preview.dispose(), [preview]);
  const setSelectedFile = (next: File | null) => {
    const url = preview.replace(next);
    setFile(next);
    setPreviewUrl(url);
    setPreviewFailed(Boolean(next && !url));
  };
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("progress");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const draftStoreRef = useRef<ReturnType<typeof createFieldPhotoDraftStore> | null>(null);
  const saveVersionRef = useRef(0);
  const [hydrating, setHydrating] = useState(true);
  const [savingOnDevice, setSavingOnDevice] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<FieldPhotoUpload | null>(null);
  const asDraft = (selected: File, nextNote: string, nextCategory: FieldPhotoUpload["category"], uploaded?: FieldPhotoUpload): FieldPhotoDraft => ({
    file: selected, fileName: selected.name, lastModified: selected.lastModified, note: nextNote, category: nextCategory, ...(attemptRef.current ? { uploadAttempt: attemptRef.current } : {}), ...(uploaded ? { uploaded } : {}),
  });
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!projectId || !draftKey) return;
        const workspace = await resolveWorkspaceContext(createClient());
        if (!workspace.context) throw new Error(workspace.errorMessage);
        const store = createFieldPhotoDraftStore({ companyId: workspace.context.companyId, userId: workspace.context.userId, projectId, draftKey });
        draftStoreRef.current = store;
        const saved = await store.load();
        if (!active || !saved) return;
        const restored = new File([saved.file], saved.fileName, { type: saved.file.type, lastModified: saved.lastModified });
        const url = preview.replace(restored);
        setFile(restored); setPreviewUrl(url); setPreviewFailed(!url);
        attemptRef.current = saved.uploadAttempt;
        setAttemptStarted(Boolean(saved.uploadAttempt));
        setNote(saved.note); setCategory(saved.category); setUploadedPhoto(saved.uploaded ?? null);
        setRecoveryMessage(saved.uploaded ? "Uploaded photo recovered. Attach it to this report to finish." : "Photo recovered from this device. Review it, then upload when online.");
      } catch {
        if (active) setRecoveryMessage("Photo recovery is unavailable on this device. Keep this page open until your photo is uploaded.");
      } finally {
        if (active) setHydrating(false);
      }
    })();
    return () => { active = false; };
  }, [projectId, draftKey, preview]);

  const persistSelection = (selected: File, nextNote: string, nextCategory: FieldPhotoUpload["category"]) => {
    const version = ++saveVersionRef.current;
    setSavingOnDevice(true);
    const store = draftStoreRef.current;
    void (store ? store.save(asDraft(selected, nextNote, nextCategory)) : Promise.reject(new Error("Photo recovery unavailable"))).then(() => {
      if (version === saveVersionRef.current) setRecoveryMessage("Photo saved on this device. Reopen the same crew and report date to continue. Upload when online.");
    }).catch(() => {
      if (version === saveVersionRef.current) setRecoveryMessage("This photo could not be saved on this device. Keep this page open until it is uploaded.");
    }).finally(() => { if (version === saveVersionRef.current) setSavingOnDevice(false); });
  };
  const removeSelectedPhoto = async () => {
    setBusy(true);
    try {
      await draftStoreRef.current?.remove();
      attemptRef.current = undefined; setAttemptStarted(false);
      setSelectedFile(null); setUploadedPhoto(null); setMessage(null); setRecoveryMessage(null);
    } catch { setMessage("Unable to remove the device photo. Please try again."); }
    finally { setBusy(false); }
  };
  const chooseFile = (next: File | null) => {
    setMessage(null);
    if (!next) return;
    if (!next.type.startsWith("image/")) { setMessage("Choose an image file."); return; }
    if (next.size > MAX_PHOTO_BYTES) { setMessage("Photo must be 20 MB or smaller."); return; }
    attemptRef.current = undefined; setAttemptStarted(false);
    setSelectedFile(next); setUploadedPhoto(null);
    persistSelection(next, note, category);
  };
  const upload = async () => {
    const supabase = createClient();
    if (!supabase || !file || !projectId || hydrating || savingOnDevice || uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    setBusy(true); setMessage(null);
    try {
      const workspace = await resolveWorkspaceContext(supabase);
      if (!workspace.context) throw new Error(workspace.errorMessage);
      const scope = draftStoreRef.current?.scope;
      if (!scope || scope.companyId !== workspace.context.companyId || scope.userId !== workspace.context.userId) throw new Error("Your account changed. Reopen this job before uploading the photo.");
      const result = await uploadFieldPhoto({
        draft: asDraft(file, note, category, uploadedPhoto ?? undefined),
        companyId: scope.companyId, userId: scope.userId, projectId,
        persist: async pending => {
          attemptRef.current = pending.uploadAttempt;
          setAttemptStarted(true);
          await draftStoreRef.current!.save(pending);
        },
        backend: {
          find: async id => {
            const found = await supabase.from("project_photos").select("id,company_id,project_id,uploaded_by,storage_path,original_filename,mime_type,file_size,category,note,captured_at").eq("id", id).eq("company_id", scope.companyId).eq("project_id", projectId).maybeSingle();
            if (found.error) throw new Error(found.error.message);
            const row = found.data;
            if (!row) return null;
            if (!row.uploaded_by || !row.original_filename || row.file_size === null || !row.captured_at || !categories.includes(row.category as FieldPhotoUpload["category"])) throw new Error("The saved photo has incomplete details. Keep this device copy and ask your supervisor to review it.");
            return { ...row, uploaded_by: row.uploaded_by, original_filename: row.original_filename, file_size: row.file_size, captured_at: row.captured_at, category: row.category as FieldPhotoUpload["category"] };
          },
          upload: async (path, blob) => (await supabase.storage.from("project-photos").upload(path, blob, { upsert: false, contentType: blob.type || undefined })).error,
          insert: async row => {
            const saved = await supabase.from("project_photos").insert(row);
            if (saved.error) throw new Error(saved.error.message);
          },
          download: async path => {
            const stored = await supabase.storage.from("project-photos").download(path);
            if (stored.error || !stored.data) throw new Error(stored.error?.message || "Unable to confirm the saved photo.");
            return stored.data;
          },
        },
      });
      const uploaded = result.photo;
      setUploadedPhoto(uploaded);
      try { await draftStoreRef.current!.save({ ...result.draft, uploaded }); }
      catch { setRecoveryMessage("Photo uploaded online. Keep this page open until it is attached to the report."); }
      if (!mountedRef.current) return; // Retain the original job’s recovery copy after navigation.
      await onUploaded(uploaded);
      await draftStoreRef.current?.remove();
      attemptRef.current = undefined; setAttemptStarted(false);
      setSelectedFile(null); setUploadedPhoto(null); setNote(""); setRecoveryMessage(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Field photo uploaded and attached to the daily report.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload the field photo.");
    } finally {
      uploadInFlightRef.current = false;
      setBusy(false);
    }
  };
  return <section className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3" aria-busy={busy} data-orion-region="field-photo-capture"><div className="flex items-center gap-2"><Camera className="h-4 w-4 text-[var(--text-secondary)]"/><p className="text-sm font-semibold text-[var(--text-primary)]">Jobsite photo</p></div><p className="mt-1 text-xs text-[var(--text-secondary)]">Capture directly to {projectName || "the assigned project"}. Images up to 20 MB.</p>{!projectId ? <p role="status" className="mt-3 text-sm text-[var(--text-secondary)]">No project is assigned to this crew today. Ask your supervisor to publish an assignment before taking a jobsite photo.</p> : null}<input disabled={busy || hydrating || !projectId || (Boolean(uploadedPhoto) || attemptStarted)} aria-label="Jobsite photo file" ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0] ?? null; event.target.value = ""; chooseFile(selected); }}/><div className="mt-3 grid gap-2 sm:grid-cols-2"><Button type="button" variant="secondary" disabled={busy || hydrating || !projectId || (Boolean(uploadedPhoto) || attemptStarted)} onClick={() => inputRef.current?.click()}>Take photo</Button><Select disabled={busy || hydrating || !projectId || (Boolean(uploadedPhoto) || attemptStarted)} aria-label="Photo category" value={category} onChange={(event) => { const next = event.target.value as (typeof categories)[number]; setCategory(next); if (file) persistSelection(file, note, next); }}>{categories.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></div>{file ? <div className="mt-3 space-y-2">
    {previewUrl && !previewFailed ? (
      // eslint-disable-next-line @next/next/no-img-element -- This browser-local blob must not go through a remote image optimizer.
      <img src={previewUrl} alt="Selected jobsite photo preview" className="max-h-64 w-full rounded-[var(--radius-card)] border border-[var(--border-subtle)] object-contain" onError={() => setPreviewFailed(true)} />
    ) : <p role="status" className="text-sm text-[var(--text-secondary)]">Preview is unavailable for this image format. You can retake it or upload the selected file.</p>}
    <p className="truncate text-xs text-[var(--text-secondary)]">{file.name}</p>
    <Button type="button" variant="secondary" disabled={busy || savingOnDevice} onClick={() => void removeSelectedPhoto()}>Remove photo</Button>
  </div> : null}<Input className="mt-2" aria-label="Photo note" disabled={busy || hydrating || !projectId || (Boolean(uploadedPhoto) || attemptStarted)} value={note} onChange={(event) => { setNote(event.target.value); if (file) persistSelection(file, event.target.value, category); }} placeholder="Photo note"/><Button className="mt-2" fullWidth disabled={!file || !projectId || busy || hydrating || savingOnDevice} onClick={() => void upload()}>{busy ? "Saving…" : uploadedPhoto ? "Attach uploaded photo" : attemptStarted ? "Retry with saved details" : "Upload photo"}</Button>{attemptStarted && !uploadedPhoto ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">This upload has saved details. Retry to check the same photo, or remove this device copy to take another. Photos already online are kept.</p> : null}{hydrating && projectId ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">Checking this device for a saved photo…</p> : null}{savingOnDevice ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">Saving photo on this device…</p> : recoveryMessage ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{recoveryMessage}</p> : null}{message ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p> : null}</section>;
}

