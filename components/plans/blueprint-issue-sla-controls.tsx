"use client";

import { useState } from "react";
import { ClockAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setBlueprintIssueSla, type BlueprintIssuePriority } from "@/lib/blueprints/issue-sla";
import type { BlueprintMarkup } from "@/lib/blueprints/markups";

export function BlueprintIssueSlaControls({ markup, companyId, projectId, versionId, onSaved }: { markup: BlueprintMarkup; companyId: string; projectId: string; versionId: string; onSaved: () => Promise<void> }) {
  const [priority, setPriority] = useState<BlueprintIssuePriority>(markup.priority);
  const [dueDate, setDueDate] = useState(markup.dueAt?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const overdue = markup.status === "open" && Boolean(markup.escalatedAt);
  const save = async () => {
    const supabase = createClient(); if (!supabase || saving) return; setSaving(true);
    try { await setBlueprintIssueSla(supabase, { companyId, projectId, versionId, annotationId: markup.id, priority, dueAt: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null }); await onSaved(); }
    finally { setSaving(false); }
  };
  return <div className={`mt-2 rounded border p-2 ${overdue ? "border-red-400/50 bg-red-500/10" : "border-white/10 bg-black/10"}`}><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold"><ClockAlert size={11} />{overdue ? "SLA overdue" : "Issue SLA"}</div><div className="grid grid-cols-[1fr_1.2fr_auto] gap-1"><select aria-label="Issue priority" value={priority} onChange={(event) => setPriority(event.target.value as BlueprintIssuePriority)} className="min-w-0 rounded border border-white/15 bg-slate-900 px-1 text-[10px]">{["low","medium","high","critical"].map((value) => <option key={value} value={value}>{value}</option>)}</select><input aria-label="Issue due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="min-w-0 rounded border border-white/15 bg-slate-900 px-1 text-[10px]"/><button type="button" disabled={saving} onClick={() => void save()} className="rounded border border-cyan-400/40 px-2 text-[10px] font-semibold text-cyan-200 disabled:opacity-50">Save</button></div></div>;
}
