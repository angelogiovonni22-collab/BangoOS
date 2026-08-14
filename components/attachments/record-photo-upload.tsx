"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  uploadRecordAttachment,
  validateRecordAttachment,
  type QueuedRecordAttachment,
  type RecordAttachmentEntity,
} from "@/lib/attachments/record-attachments";

export type RecordPhotoUploadHandle = {
  upload: (entityId: string, companyId: string, userId: string) => Promise<void>;
  hasPending: () => boolean;
};

export const RecordPhotoUpload = forwardRef<RecordPhotoUploadHandle, {
  entityType: RecordAttachmentEntity;
}>(function RecordPhotoUpload({ entityType }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueuedRecordAttachment[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const accepted: QueuedRecordAttachment[] = [];
    const errors: string[] = [];
    Array.from(files).forEach((file) => {
      const error = validateRecordAttachment(file);
      if (error) errors.push(`${file.name}: ${error}`);
      else accepted.push({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), caption: "", status: "queued", progress: 0 });
    });
    setItems((current) => [...current, ...accepted]);
    setMessage(errors.length ? errors.join(" ") : null);
  }

  async function upload(entityId: string, companyId: string, userId: string) {
    const supabase = createClient();
    if (!supabase || !companyId || !userId) throw new Error("Photo uploads are not ready yet.");
    const pending = items.filter((item) => item.status !== "uploaded");
    for (const [index, item] of pending.entries()) {
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "uploading", progress: 35, error: undefined } : candidate));
      try {
        await uploadRecordAttachment({ supabase, companyId, userId, entityType, entityId, attachment: item, sortOrder: index });
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "uploaded", progress: 100 } : candidate));
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Upload failed.";
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "error", error: detail, progress: 0 } : candidate));
        throw new Error(`The record was saved, but ${item.file.name} could not upload: ${detail}`);
      }
    }
  }

  useImperativeHandle(ref, () => ({ upload, hasPending: () => items.some((item) => item.status !== "uploaded") }));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" data-orion-region="record-photos">
      <h2 className="text-lg font-semibold text-slate-950">Photos</h2>
      <p className="mt-1 text-sm text-slate-600">Add job-site, document, or reference photos. They upload after this record is saved.</p>
      <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(event) => addFiles(event.target.files)} />
      <input ref={cameraRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => addFiles(event.target.files)} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} data-orion-action="attachments.choose">Choose photos</Button>
        <Button type="button" variant="secondary" onClick={() => cameraRef.current?.click()} data-orion-action="attachments.camera">Take photo</Button>
      </div>
      {message ? <p className="mt-3 text-sm font-medium text-red-700" role="alert">{message}</p> : null}
      {items.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => (
        <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.previewUrl} alt={item.file.name} className="h-36 w-full object-cover" />
          <div className="space-y-2 p-3">
            <p className="truncate text-sm font-medium text-slate-900">{item.file.name}</p>
            <Input aria-label={`Caption for ${item.file.name}`} placeholder="Optional caption" value={item.caption} disabled={item.status === "uploading" || item.status === "uploaded"} onChange={(event) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, caption: event.target.value } : candidate))} />
            {item.status === "uploading" ? <progress className="w-full" value={item.progress} max={100} aria-label={`Uploading ${item.file.name}`} /> : null}
            {item.error ? <p className="text-xs text-red-700">{item.error}</p> : null}
            <div className="flex items-center justify-between text-xs text-slate-600"><span>{item.status}</span>{item.status !== "uploading" && item.status !== "uploaded" ? <button type="button" className="font-medium text-red-700" onClick={() => { URL.revokeObjectURL(item.previewUrl); setItems((current) => current.filter((candidate) => candidate.id !== item.id)); }}>Remove</button> : null}</div>
          </div>
        </article>
      ))}</div> : null}
    </section>
  );
});
