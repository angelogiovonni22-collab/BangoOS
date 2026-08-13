"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, DollarSign, ListChecks, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadBlueprintProjectImpactSummary, type BlueprintProjectImpactSummary } from "@/lib/blueprints/operations";

const empty: BlueprintProjectImpactSummary = { openIssues: 0, unlinkedIssues: 0, tasks: 0, punchItems: 0, changeOrders: 0, workforceAssignments: 0, estimateItems: 0, changeOrderValue: 0, estimateValue: 0 };

export function BlueprintProjectImpact({ companyId, projectId }: { companyId: string; projectId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [summary, setSummary] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void loadBlueprintProjectImpactSummary(supabase, { companyId, projectId })
      .then((next) => { if (active) { setSummary(next); setError(null); } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load Blueprint project impact."); });
    return () => { active = false; };
  }, [companyId, projectId, supabase]);
  if (error) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>;
  const cards = [
    { label: "Open plan issues", value: summary.openIssues, icon: AlertTriangle, alert: summary.unlinkedIssues > 0, detail: `${summary.unlinkedIssues} without response` },
    { label: "Tasks / punch", value: summary.tasks + summary.punchItems, icon: ListChecks, detail: `${summary.tasks} tasks · ${summary.punchItems} punch` },
    { label: "Assigned", value: summary.workforceAssignments, icon: Users, detail: "Workforce responses" },
    { label: "Financial exposure", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(summary.changeOrderValue + summary.estimateValue), icon: DollarSign, detail: `${summary.changeOrders} CO · ${summary.estimateItems} estimate takeoff` },
  ];
  return <section aria-label="Blueprint project impact" data-orion-region="blueprint-project-impact" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <article key={card.label} className={`rounded-xl border bg-white p-3 shadow-sm ${card.alert ? "border-amber-300" : "border-slate-200"}`}><div className="flex items-center justify-between"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><card.icon size={16} aria-hidden="true" /></span><strong className="text-xl text-slate-950">{card.value}</strong></div><p className="mt-2 text-xs font-bold text-slate-800">{card.label}</p><p className={`mt-0.5 text-[10px] ${card.alert ? "font-semibold text-amber-700" : "text-slate-500"}`}>{card.detail}</p></article>)}</section>;
}
