"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { summarizeProjectCommitments } from "@/lib/projects/project-commitments";

type LaborRow = { compensation_method: "hourly" | "salary" | "day_rate" | "piece_rate"; rate: number; projected_hours: number; projected_days: number; projected_units: number; actual_hours: number; actual_days: number; actual_units: number };
type SubcontractRow = { contract_amount: number | null; contract_status: string; payment_terms: string | null; retainage_percent: number | null; mobilization_status: string; assignment_status: string };

export function ProjectCommitmentsControl({ projectId, companyId, budget }: { projectId: string; companyId: string; budget: number | null }) {
  const client = useMemo(() => createClient(), []);
  const [labor, setLabor] = useState<LaborRow[]>([]);
  const [subcontracts, setSubcontracts] = useState<SubcontractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!client) { if (active) { setNotice("Commitment data is unavailable because the workspace connection is not configured."); setLoading(false); } return; }
      const db = client as unknown as {
        // New migration tables are intentionally accessed through the same scoped Supabase client before generated types are refreshed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: (table: string) => any;
      };
      const laborQuery = db.from("project_labor_commitments").select("compensation_method, rate, projected_hours, projected_days, projected_units, actual_hours, actual_days, actual_units").eq("company_id", companyId).eq("project_id", projectId);
      const subcontractQuery = db.from("trade_partner_assignments").select("contract_amount, contract_status, payment_terms, retainage_percent, mobilization_status, assignment_status").eq("company_id", companyId).eq("project_id", projectId);
      const [laborResult, subcontractResult] = await Promise.all([laborQuery, subcontractQuery]);
      if (!active) return;
      setLabor((laborResult.data || []) as LaborRow[]);
      setSubcontracts((subcontractResult.data || []) as SubcontractRow[]);
      if (laborResult.error || subcontractResult.error) setNotice("Some commitment details could not be loaded. Apply the project commitments migration and retry.");
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [client, companyId, projectId]);

  const summary = summarizeProjectCommitments({
    budget,
    labor: labor.map((row) => ({ method: row.compensation_method, rate: row.rate, projectedHours: row.projected_hours, projectedDays: row.projected_days, projectedUnits: row.projected_units, actualHours: row.actual_hours, actualDays: row.actual_days, actualUnits: row.actual_units })),
    signedSubcontracts: subcontracts.map((row) => ({ amount: row.contract_amount, status: row.contract_status })),
  });
  const signed = subcontracts.filter((item) => item.contract_status === "signed");
  const mobilized = signed.filter((item) => item.mobilization_status === "cleared" && item.assignment_status === "active");
  const money = (value: number | null) => value === null ? "Not provided" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

  return <section id="project-commitments" className="rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)] sm:p-5" aria-labelledby="project-commitments-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="project-commitments-title" className="text-lg font-extrabold text-[var(--bos-text-strong-on-light)]">Budget & Commitments</h2><p className="mt-1 text-xs font-medium text-[var(--bos-text-medium-on-light)]">Projected labor and signed subcontract obligations reduce available project budget.</p></div><Badge tone={summary.budgetRemainingAfterCommitments !== null && summary.budgetRemainingAfterCommitments < 0 ? "danger" : "info"}>{loading ? "Loading controls…" : `${money(summary.totalCommitted)} committed`}</Badge></div>
    {notice ? <p role="status" className="mt-3 rounded-[10px] bg-[var(--color-warning-100)] px-3 py-2 text-xs font-semibold text-[var(--color-warning-800)]">{notice}</p> : null}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Tile label="Projected labor" value={money(summary.laborProjected)} detail={`${labor.length} employee/crew plans`} />
      <Tile label="Actual labor" value={money(summary.laborActual)} detail="Approved cost captured" />
      <Tile label="Subcontracts" value={money(summary.subcontractCommitted)} detail={`${signed.length} signed commitments`} />
      <Tile label="Available budget" value={money(summary.budgetRemainingAfterCommitments)} detail="After commitments" danger={summary.budgetRemainingAfterCommitments !== null && summary.budgetRemainingAfterCommitments < 0} />
      <Tile label="Activated partners" value={`${mobilized.length} / ${signed.length}`} detail="Signed and cleared to mobilize" />
    </div>
    <div className="mt-4 flex flex-wrap justify-end gap-2"><Link href="/invoices/payroll"><Button variant="outline" size="sm">Manage compensation</Button></Link><Link href={`/projects/${projectId}?tab=crew`}><Button variant="outline" size="sm">Plan crew labor</Button></Link><Link href={`/projects/${projectId}?tab=subcontractors`}><Button size="sm">Manage subcontract commitments</Button></Link></div>
  </section>;
}

function Tile({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) {
  return <div className="rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className={`mt-1 text-lg font-extrabold ${danger ? "text-[var(--color-danger-700)]" : "text-[var(--bos-text-strong-on-light)]"}`}>{value}</p><p className="mt-1 text-xs font-medium text-[var(--bos-text-medium-on-light)]">{detail}</p></div>;
}
