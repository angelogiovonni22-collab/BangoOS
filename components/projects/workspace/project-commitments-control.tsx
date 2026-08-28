"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { summarizeProjectCommitments, type CompensationMethod } from "@/lib/projects/project-commitments";

type LaborRow = {
  id: string;
  employee_id: string | null;
  crew_id: string | null;
  compensation_method: CompensationMethod;
  rate: number;
  projected_hours: number;
  projected_days: number;
  projected_units: number;
  lump_sum_amount: number;
  actual_hours: number;
  actual_days: number;
  actual_units: number;
  actual_cost_override: number | null;
};
type TimeRow = { employee_id: string; started_at: string; ended_at: string | null; break_minutes: number | null };
type SubcontractRow = { contract_amount: number | null; contract_status: string; payment_terms: string | null; retainage_percent: number | null; mobilization_status: string; assignment_status: string };
type SubcontractChangeRow = { amount_delta: number | null; status: string };

export function ProjectCommitmentsControl({ projectId, companyId, budget }: { projectId: string; companyId: string; budget: number | null }) {
  const client = useMemo(() => createClient(), []);
  const [labor, setLabor] = useState<LaborRow[]>([]);
  const [time, setTime] = useState<TimeRow[]>([]);
  const [subcontracts, setSubcontracts] = useState<SubcontractRow[]>([]);
  const [subcontractChanges, setSubcontractChanges] = useState<SubcontractChangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!client) { if (active) { setNotice("Commitment data is unavailable because the workspace connection is not configured."); setLoading(false); } return; }
      const db = client as unknown as {
        // Migration-backed project controls intentionally use the scoped client before generated types are refreshed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: (table: string) => any;
      };
      const laborQuery = db.from("project_labor_commitments").select("id,employee_id,crew_id,compensation_method,rate,projected_hours,projected_days,projected_units,lump_sum_amount,actual_hours,actual_days,actual_units,actual_cost_override").eq("company_id", companyId).eq("project_id", projectId);
      const subcontractQuery = db.from("trade_partner_assignments").select("contract_amount,contract_status,payment_terms,retainage_percent,mobilization_status,assignment_status").eq("company_id", companyId).eq("project_id", projectId);
      const subcontractChangeQuery = db.from("subcontractor_change_orders").select("amount_delta,status").eq("company_id", companyId).eq("project_id", projectId).eq("status", "approved");
      const timeQuery = db.from("workforce_time_entries").select("employee_id,started_at,ended_at,break_minutes").eq("company_id", companyId).eq("project_id", projectId).eq("status", "approved").not("ended_at", "is", null);
      const [laborResult, subcontractResult, subcontractChangeResult, timeResult] = await Promise.all([laborQuery, subcontractQuery, subcontractChangeQuery, timeQuery]);
      if (!active) return;
      setLabor((laborResult.data || []) as LaborRow[]);
      setSubcontracts((subcontractResult.data || []) as SubcontractRow[]);
      setSubcontractChanges((subcontractChangeResult.data || []) as SubcontractChangeRow[]);
      setTime((timeResult.data || []) as TimeRow[]);
      if (laborResult.error) setNotice("Project labor commitments are not available yet. Apply the project commitments migration and retry.");
      else if (subcontractResult.error || subcontractChangeResult.error || timeResult.error) setNotice("Some live job-cost details could not be loaded.");
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [client, companyId, projectId]);

  const approvedHours = useMemo(() => {
    const result = new Map<string, number>();
    for (const entry of time) {
      if (!entry.ended_at) continue;
      const start = new Date(entry.started_at).getTime();
      const end = new Date(entry.ended_at).getTime();
      const hours = Math.max(0, (end - start) / 3_600_000 - Number(entry.break_minutes || 0) / 60);
      result.set(entry.employee_id, (result.get(entry.employee_id) || 0) + hours);
    }
    return result;
  }, [time]);

  const approvedSubcontractChangeTotal = subcontractChanges.reduce((sum, row) => sum + Number(row.amount_delta || 0), 0);
  const summary = summarizeProjectCommitments({
    budget,
    labor: labor.map((row) => ({
      method: row.compensation_method,
      rate: Number(row.rate || 0),
      projectedHours: Number(row.projected_hours || 0),
      projectedDays: Number(row.projected_days || 0),
      projectedUnits: Number(row.projected_units || 0),
      lumpSumAmount: Number(row.lump_sum_amount || 0),
      actualHours: row.employee_id ? approvedHours.get(row.employee_id) ?? Number(row.actual_hours || 0) : Number(row.actual_hours || 0),
      actualDays: Number(row.actual_days || 0),
      actualUnits: Number(row.actual_units || 0),
      actualCostOverride: row.actual_cost_override,
    })),
    signedSubcontracts: [
      ...subcontracts.map((row) => ({ amount: row.contract_amount, status: row.contract_status })),
      ...subcontractChanges.filter((row) => row.status === "approved").map((row) => ({ amount: Number(row.amount_delta || 0), status: "signed" })),
    ],
  });
  const signed = subcontracts.filter((item) => ["signed", "closed"].includes(item.contract_status));
  const mobilized = signed.filter((item) => item.mobilization_status === "cleared" && item.assignment_status === "active");
  const money = (value: number | null) => value === null ? "Not provided" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

  return <section id="project-commitments" className="rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)] sm:p-5" aria-labelledby="project-commitments-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="project-commitments-title" className="text-lg font-extrabold text-[var(--bos-text-strong-on-light)]">Budget & Commitments</h2><p className="mt-1 text-xs font-medium text-[var(--bos-text-medium-on-light)]">Approved-time labor, executed subcontracts, and approved subcontract change orders are tied back to this project budget.</p></div><Badge tone={summary.budgetRemainingAfterCommitments !== null && summary.budgetRemainingAfterCommitments < 0 ? "danger" : "info"}>{loading ? "Loading controls…" : `${money(summary.totalCommitted)} committed`}</Badge></div>
    {notice ? <p role="status" className="mt-3 rounded-[10px] bg-[var(--color-warning-100)] px-3 py-2 text-xs font-semibold text-[var(--color-warning-800)]">{notice}</p> : null}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Tile label="Projected labor" value={money(summary.laborProjected)} detail={`${labor.length} labor commitments`} />
      <Tile label="Actual labor" value={money(summary.laborActual)} detail="Approved project time" />
      <Tile label="Subcontracts" value={money(summary.subcontractCommitted)} detail={`${signed.length} executed · ${money(approvedSubcontractChangeTotal)} changes`} />
      <Tile label="Available budget" value={money(summary.budgetRemainingAfterCommitments)} detail="After commitments" danger={summary.budgetRemainingAfterCommitments !== null && summary.budgetRemainingAfterCommitments < 0} />
      <Tile label="Activated partners" value={`${mobilized.length} / ${signed.length}`} detail="Signed and cleared" />
    </div>
    <div className="mt-4 flex flex-wrap justify-end gap-2"><Link href="/invoices/payroll"><Button variant="outline" size="sm">Manage employee pay</Button></Link><Link href={`/projects/${projectId}?tab=crew`}><Button variant="outline" size="sm">Crew cost details</Button></Link><Link href={`/projects/${projectId}?tab=subcontractors`}><Button size="sm">Subcontract commitments</Button></Link></div>
  </section>;
}

function Tile({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) {
  return <div className="rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className={`mt-1 text-lg font-extrabold ${danger ? "text-[var(--color-danger-700)]" : "text-[var(--bos-text-strong-on-light)]"}`}>{value}</p><p className="mt-1 text-xs font-medium text-[var(--bos-text-medium-on-light)]">{detail}</p></div>;
}
