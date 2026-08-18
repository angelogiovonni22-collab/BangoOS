"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, PageHeader } from "@/components/ui";
import { loadPrevailingWageProjectCompliance } from "@/lib/finance/ap-prevailing-wage";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type ProfileRow = {
  id: string;
  project_id: string;
  applicability: string;
  jurisdiction: string;
  determination_number: string | null;
  determination_title: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  contracting_agency: string | null;
  certified_payroll_required: boolean;
  weekly_statement_required: boolean;
  wage_posting_required: boolean;
  completion_affidavit_required: boolean;
};

type ProjectRow = { id: string; name: string | null; project_number: string | null };
type PayrollRow = { id: string; project_id: string; week_ending_date: string; status: string; statement_of_compliance_signed: boolean };

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  then: PromiseLike<{ data: unknown; error: { message?: string } | null }>["then"];
};
type LooseClient = { from: (table: string) => QueryBuilder };

type ProjectCompliance = {
  profile: ProfileRow;
  projectName: string;
  compliantWorkers: number;
  deficientWorkers: number;
  estimatedDeficiency: number;
  payrollPeriods: number;
  payrollExceptions: number;
};

export default function PrevailingWagePage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ProjectCompliance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setErrorMessage("Unable to connect to B.O.S. compliance right now.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const workspace = await resolveWorkspaceContext(supabase);
    if (workspace.errorMessage || !workspace.context) {
      setErrorMessage(workspace.errorMessage || "Unable to load workspace.");
      setIsLoading(false);
      return;
    }

    try {
      const companyId = workspace.context.companyId;
      const db = supabase as unknown as LooseClient;
      const [profilesResult, projectsResult, payrollResult] = await Promise.all([
        db.from("prevailing_wage_project_profiles").select("id,project_id,applicability,jurisdiction,determination_number,determination_title,effective_date,expiration_date,contracting_agency,certified_payroll_required,weekly_statement_required,wage_posting_required,completion_affidavit_required").eq("company_id", companyId),
        db.from("projects").select("id,name,project_number").eq("company_id", companyId),
        db.from("certified_payroll_periods").select("id,project_id,week_ending_date,status,statement_of_compliance_signed").eq("company_id", companyId),
      ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message || "Unable to load prevailing wage profiles.");
      if (projectsResult.error) throw new Error(projectsResult.error.message || "Unable to load projects.");
      if (payrollResult.error) throw new Error(payrollResult.error.message || "Unable to load certified payroll.");

      const profiles = (Array.isArray(profilesResult.data) ? profilesResult.data : []) as ProfileRow[];
      const projects = (Array.isArray(projectsResult.data) ? projectsResult.data : []) as ProjectRow[];
      const payroll = (Array.isArray(payrollResult.data) ? payrollResult.data : []) as PayrollRow[];
      const projectNames = new Map(projects.map((row) => [row.id, row.name || row.project_number || "Project"]));

      const applicableProfiles = profiles.filter((row) => row.applicability !== "not_applicable");
      const complianceResults = await Promise.all(applicableProfiles.map(async (profile) => {
        const compliance = await loadPrevailingWageProjectCompliance({ supabase, companyId, projectId: profile.project_id });
        const projectPayroll = payroll.filter((row) => row.project_id === profile.project_id);
        const exceptions = projectPayroll.filter((row) => ["rejected", "corrected"].includes(row.status) || (row.status === "submitted" && !row.statement_of_compliance_signed)).length;
        return {
          profile,
          projectName: projectNames.get(profile.project_id) || "Project",
          compliantWorkers: compliance.compliantWorkerCount,
          deficientWorkers: compliance.deficientWorkerCount,
          estimatedDeficiency: compliance.totalEstimatedDeficiency,
          payrollPeriods: projectPayroll.length,
          payrollExceptions: exceptions,
        } satisfies ProjectCompliance;
      }));

      complianceResults.sort((a, b) => b.deficientWorkers - a.deficientWorkers || b.estimatedDeficiency - a.estimatedDeficiency || a.projectName.localeCompare(b.projectName));
      setItems(complianceResults);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load prevailing wage compliance.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const totals = items.reduce((acc, item) => ({
    projects: acc.projects + 1,
    compliant: acc.compliant + item.compliantWorkers,
    deficient: acc.deficient + item.deficientWorkers,
    deficiency: acc.deficiency + item.estimatedDeficiency,
    payroll: acc.payroll + item.payrollPeriods,
    exceptions: acc.exceptions + item.payrollExceptions,
  }), { projects: 0, compliant: 0, deficient: 0, deficiency: 0, payroll: 0, exceptions: 0 });

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow="COMMERCIAL · LABOR COMPLIANCE"
        title="Prevailing Wage"
        description="Track federal DBRA, Ohio public-improvement, wage determination, fringe, apprenticeship, certified payroll, and worker deficiency exposure by project."
        primaryAction={<Link href="/invoices/accounts-payable"><Button size="md">Accounts Payable</Button></Link>}
      />

      {errorMessage ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{errorMessage}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Covered Projects" value={String(totals.projects)} detail="Active prevailing-wage profiles" />
        <Metric label="Compliant Workers" value={String(totals.compliant)} detail="No detected deficiency" />
        <Metric label="Deficient Workers" value={String(totals.deficient)} detail="Needs payroll review" danger={totals.deficient > 0} />
        <Metric label="Estimated Deficiency" value={currency(totals.deficiency)} detail="Calculated wage exposure" danger={totals.deficiency > 0} />
        <Metric label="Payroll Periods" value={String(totals.payroll)} detail="Certified payroll records" />
        <Metric label="Payroll Exceptions" value={String(totals.exceptions)} detail="Rejected/corrected review" danger={totals.exceptions > 0} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bos-text-muted)]">Project compliance register</p><h2 className="mt-1 text-xl font-semibold">Covered commercial/public projects</h2></div>
          <Link href="/projects" className="text-sm font-semibold text-blue-400 hover:text-blue-300">Open Projects →</Link>
        </div>

        {isLoading ? <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-6 text-sm text-[var(--bos-text-secondary)]">Loading prevailing-wage compliance…</div> : null}
        {!isLoading && items.length === 0 ? <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-8 text-center"><p className="font-semibold">No covered prevailing-wage projects yet.</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">When a project is marked Federal DBRA, Ohio Public Improvement, or another prevailing-wage jurisdiction, it will appear here.</p></div> : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <article key={item.profile.id} className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bos-text-muted)]">{labelApplicability(item.profile.applicability)}</p><h3 className="mt-1 text-lg font-semibold">{item.projectName}</h3><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{item.profile.determination_title || item.profile.determination_number || item.profile.contracting_agency || "Wage determination configured"}</p></div>
                <ComplianceBadge deficient={item.deficientWorkers > 0 || item.estimatedDeficiency > 0} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniMetric label="Compliant" value={String(item.compliantWorkers)} />
                <MiniMetric label="Deficient" value={String(item.deficientWorkers)} danger={item.deficientWorkers > 0} />
                <MiniMetric label="Deficiency" value={currency(item.estimatedDeficiency)} danger={item.estimatedDeficiency > 0} />
                <MiniMetric label="Payroll" value={String(item.payrollPeriods)} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--bos-text-secondary)]">
                {item.profile.certified_payroll_required ? <Flag>Certified payroll</Flag> : null}
                {item.profile.weekly_statement_required ? <Flag>Weekly statement</Flag> : null}
                {item.profile.wage_posting_required ? <Flag>Wage posting</Flag> : null}
                {item.profile.completion_affidavit_required ? <Flag>Completion affidavit</Flag> : null}
                {item.profile.effective_date ? <Flag>Effective {item.profile.effective_date}</Flag> : null}
              </div>

              <div className="mt-5 border-t border-[var(--bos-border-subtle)] pt-4">
                <Link href={`/projects/${item.profile.project_id}`} className="text-sm font-semibold text-blue-400 hover:text-blue-300">Open project workspace →</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) {
  return <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bos-text-muted)]">{label}</p><p className={`mt-2 text-2xl font-bold ${danger ? "text-red-400" : "text-[var(--bos-text-primary)]"}`}>{value}</p><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">{detail}</p></div>;
}
function MiniMetric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-xl bg-[var(--bos-bg-control)] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">{label}</p><p className={`mt-1 font-bold ${danger ? "text-red-400" : ""}`}>{value}</p></div>; }
function Flag({ children }: { children: ReactNode }) { return <span className="rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-2.5 py-1">{children}</span>; }
function ComplianceBadge({ deficient }: { deficient: boolean }) { return <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${deficient ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>{deficient ? "Review required" : "Compliant"}</span>; }
function labelApplicability(value: string) { if (value === "federal_dbra") return "Federal DBRA"; if (value === "ohio_public_improvement") return "Ohio Public Improvement"; if (value === "state_local_other") return "State / Local Prevailing Wage"; return value.replaceAll("_", " "); }
function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0); }
