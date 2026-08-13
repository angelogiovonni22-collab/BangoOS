"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { acknowledgeBlueprintRevision, loadBlueprintRevisionGovernance, setBlueprintRevisionReviewStatus } from "@/lib/blueprints/revision-governance";

export function BlueprintRevisionGovernance({ companyId, projectId, versionId, userId, onChanged }: { companyId: string; projectId: string; versionId: string; userId: string; onChanged?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState({ status: "draft", acknowledgmentCount: 0, acknowledgedByMe: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => { if (supabase) setState(await loadBlueprintRevisionGovernance(supabase, { companyId, projectId, versionId, userId })); }, [companyId, projectId, supabase, userId, versionId]);
  useEffect(() => { let active = true; if (!supabase) return; void loadBlueprintRevisionGovernance(supabase, { companyId, projectId, versionId, userId }).then((next) => { if (active) setState(next); }).catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load revision governance."); }); return () => { active = false; }; }, [companyId, projectId, supabase, userId, versionId]);
  const act = async (action: "acknowledge" | "review" | "approve") => { if (!supabase || saving) return; setSaving(true); setError(null); try { if (action === "acknowledge") await acknowledgeBlueprintRevision(supabase, { companyId, projectId, versionId, userId }); else await setBlueprintRevisionReviewStatus(supabase, { companyId, projectId, versionId, status: action === "approve" ? "approved" : "in_review" }); await reload(); onChanged?.(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Could not update revision governance."); } finally { setSaving(false); } };
  return <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-3" data-orion-region="blueprint-revision-governance"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-slate-900">Revision governance</p><p className="mt-0.5 text-[10px] text-slate-600">{state.status.replace("_", " ")} · {state.acknowledgmentCount} acknowledgment{state.acknowledgmentCount === 1 ? "" : "s"}</p></div><div className="flex flex-wrap gap-1.5"><Button size="sm" variant="outline" disabled={saving || state.acknowledgedByMe} onClick={() => void act("acknowledge")}><CheckCheck size={14} />{state.acknowledgedByMe ? "Acknowledged" : "Acknowledge"}</Button>{state.status === "draft" ? <Button size="sm" variant="outline" disabled={saving} onClick={() => void act("review")}>Submit review</Button> : null}{state.status !== "approved" ? <Button size="sm" disabled={saving} onClick={() => void act("approve")}><ShieldCheck size={14} />Approve revision</Button> : null}</div></div>{error ? <p role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}</section>;
}
