"use client";

import { useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { uploadBlueprint, validateBlueprintFile, type BlueprintDiscipline } from "@/lib/blueprints/plan-room";

type BlueprintUploadPanelProps = {
  companyId: string;
  projectId: string;
  userId: string;
  onUploaded: () => void;
  onClose: () => void;
};

const DISCIPLINES: BlueprintDiscipline[] = [
  "Architectural", "Structural", "Civil", "Mechanical", "Electrical", "Plumbing", "Fire Protection", "Specifications", "Permits", "Other",
];

export function BlueprintUploadPanel({ companyId, projectId, userId, onUploaded, onClose }: BlueprintUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [discipline, setDiscipline] = useState<BlueprintDiscipline>("Architectural");
  const [sheetNumber, setSheetNumber] = useState("");
  const [title, setTitle] = useState("");
  const [revisionLabel, setRevisionLabel] = useState("Initial");
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
    if (!title.trim()) setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setMessage("Choose a blueprint file first.");
      return;
    }
    if (!sheetNumber.trim() || !title.trim()) {
      setMessage("Sheet number and title are required.");
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
      await uploadBlueprint({
        supabase,
        input: { companyId, projectId, userId, file, discipline, sheetNumber, title, revisionLabel },
      });
      onUploaded();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The blueprint could not be uploaded.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-blue-200 bg-blue-50/45 p-5 shadow-[var(--shadow-small)]" data-orion-region="blueprint-upload">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Upload blueprint sheet</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">PDF, image, IFC, GLB, and GLTF files are stored privately and attached to this project.</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Close blueprint upload"><X size={17} /></Button>
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={submit}>
        <div className="lg:col-span-2">
          <input ref={fileInputRef} type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.ifc,.glb,.gltf,application/pdf,image/jpeg,image/png,image/webp,model/gltf-binary,model/gltf+json,application/x-step" onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-24 w-full items-center justify-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-blue-300 bg-white px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]">
            <FileUp size={22} aria-hidden="true" />
            {file ? file.name : "Choose 2D plan or 3D BIM model"}
          </button>
        </div>

        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Discipline</span>
          <Select value={discipline} disabled={submitting} onChange={(event) => setDiscipline(event.target.value as BlueprintDiscipline)}>
            {DISCIPLINES.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Sheet number</span>
          <Input value={sheetNumber} disabled={submitting} required maxLength={80} placeholder="A-101" onChange={(event) => setSheetNumber(event.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Sheet title</span>
          <Input value={title} disabled={submitting} required maxLength={200} placeholder="First Floor Plan" onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Revision</span>
          <Input value={revisionLabel} disabled={submitting} required maxLength={80} placeholder="Initial" onChange={(event) => setRevisionLabel(event.target.value)} />
        </label>

        {message ? <p className="text-sm font-medium text-red-700 lg:col-span-2" role="alert">{message}</p> : null}
        <div className="flex justify-end gap-2 lg:col-span-2">
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting || !file}>{submitting ? "Uploading…" : "Upload sheet"}</Button>
        </div>
      </form>
    </section>
  );
}
