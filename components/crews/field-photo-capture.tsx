"use client";

import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const BUCKET = "project-photos";
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const categories = ["progress", "safety", "damage", "materials", "inspection", "change_order", "other"] as const;

export type FieldPhotoUpload = { id: string; fileName: string; category: (typeof categories)[number] };

function safeName(name: string) { return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "field-photo"; }

export function FieldPhotoCapture({ projectId, projectName, onUploaded }: { projectId: string; projectName: string; onUploaded: (photo: FieldPhotoUpload) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("progress");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const chooseFile = (next: File | null) => {
    setMessage(null);
    if (!next) { setFile(null); return; }
    if (!next.type.startsWith("image/")) { setFile(null); setMessage("Choose an image file."); return; }
    if (next.size > MAX_PHOTO_BYTES) { setFile(null); setMessage("Photo must be 20 MB or smaller."); return; }
    setFile(next);
  };
  const upload = async () => {
    const supabase = createClient();
    if (!supabase || !file || !projectId || uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    setBusy(true); setMessage(null);
    try {
      const workspace = await resolveWorkspaceContext(supabase);
      if (!workspace.context) throw new Error(workspace.errorMessage);
      const photoId = crypto.randomUUID();
      const path = `${workspace.context.companyId}/${projectId}/${photoId}/${safeName(file.name)}`;
      const stored = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (stored.error) throw new Error(stored.error.message);
      const saved = await supabase.from("project_photos").insert({ id: photoId, company_id: workspace.context.companyId, project_id: projectId, uploaded_by: workspace.context.userId, storage_path: path, original_filename: file.name, mime_type: file.type || null, file_size: file.size, category, note: note.trim() || null, captured_at: new Date().toISOString() });
      if (saved.error) { await supabase.storage.from(BUCKET).remove([path]); throw new Error(saved.error.message); }
      setFile(null); setNote(""); if (inputRef.current) inputRef.current.value = "";
      setMessage("Field photo uploaded and attached to the daily report.");
      await onUploaded({ id: photoId, fileName: file.name, category });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload the field photo.");
    } finally {
      uploadInFlightRef.current = false;
      setBusy(false);
    }
  };
  return <section className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3" data-orion-region="field-photo-capture"><div className="flex items-center gap-2"><Camera className="h-4 w-4 text-[var(--text-secondary)]"/><p className="text-sm font-semibold text-[var(--text-primary)]">Jobsite photo</p></div><p className="mt-1 text-xs text-[var(--text-secondary)]">Capture directly to {projectName || "the assigned project"}. Images up to 20 MB.</p><input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}/><div className="mt-3 grid gap-2 sm:grid-cols-2"><Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>Take photo</Button><Select aria-label="Photo category" value={category} onChange={(event) => setCategory(event.target.value as (typeof categories)[number])}>{categories.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></div>{file ? <p className="mt-2 truncate text-xs text-[var(--text-secondary)]">{file.name}</p> : null}<Input className="mt-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Photo note"/><Button className="mt-2" fullWidth disabled={!file || !projectId || busy} onClick={() => void upload()}>{busy ? "Uploading…" : "Upload photo"}</Button>{message ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p> : null}</section>;
}
