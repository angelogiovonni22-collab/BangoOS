"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";

type ProjectRow = { id: string; name: string | null; project_number: string | null; city: string | null; state: string | null };
type SavedProfile = { id: string; project_id: string };
type ExistingProfile = {
  id: string;
  project_id: string;
  applicability: string;
  determination_number: string | null;
  determination_title: string | null;
  contracting_agency: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  wage_source_url: string | null;
  notes: string | null;
  created_by: string | null;
};

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => QueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
  then: PromiseLike<{ data: unknown; error: { message?: string } | null }>["then"];
};
type LooseClient = { from: (table: string) => QueryBuilder };

const PREVAILING_WRITE_ROLES = new Set(["owner", "administrator", "operations_manager", "office_manager", "accountant", "project_manager", "superintendent"]);

export default function PrevailingWageSetupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("projectId") || "");
  const [existingCreatedBy, setExistingCreatedBy] = useState<string | null>(null);
  const [applicability, setApplicability] = useState("federal_dbra");
  const [determinationNumber, setDeterminationNumber] = useState("");
  const [determinationTitle, setDeterminationTitle] = useState("");
  const [contractingAgency, setContractingAgency] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [wageSourceUrl, setWageSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) { if (active) { setErrorMessage("Unable to connect to B.O.S. compliance."); setIsLoading(false); } return; }
      const resolved = await resolveWorkspaceContext(supabase);
      if (!resolved.context) { if (active) { setErrorMessage(resolved.errorMessage || "Unable to load workspace."); setIsLoading(false); } return; }
      if (!PREVAILING_WRITE_ROLES.has((resolved.context.role || "").toLowerCase())) { if (active) { setErrorMessage("Your role cannot configure prevailing-wage projects."); setIsLoading(false); } return; }

      const db = supabase as unknown as LooseClient;
      const result = await db.from("projects").select("id,name,project_number,city,state").eq("company_id", resolved.context.companyId);
      if (!active) return;
      if (result.error) { setErrorMessage(result.error.message || "Unable to load projects."); setIsLoading(false); return; }
      const rows = (Array.isArray(result.data) ? result.data : []) as ProjectRow[];
      rows.sort((a, b) => (a.name || a.project_number || "").localeCompare(b.name || b.project_number || ""));
      setWorkspace(resolved.context);
      setProjects(rows);
      setIsLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    const resetProfile = () => {
      setExistingCreatedBy(null);
      setApplicability("federal_dbra");
      setDeterminationNumber("");
      setDeterminationTitle("");
      setContractingAgency("");
      setEffectiveDate("");
      setExpirationDate("");
      setWageSourceUrl("");
      setNotes("");
    };

    const loadProfile = async () => {
      if (!supabase || !workspace || !projectId) {
        if (active) resetProfile();
        return;
      }

      setIsLoadingProfile(true);
      setErrorMessage(null);
      const db = supabase as unknown as LooseClient;
      const result = await db.from("prevailing_wage_project_profiles")
        .select("id,project_id,applicability,determination_number,determination_title,contracting_agency,effective_date,expiration_date,wage_source_url,notes,created_by")
        .eq("company_id", workspace.companyId)
        .eq("project_id", projectId)
        .maybeSingle();

      if (!active) return;
      if (result.error) {
        setErrorMessage(result.error.message || "Unable to load the existing prevailing-wage profile.");
        setIsLoadingProfile(false);
        return;
      }

      if (!result.data) {
        resetProfile();
        setIsLoadingProfile(false);
        return;
      }

      const profile = result.data as ExistingProfile;
      setExistingCreatedBy(profile.created_by);
      setApplicability(profile.applicability || "federal_dbra");
      setDeterminationNumber(profile.determination_number || "");
      setDeterminationTitle(profile.determination_title || "");
      setContractingAgency(profile.contracting_agency || "");
      setEffectiveDate(profile.effective_date || "");
      setExpirationDate(profile.expiration_date || "");
      setWageSourceUrl(profile.wage_source_url || "");
      setNotes(profile.notes || "");
      setIsLoadingProfile(false);
    };

    void loadProfile();
    return () => { active = false; };
  }, [projectId, supabase, workspace]);

  const selectedProject = projects.find((project) => project.id === projectId) || null;
  const federal = applicability === "federal_dbra";
  const ohio = applicability === "ohio_public_improvement";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !workspace || !projectId) { setErrorMessage("Select a project before saving."); return; }
    if (isLoadingProfile) { setErrorMessage("Wait for the existing project profile to finish loading before saving."); return; }
    if (expirationDate && effectiveDate && expirationDate < effectiveDate) { setErrorMessage("Expiration date cannot be before the effective date."); return; }

    setIsSaving(true);
    setErrorMessage(null);
    const db = supabase as unknown as LooseClient;
    const result = await db.from("prevailing_wage_project_profiles").upsert({
      company_id: workspace.companyId,
      project_id: projectId,
      applicability,
      jurisdiction: federal ? "federal" : ohio ? "ohio" : applicability === "not_applicable" ? "none" : "other",
      determination_number: determinationNumber.trim() || null,
      determination_title: determinationTitle.trim() || null,
      effective_date: effectiveDate || null,
      expiration_date: expirationDate || null,
      wage_source_url: wageSourceUrl.trim() || null,
      contracting_agency: contractingAgency.trim() || null,
      project_number: selectedProject?.project_number || null,
      certified_payroll_required: applicability !== "not_applicable",
      weekly_statement_required: federal,
      wage_posting_required: federal || ohio,
      completion_affidavit_required: ohio,
      lower_tier_tracking_required: applicability !== "not_applicable",
      notes: notes.trim() || null,
      created_by: existingCreatedBy || workspace.userId,
      updated_by: workspace.userId,
    }, { onConflict: "company_id,project_id" }).select("id,project_id").maybeSingle();

    if (result.error || !result.data) { setErrorMessage(result.error?.message || "Unable to save prevailing-wage profile."); setIsSaving(false); return; }
    const saved = result.data as SavedProfile;
    router.push(`/invoices/prevailing-wage/${saved.project_id}`);
    router.refresh();
  };

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader compact eyebrow="COMMERCIAL · LABOR COMPLIANCE" title="Configure Prevailing Wage" description="Attach the governing wage determination and reporting controls to a B.O.S. project before classifications, workers, and certified payroll are processed." />

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-6 shadow-[var(--shadow-card)]">
        {errorMessage ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{errorMessage}</div> : null}
        {isLoading ? <p className="text-sm text-[var(--bos-text-secondary)]">Loading projects…</p> : workspace ? <>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Project" required><select className="bos-input" value={projectId} onChange={(e) => setProjectId(e.target.value)} required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name || project.project_number || "Project"}{project.city || project.state ? ` · ${[project.city, project.state].filter(Boolean).join(", ")}` : ""}</option>)}</select></Field>
            <Field label="Applicability" required><select className="bos-input" value={applicability} onChange={(e) => setApplicability(e.target.value)} disabled={isLoadingProfile}><option value="federal_dbra">Federal Davis-Bacon / Related Acts</option><option value="ohio_public_improvement">Ohio Public Improvement</option><option value="state_local_other">Other State / Local Prevailing Wage</option><option value="not_applicable">Not Applicable</option></select></Field>
            <Field label="Wage Determination Number"><input className="bos-input" value={determinationNumber} onChange={(e) => setDeterminationNumber(e.target.value)} placeholder="Example: OH2026-0001" disabled={isLoadingProfile} /></Field>
            <Field label="Determination / Schedule Title"><input className="bos-input" value={determinationTitle} onChange={(e) => setDeterminationTitle(e.target.value)} placeholder="Building, highway, heavy, county schedule…" disabled={isLoadingProfile} /></Field>
            <Field label="Contracting Agency"><input className="bos-input" value={contractingAgency} onChange={(e) => setContractingAgency(e.target.value)} placeholder="Public authority / federal agency" disabled={isLoadingProfile} /></Field>
            <Field label="Official Wage Source"><input type="url" className="bos-input" value={wageSourceUrl} onChange={(e) => setWageSourceUrl(e.target.value)} placeholder="https://…" disabled={isLoadingProfile} /></Field>
            <Field label="Effective Date"><input type="date" className="bos-input" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} disabled={isLoadingProfile} /></Field>
            <Field label="Expiration Date"><input type="date" className="bos-input" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} disabled={isLoadingProfile} /></Field>
          </div>

          {isLoadingProfile ? <div className="rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] p-4 text-sm text-[var(--bos-text-secondary)]">Loading the saved compliance profile…</div> : null}

          <div className="rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] p-4 text-sm text-[var(--bos-text-secondary)]">
            {federal ? "Federal DBRA defaults on weekly certified payroll, a signed Statement of Compliance, wage posting, and lower-tier tracking." : ohio ? "Ohio public-improvement defaults on certified payroll tracking, wage-schedule posting, lower-tier tracking, and the completion affidavit. Ohio filing cadence depends on project duration and the statutory reporting schedule." : "B.O.S. stores project-specific controls so the contract and governing authority remain the source of truth."}
          </div>

          <Field label="Compliance Notes"><textarea className="bos-input min-h-28" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agency instructions, coordinator, special wage determination notes, reporting cadence…" disabled={isLoadingProfile} /></Field>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--bos-border-subtle)] pt-5">
            <Link href="/invoices/prevailing-wage" className="inline-flex h-10 items-center rounded-lg border border-[var(--bos-border-default)] px-4 text-sm font-semibold hover:bg-[var(--bos-bg-hover)]">Cancel</Link>
            <Button type="submit" size="md" disabled={isSaving || isLoadingProfile}>{isSaving ? "Saving…" : isLoadingProfile ? "Loading Profile…" : "Save & Configure Rates"}</Button>
          </div>
        </> : null}
      </form>
    </div>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="space-y-2"><span className="text-sm font-semibold text-[var(--bos-text-primary)]">{label}{required ? <span className="ml-1 text-red-400">*</span> : null}</span>{children}</label>;
}
