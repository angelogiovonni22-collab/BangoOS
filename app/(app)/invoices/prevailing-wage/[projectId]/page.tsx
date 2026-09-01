"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, PageHeader, getButtonClassName } from "@/components/ui";
import { loadPrevailingWageProjectCompliance } from "@/lib/finance/ap-prevailing-wage";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";

type ProfileRow = { id: string; project_id: string; applicability: string; jurisdiction: string; determination_number: string | null; determination_title: string | null; effective_date: string | null; expiration_date: string | null; wage_source_url: string | null; contracting_agency: string | null; certified_payroll_required: boolean; weekly_statement_required: boolean; wage_posting_required: boolean; completion_affidavit_required: boolean; lower_tier_tracking_required: boolean };
type ProjectRow = { id: string; name: string | null; project_number: string | null; city: string | null; state: string | null };
type ClassificationRow = { id: string; classification_code: string | null; classification_name: string; trade_group: string | null; county: string | null; base_hourly_rate: number; fringe_hourly_rate: number; combined_hourly_rate: number; overtime_multiplier: number; apprentice_allowed: boolean; effective_date: string | null; expiration_date: string | null; active: boolean };
type PayrollRow = { id: string; week_ending_date: string; payroll_number: string | null; status: string; statement_of_compliance_signed: boolean; final_payroll: boolean; submitted_at: string | null; records_retain_until: string | null };

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  insert: (values: Record<string, unknown>) => QueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
  then: PromiseLike<{ data: unknown; error: { message?: string } | null }>["then"];
};
type LooseClient = { from: (table: string) => QueryBuilder };

const WRITE_ROLES = new Set(["owner", "administrator", "operations_manager", "office_manager", "accountant", "project_manager", "superintendent"]);

export default function PrevailingWageProjectPage() {
  const params = useParams<{ projectId?: string | string[] }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [classifications, setClassifications] = useState<ClassificationRow[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [compliantWorkers, setCompliantWorkers] = useState(0);
  const [deficientWorkers, setDeficientWorkers] = useState(0);
  const [estimatedDeficiency, setEstimatedDeficiency] = useState(0);
  const [classificationName, setClassificationName] = useState("");
  const [classificationCode, setClassificationCode] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [fringeRate, setFringeRate] = useState("");
  const [overtimeMultiplier, setOvertimeMultiplier] = useState("1.5");
  const [apprenticeAllowed, setApprenticeAllowed] = useState(false);
  const [weekEnding, setWeekEnding] = useState("");
  const [payrollNumber, setPayrollNumber] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [isSavingPayroll, setIsSavingPayroll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !projectId) { setErrorMessage("Unable to resolve prevailing-wage project."); setIsLoading(false); return; }
    setIsLoading(true);
    setErrorMessage(null);
    const resolved = await resolveWorkspaceContext(supabase);
    if (!resolved.context) { setErrorMessage(resolved.errorMessage || "Unable to load workspace."); setIsLoading(false); return; }

    const db = supabase as unknown as LooseClient;
    const [projectResult, profileResult] = await Promise.all([
      db.from("projects").select("id,name,project_number,city,state").eq("company_id", resolved.context.companyId).eq("id", projectId).maybeSingle(),
      db.from("prevailing_wage_project_profiles").select("id,project_id,applicability,jurisdiction,determination_number,determination_title,effective_date,expiration_date,wage_source_url,contracting_agency,certified_payroll_required,weekly_statement_required,wage_posting_required,completion_affidavit_required,lower_tier_tracking_required").eq("company_id", resolved.context.companyId).eq("project_id", projectId).maybeSingle(),
    ]);

    if (projectResult.error || profileResult.error || !projectResult.data || !profileResult.data) {
      setErrorMessage(projectResult.error?.message || profileResult.error?.message || "Prevailing-wage profile not found for this project.");
      setIsLoading(false);
      return;
    }

    const loadedProfile = profileResult.data as ProfileRow;
    const [classificationResult, payrollResult, compliance] = await Promise.all([
      db.from("prevailing_wage_classifications").select("id,classification_code,classification_name,trade_group,county,base_hourly_rate,fringe_hourly_rate,combined_hourly_rate,overtime_multiplier,apprentice_allowed,effective_date,expiration_date,active").eq("company_id", resolved.context.companyId).eq("profile_id", loadedProfile.id).order("classification_name", { ascending: true }),
      db.from("certified_payroll_periods").select("id,week_ending_date,payroll_number,status,statement_of_compliance_signed,final_payroll,submitted_at,records_retain_until").eq("company_id", resolved.context.companyId).eq("project_id", projectId).order("week_ending_date", { ascending: false }),
      loadPrevailingWageProjectCompliance({ supabase, companyId: resolved.context.companyId, projectId }),
    ]);

    if (classificationResult.error || payrollResult.error) {
      setErrorMessage(classificationResult.error?.message || payrollResult.error?.message || "Unable to load wage operations.");
      setIsLoading(false);
      return;
    }

    setWorkspace(resolved.context);
    setProject(projectResult.data as ProjectRow);
    setProfile(loadedProfile);
    setClassifications((Array.isArray(classificationResult.data) ? classificationResult.data : []) as ClassificationRow[]);
    setPayroll((Array.isArray(payrollResult.data) ? payrollResult.data : []) as PayrollRow[]);
    setCompliantWorkers(compliance.compliantWorkerCount);
    setDeficientWorkers(compliance.deficientWorkerCount);
    setEstimatedDeficiency(compliance.totalEstimatedDeficiency);
    setIsLoading(false);
  }, [projectId, supabase]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const canWrite = Boolean(workspace && WRITE_ROLES.has((workspace.role || "").toLowerCase()));

  const createClassification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !workspace || !profile || !canWrite) return;
    const base = Number(baseRate);
    const fringe = Number(fringeRate || 0);
    const overtime = Number(overtimeMultiplier || 1.5);
    if (!classificationName.trim() || !Number.isFinite(base) || base < 0 || !Number.isFinite(fringe) || fringe < 0 || !Number.isFinite(overtime) || overtime < 1) { setErrorMessage("Enter a classification name and valid non-negative wage/fringe rates."); return; }

    setIsSavingRate(true);
    setErrorMessage(null);
    const db = supabase as unknown as LooseClient;
    const result = await db.from("prevailing_wage_classifications").insert({ company_id: workspace.companyId, profile_id: profile.id, classification_code: classificationCode.trim() || null, classification_name: classificationName.trim(), base_hourly_rate: base, fringe_hourly_rate: fringe, overtime_multiplier: overtime, apprentice_allowed: apprenticeAllowed, effective_date: profile.effective_date, expiration_date: profile.expiration_date, active: true, source_reference: profile.wage_source_url || profile.determination_number, created_by: workspace.userId, updated_by: workspace.userId }).select("id").maybeSingle();
    if (result.error) { setErrorMessage(result.error.message || "Unable to add wage classification."); setIsSavingRate(false); return; }
    setClassificationName(""); setClassificationCode(""); setBaseRate(""); setFringeRate(""); setOvertimeMultiplier("1.5"); setApprenticeAllowed(false); setIsSavingRate(false); await load();
  };

  const createPayrollPeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !workspace || !profile || !project || !projectId || !canWrite) return;
    if (!weekEnding) { setErrorMessage("Week-ending date is required."); return; }

    setIsSavingPayroll(true);
    setErrorMessage(null);
    const db = supabase as unknown as LooseClient;
    const location = [project.city, project.state].filter(Boolean).join(", ");
    const result = await db.from("certified_payroll_periods").insert({ company_id: workspace.companyId, project_id: projectId, week_ending_date: weekEnding, payroll_number: payrollNumber.trim() || null, status: "draft", statement_of_compliance_signed: false, final_payroll: false, business_name_snapshot: workspace.companyName, project_name_snapshot: project.name || project.project_number, project_location_snapshot: location || null, contract_number_snapshot: project.project_number, wage_determination_snapshot: profile.determination_number || profile.determination_title, created_by: workspace.userId, updated_by: workspace.userId }).select("id").maybeSingle();
    if (result.error) { setErrorMessage(result.error.message || "Unable to create certified payroll period."); setIsSavingPayroll(false); return; }
    setWeekEnding(""); setPayrollNumber(""); setIsSavingPayroll(false); await load();
  };

  if (isLoading) return <div className="container-content py-10 text-sm text-[var(--bos-text-secondary)]">Loading prevailing-wage workspace…</div>;

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader compact eyebrow="COMMERCIAL · PREVAILING WAGE" title={project?.name || project?.project_number || "Prevailing Wage Project"} description={`${labelApplicability(profile?.applicability || "")} · ${profile?.determination_number || profile?.determination_title || "Wage determination configured"}`} primaryAction={<Link href="/invoices/prevailing-wage/setup" className={getButtonClassName({ size: "md" })}>Edit / Configure Project</Link>} />
      {errorMessage ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{errorMessage}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Classifications" value={String(classifications.filter((row) => row.active).length)} detail="Active wage rates" />
        <Metric label="Compliant Workers" value={String(compliantWorkers)} detail="No detected deficiency" />
        <Metric label="Deficient Workers" value={String(deficientWorkers)} detail="Requires review" danger={deficientWorkers > 0} />
        <Metric label="Estimated Deficiency" value={currency(estimatedDeficiency)} detail="Calculated exposure" danger={estimatedDeficiency > 0} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">Wage determination</p><h2 className="mt-1 text-lg font-semibold">Classifications & Rates</h2></div><span className="text-xs text-[var(--bos-text-muted)]">Base + fringe + OT</span></div>
          <div className="mt-4 space-y-2">{classifications.length === 0 ? <p className="text-sm text-[var(--bos-text-secondary)]">No classifications loaded yet.</p> : classifications.map((row) => <div key={row.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-[var(--bos-bg-control)] p-3"><div><p className="font-semibold">{row.classification_name}</p><p className="text-xs text-[var(--bos-text-muted)]">{row.classification_code || "No code"}{row.apprentice_allowed ? " · Apprentice allowed" : ""}</p></div><div className="text-right"><p className="font-bold">{currency2(row.combined_hourly_rate)}/hr</p><p className="text-xs text-[var(--bos-text-muted)]">{currency2(row.base_hourly_rate)} + {currency2(row.fringe_hourly_rate)} fringe</p></div></div>)}</div>
          {canWrite ? <form onSubmit={createClassification} className="mt-5 grid gap-3 border-t border-[var(--bos-border-subtle)] pt-4 sm:grid-cols-2"><input className="bos-input" value={classificationName} onChange={(e) => setClassificationName(e.target.value)} placeholder="Classification name" required /><input className="bos-input" value={classificationCode} onChange={(e) => setClassificationCode(e.target.value)} placeholder="Code (optional)" /><input className="bos-input" type="number" min="0" step="0.0001" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} placeholder="Base hourly rate" required /><input className="bos-input" type="number" min="0" step="0.0001" value={fringeRate} onChange={(e) => setFringeRate(e.target.value)} placeholder="Fringe hourly rate" /><input className="bos-input" type="number" min="1" step="0.0001" value={overtimeMultiplier} onChange={(e) => setOvertimeMultiplier(e.target.value)} placeholder="OT multiplier" /><label className="flex items-center gap-2 rounded-lg border border-[var(--bos-border-default)] px-3 text-sm"><input type="checkbox" checked={apprenticeAllowed} onChange={(e) => setApprenticeAllowed(e.target.checked)} /> Apprentice allowed</label><div className="sm:col-span-2 flex justify-end"><Button type="submit" size="md" disabled={isSavingRate}>{isSavingRate ? "Saving…" : "Add Classification"}</Button></div></form> : null}
        </div>

        <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">Certified payroll</p><h2 className="mt-1 text-lg font-semibold">Reporting Periods</h2></div>
          <div className="mt-4 space-y-2">{payroll.length === 0 ? <p className="text-sm text-[var(--bos-text-secondary)]">No certified payroll periods created yet.</p> : payroll.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bos-bg-control)] p-3"><div><p className="font-semibold">Week ending {row.week_ending_date}</p><p className="text-xs text-[var(--bos-text-muted)]">{row.payroll_number || "No payroll number"}{row.final_payroll ? " · Final" : ""}</p></div><div className="text-right"><Status status={row.status} /><p className="mt-1 text-[10px] text-[var(--bos-text-muted)]">{row.statement_of_compliance_signed ? "Statement signed" : "Statement pending"}</p></div></div>)}</div>
          {canWrite ? <form onSubmit={createPayrollPeriod} className="mt-5 grid gap-3 border-t border-[var(--bos-border-subtle)] pt-4 sm:grid-cols-2"><input className="bos-input" type="date" value={weekEnding} onChange={(e) => setWeekEnding(e.target.value)} required /><input className="bos-input" value={payrollNumber} onChange={(e) => setPayrollNumber(e.target.value)} placeholder="Payroll number (optional)" /><div className="sm:col-span-2 flex justify-end"><Button type="submit" size="md" disabled={isSavingPayroll}>{isSavingPayroll ? "Saving…" : "Create Payroll Period"}</Button></div></form> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">Required controls</p><div className="mt-3 flex flex-wrap gap-2">{profile?.certified_payroll_required ? <Flag>Certified payroll</Flag> : null}{profile?.weekly_statement_required ? <Flag>Weekly Statement of Compliance</Flag> : null}{profile?.wage_posting_required ? <Flag>Wage schedule posting</Flag> : null}{profile?.completion_affidavit_required ? <Flag>Completion affidavit</Flag> : null}{profile?.lower_tier_tracking_required ? <Flag>Lower-tier tracking</Flag> : null}</div><p className="mt-4 text-xs text-[var(--bos-text-secondary)]">B.O.S. keeps the governing determination and project-specific controls attached to the project. The contracting authority and incorporated contract requirements remain authoritative for filing cadence and submission format.</p></section>
    </div>
  );
}

function Metric({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) { return <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bos-text-muted)]">{label}</p><p className={`mt-2 text-2xl font-bold ${danger ? "text-red-400" : ""}`}>{value}</p><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">{detail}</p></div>; }
function Flag({ children }: { children: React.ReactNode }) { return <span className="rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-2.5 py-1 text-xs text-[var(--bos-text-secondary)]">{children}</span>; }
function Status({ status }: { status: string }) { return <span className="rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]">{status.replaceAll("_", " ")}</span>; }
function labelApplicability(value: string) { if (value === "federal_dbra") return "Federal DBRA"; if (value === "ohio_public_improvement") return "Ohio Public Improvement"; if (value === "state_local_other") return "State / Local Prevailing Wage"; return value.replaceAll("_", " "); }
function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0); }
function currency2(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0); }
