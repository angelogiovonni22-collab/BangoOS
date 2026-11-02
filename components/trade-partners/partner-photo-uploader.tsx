"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function photoContentType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (file.type) return file.type;
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "";
}

export function PartnerPhotoUploader({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("progress");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSuccess("");
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Choose a photo first."); return; }
    const mimeType = photoContentType(file);
    if (!ALLOWED_TYPES.has(mimeType)) { setError("Use a JPG, PNG, WebP, HEIC or HEIF photo."); return; }
    if (file.size < 1 || file.size > MAX_PHOTO_BYTES) { setError("Photo must be 10 MB or smaller."); return; }
    const supabase = createClient();
    if (!supabase) { setError("B.O.S. is unable to connect. Please sign in again."); return; }

    setBusy(true);
    try {
      const workspace = await resolveWorkspaceContext(supabase);
      if (!workspace.context || workspace.context.role?.toLowerCase() !== "subcontractor") {
        throw new Error("Your Trade Partner session has expired. Sign in again.");
      }
      // Storage and registration are independently protected by company/project-scoped RLS and RPC checks.
      const name = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "photo";
      const storagePath = `${workspace.context.companyId}/${projectId}/${crypto.randomUUID()}-${name}`;
      const uploaded = await supabase.storage.from("project-photos").upload(storagePath, file, {
        contentType: mimeType, upsert: false,
      });
      if (uploaded.error) throw new Error(uploaded.error.message || "Unable to upload the photo.");

      const registration = await supabase.rpc("register_my_trade_partner_photo", {
        p_project_id: projectId,
        p_storage_path: storagePath,
        p_original_filename: file.name,
        p_mime_type: mimeType,
        p_file_size: file.size,
        p_category: category,
        p_note: note.trim() || null,
      });
      if (registration.error) {
        // Best-effort cleanup; never remove an existing registered photograph.
        await supabase.storage.from("project-photos").remove([storagePath]);
        throw new Error(registration.error.message || "Unable to register the uploaded photo.");
      }
      if (fileRef.current) fileRef.current.value = "";
      setNote("");
      setSuccess("Photo uploaded to the project.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void uploadPhoto(event)} className="mt-4 grid gap-3 rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4 sm:grid-cols-2">
      <label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-muted)] sm:col-span-2">
        Add jobsite photo
        <input ref={fileRef} name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" required disabled={busy}
          className="mt-2 block w-full text-sm font-medium normal-case tracking-normal text-[var(--bos-text-primary)]" />
      </label>
      <label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-muted)]">
        Category
        <select value={category} onChange={(event) => setCategory(event.currentTarget.value)} disabled={busy}
          className="mt-2 h-10 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 text-sm normal-case tracking-normal text-[var(--bos-text-primary)]">
          <option value="progress">Progress</option><option value="materials">Materials</option><option value="inspection">Inspection</option>
          <option value="safety">Safety</option><option value="damage">Damage</option><option value="other">Other</option>
        </select>
      </label>
      <label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-muted)]">
        Note
        <input value={note} onChange={(event) => setNote(event.currentTarget.value)} maxLength={500}
          placeholder="What does this show?" disabled={busy}
          className="mt-2 h-10 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 text-sm normal-case tracking-normal text-[var(--bos-text-primary)]" />
      </label>
      {error ? <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p> : null}
      {success ? <p role="status" className="text-sm font-semibold text-green-700 sm:col-span-2">{success}</p> : null}
      <button type="submit" disabled={busy}
        className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60 sm:col-span-2">
        {busy ? "Uploading…" : "Upload Photo"}
      </button>
    </form>
  );
}
