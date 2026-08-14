"use client";

import { useRef, useState } from "react";
import { GitCompareArrows, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { uploadBlueprintRevision, validateBlueprintFile } from "@/lib/blueprints/plan-room";
import type { PlanDocument } from "./types";

type BlueprintRevisionPanelProps = {
  companyId: string;
  projectId: string;
  document: PlanDocument;
  onUploaded: () => void;
  onClose: () => void;
};

export function BlueprintRevisionPanel({ companyId, projectId, document, onUploaded, onClose }: BlueprintRevisionPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [revisionLabel, setRevisionLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const chooseFile = (nextFile: File | null) => {
    if (!nextFile) return;
    const validationError = validateBlueprintFile(nextFile);
    if (validationError) {
      setFile(null);
      setMessage(validationError);
      return;
    }
    setFile(nextFile);
    setMessage(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !revisionLabel.trim()) {
      setMessage("Choose a file and enter the new revision label.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setMessage("Blueprint storage is not available right now.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      await uploadBlueprintRevision({ supabase, companyId, projectId, sheetId: document.id, revisionLabel, notes, file });
      onUploaded();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The revision could not be uploaded.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-amber-200 bg-amber-50/45 p-5 shadow-[var(--shadow-small)]" data-orion-region="blueprint-revision-upload">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Upload new revision</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{document.fileName} · Current revision {document.revision}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Close revision upload"><X size={17} /></Button>
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={submit}>
        <div className="lg:col-span-2">
          <input ref={fileInputRef} type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-20 w-full items-center justify-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]">
            <GitCompareArrows size={21} aria-hidden="true" />
            {file ? file.name : "Choose replacement PDF or image"}
          </button>
        </div>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">New revision label</span>
          <Input value={revisionLabel} disabled={submitting} required maxLength={80} placeholder="Rev 2" onChange={(event) => setRevisionLabel(event.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Revision notes</span>
          <Input value={notes} disabled={submitting} maxLength={500} placeholder="Describe what changed" onChange={(event) => setNotes(event.target.value)} />
        </label>
        {message ? <p className="text-sm font-medium text-red-700 lg:col-span-2" role="alert">{message}</p> : null}
        <div className="flex justify-end gap-2 lg:col-span-2">
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting || !file}>{submitting ? "Uploading…" : "Create revision"}</Button>
        </div>
      </form>
    </section>
  );
}
