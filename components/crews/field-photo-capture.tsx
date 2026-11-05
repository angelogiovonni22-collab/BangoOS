"use client";

import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createFieldPhotoDraftStore, type FieldPhotoDraft, type UploadedFieldPhoto } from "@/lib/crews/field-photo-drafts";
import { createFieldPhotoPreview } from "@/lib/crews/field-photo-preview";
import { Button, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const BUCKET = "project-photos";
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const categories = ["progress", "safety", "damage", "materials", "inspection", "change_order", "other"] as const;

export type FieldPhotoUpload = UploadedFieldPhoto;

function safeName(name: string) { return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "field-photo"; }

export function FieldPhotoCapture({ projectId, projectName, draftKey, onUploaded }: { projectId: string; projectName: string; draftKey: string; onUploaded: (photo: FieldPhotoUpload) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    file: selected, fileName: selected.name, lastModified: selected.lastModified, note: nextNote, category: nextCategory, ...(uploaded ? { uploaded } : {}),
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
      setSelectedFile(null); setUploadedPhoto(null); setMessage(null); setRecoveryMessage(null);
    } catch { setMessage("Unable to remove the device photo. Please try again."); }
    finally { setBusy(false); }
  };
  const chooseFile = (next: File | null) => {
    setMessage(null);
    if (!next) return;
    if (!next.type.startsWith("image/")) { setMessage("Choose an image file."); return; }
    if (next.size > MAX_PHOTO_BYTES) { setMessage("Photo must be 20 MB or smaller."); return; }
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
      let uploaded = uploadedPhoto;
      if (!uploaded) {
      const photoId = crypto.randomUUID();
      const path = `${workspace.context.companyId}/${projectId}/${photoId}/${safeName(file.name)}`;
      const stored = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (stored.error) throw new Error(stored.error.message);
      const saved = await supabase.from("project_photos").insert({ id: photoId, company_id: workspace.context.companyId, project_id: projectId, uploaded_by: workspace.context.userId, storage_path: path, original_filename: file.name, mime_type: file.type || null, file_size: file.size, category, note: note.trim() || null, captured_at: new Date().toISOString() });
      if (saved.error) { await supabase.storage.from(BUCKET).remove([path]); throw new Error(saved.error.message); }
      uploaded = { id: photoId, fileName: file.name, category };
      setUploadedPhoto(uploaded);
      try { await draftStoreRef.current?.save(asDraft(file, note, category, uploaded)); }
      catch { setRecoveryMessage("Photo uploaded online. Keep this page open until it is attached to the report."); }
      }
      if (!mountedRef.current) return; // Retain the original job’s recovery copy after navigation.
      await onUploaded(uploaded);
      await draftStoreRef.current?.remove();
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
  return <section className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3" aria-busy={busy} data-orion-region="field-photo-capture"><div className="flex items-center gap-2"><Camera className="h-4 w-4 text-[var(--text-secondary)]"/><p className="text-sm font-semibold text-[var(--text-primary)]">Jobsite photo</p></div><p className="mt-1 text-xs text-[var(--text-secondary)]">Capture directly to {projectName || "the assigned project"}. Images up to 20 MB.</p>{!projectId ? <p role="status" className="mt-3 text-sm text-[var(--text-secondary)]">No project is assigned to this crew today. Ask your supervisor to publish an assignment before taking a jobsite photo.</p> : null}<input disabled={busy || hydrating || !projectId || Boolean(uploadedPhoto)} aria-label="Jobsite photo file" ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0] ?? null; event.target.value = ""; chooseFile(selected); }}/><div className="mt-3 grid gap-2 sm:grid-cols-2"><Button type="button" variant="secondary" disabled={busy || hydrating || !projectId || Boolean(uploadedPhoto)} onClick={() => inputRef.current?.click()}>Take photo</Button><Select disabled={busy || hydrating || !projectId || Boolean(uploadedPhoto)} aria-label="Photo category" value={category} onChange={(event) => { const next = event.target.value as (typeof categories)[number]; setCategory(next); if (file) persistSelection(file, note, next); }}>{categories.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></div>{file ? <div className="mt-3 space-y-2">
    {previewUrl && !previewFailed ? (
      // eslint-disable-next-line @next/next/no-img-element -- This browser-local blob must not go through a remote image optimizer.
      <img src={previewUrl} alt="Selected jobsite photo preview" className="max-h-64 w-full rounded-[var(--radius-card)] border border-[var(--border-subtle)] object-contain" onError={() => setPreviewFailed(true)} />
    ) : <p role="status" className="text-sm text-[var(--text-secondary)]">Preview is unavailable for this image format. You can retake it or upload the selected file.</p>}
    <p className="truncate text-xs text-[var(--text-secondary)]">{file.name}</p>
    <Button type="button" variant="secondary" disabled={busy || savingOnDevice} onClick={() => void removeSelectedPhoto()}>Remove photo</Button>
  </div> : null}<Input className="mt-2" aria-label="Photo note" disabled={busy || hydrating || !projectId || Boolean(uploadedPhoto)} value={note} onChange={(event) => { setNote(event.target.value); if (file) persistSelection(file, event.target.value, category); }} placeholder="Photo note"/><Button className="mt-2" fullWidth disabled={!file || !projectId || busy || hydrating || savingOnDevice} onClick={() => void upload()}>{busy ? "Saving…" : uploadedPhoto ? "Attach uploaded photo" : "Upload photo"}</Button>{hydrating && projectId ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">Checking this device for a saved photo…</p> : null}{savingOnDevice ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">Saving photo on this device…</p> : recoveryMessage ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{recoveryMessage}</p> : null}{message ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p> : null}</section>;
}
