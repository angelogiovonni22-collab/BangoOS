"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { createProjectExecutionService } from "@/lib/projects/execution/service";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type Inspection = Database["public"]["Tables"]["project_inspections"]["Row"];
type ChecklistKey = "workArea" | "ppe" | "access" | "housekeeping";
const checklistLabels: Record<ChecklistKey, string> = { workArea: "Work area ready", ppe: "PPE verified", access: "Safe access confirmed", housekeeping: "Housekeeping complete" };

export function MobileFieldInspections({ projectId, projectName }: { projectId: string; projectName: string }) {
  const supabase = useMemo(() => createClient(), []);
  const service = useMemo(() => supabase ? createProjectExecutionService(supabase) : null, [supabase]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectionType, setInspectionType] = useState("Daily field quality");
  const [notes, setNotes] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>({ workArea: false, ppe: false, access: false, housekeeping: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mutationRef = useRef(false);

  const withActor = useCallback(async () => {
    if (!supabase || !service) throw new Error("Field inspections are unavailable.");
    const result = await resolveWorkspaceContext(supabase);
    if (!result.context) throw new Error(result.errorMessage);
    return { service, companyId: result.context.companyId, actorProfileId: result.context.userId };
  }, [service, supabase]);

  const load = useCallback(async () => {
    if (!projectId) { setInspections([]); return; }
    try {
      const actor = await withActor();
      const rows = await actor.service.listInspections({ ...actor, projectId });
      setInspections(rows as Inspection[]);
      setSelectedId((current) => rows.some((row) => String(row.id) === current) ? current : String(rows[0]?.id ?? ""));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load field inspections."); }
  }, [projectId, withActor]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const createInspection = async () => {
    if (!projectId || !inspectionType.trim() || mutationRef.current) return;
    mutationRef.current = true;
    setBusy(true); setMessage(null);
    try {
      const actor = await withActor();
      const created = await actor.service.createInspection({ ...actor, projectId, inspectionType: inspectionType.trim(), notes: notes.trim() || null, scheduledAt: new Date().toISOString(), attachments: [{ type: "safety_checklist", checklist }], idempotencyKey: `field-inspection:${projectId}:${crypto.randomUUID()}` });
      await actor.service.startInspection({ ...actor, inspectionId: String(created.id), idempotencyKey: `field-inspection:${created.id}:started` });
      setSelectedId(String(created.id)); setNotes(""); setChecklist({ workArea: false, ppe: false, access: false, housekeeping: false }); setMessage("Field inspection started."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start the field inspection."); }
    finally { mutationRef.current = false; setBusy(false); }
  };

  const approve = async (result: "passed" | "failed") => {
    if (!selectedId || mutationRef.current) return;
    mutationRef.current = true;
    setBusy(true); setMessage(null);
    try {
      const actor = await withActor();
      if (result === "passed") await actor.service.passInspection({ ...actor, inspectionId: selectedId, notes: notes.trim() || "Field safety and quality checklist approved.", idempotencyKey: `field-inspection:${selectedId}:passed` });
      else await actor.service.failInspection({ ...actor, inspectionId: selectedId, correctionNotes: notes.trim() || "Field corrections required before approval.", reinspectionRequired: true, reinspectionDate: new Date(Date.now() + 86400000).toISOString(), idempotencyKey: `field-inspection:${selectedId}:failed` });
      setMessage(result === "passed" ? "Inspection approved and passed." : "Inspection failed and reinspection requested."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to record the inspection decision."); }
    finally { mutationRef.current = false; setBusy(false); }
  };

  const complete = Object.values(checklist).every(Boolean);
  return <section className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3" data-orion-region="mobile-field-inspections"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--text-secondary)]"/><p className="text-sm font-semibold text-[var(--text-primary)]">Field inspections & approvals</p></div><p className="mt-1 text-xs text-[var(--text-secondary)]">Project-linked safety and quality verification for {projectName || "the assigned project"}.</p><Input className="mt-3" aria-label="Inspection type" value={inspectionType} onChange={(event) => setInspectionType(event.target.value)} /><div className="mt-3 grid gap-2 sm:grid-cols-2">{(Object.keys(checklistLabels) as ChecklistKey[]).map((key) => <label key={key} className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={checklist[key]} onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))}/>{checklistLabels[key]}</label>)}</div><Textarea className="mt-2" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Inspection notes or required corrections"/><Button className="mt-2" fullWidth disabled={!projectId || !complete || busy} onClick={() => void createInspection()}><ClipboardCheck className="mr-1 h-4 w-4"/>Start inspection</Button>{inspections.length ? <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><Select aria-label="Active inspection" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{inspections.map((inspection) => <option key={inspection.id} value={inspection.id}>{inspection.inspection_type} · {inspection.status}</option>)}</Select><Button disabled={busy || !selectedId || inspections.find((item) => item.id === selectedId)?.status !== "in_progress"} onClick={() => void approve("passed")}>Approve & pass</Button><Button variant="danger" disabled={busy || !selectedId || inspections.find((item) => item.id === selectedId)?.status !== "in_progress"} onClick={() => void approve("failed")}>Fail & correct</Button></div> : <p className="mt-3 text-xs text-[var(--text-secondary)]">No project inspections recorded yet.</p>}{message ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p> : null}</section>;
}
