"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button, ErrorState, FormField, Input, PageHeader, Select, Textarea, getButtonClassName } from "@/components/ui";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import { PROJECT_TYPE_OPTIONS } from "@/lib/projects";
import { PROJECT_STATUSES } from "@/lib/projects/statuses";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type FormState = {
  name: string;
  projectNumber: string;
  projectType: string;
  status: string;
  description: string;
  jobSiteName: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  estimatedStartDate: string;
  estimatedEndDate: string;
  estimatedCost: string;
  contractAmount: string;
  requiredDownPayment: string;
};

const EMPTY: FormState = {
  name: "", projectNumber: "", projectType: "", status: "lead", description: "", jobSiteName: "",
  primaryContactName: "", primaryContactPhone: "", primaryContactEmail: "", addressLine1: "", addressLine2: "",
  city: "", state: "", postalCode: "", estimatedStartDate: "", estimatedEndDate: "", estimatedCost: "",
  contractAmount: "", requiredDownPayment: "",
};

export default function EditProjectPage() {
  const params = useParams<{ id?: string | string[] }>();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [originalStatus, setOriginalStatus] = useState("lead");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const workspace = await resolveWorkspaceContext(supabase);
      if (!workspace.context || !supabase || !projectId) {
        if (active) { setError(workspace.errorMessage || "Project workspace is unavailable."); setLoading(false); }
        return;
      }
      const response = await supabase.from("projects").select("*").eq("company_id", workspace.context.companyId).eq("id", projectId).maybeSingle();
      if (active) {
        if (response.error || !response.data) setError(response.error?.message || "Project not found.");
        else {
          setForm(toForm(response.data));
          setOriginalStatus(response.data.status);
        }
        setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [projectId, supabase]);

  const update = (key: keyof FormState, value: string) => {
    setSuccess(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.name.trim()) { setError("Project name is required."); return; }
    if (form.status !== originalStatus) {
      setError("Project status changes require the confirmed status action. Restore the original status to save these details.");
      return;
    }
    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context || !supabase || !projectId) { setError(workspace.errorMessage || "Project workspace is unavailable."); return; }
    setSaving(true);
    try {
      const response = await supabase.from("projects").update({
      name: form.name.trim(), project_type: form.projectType || null, description: nullable(form.description),
      job_site_name: nullable(form.jobSiteName), primary_contact_name: nullable(form.primaryContactName),
      primary_contact_phone: nullable(form.primaryContactPhone), primary_contact_email: nullable(form.primaryContactEmail),
      address_line_1: nullable(form.addressLine1), address_line_2: nullable(form.addressLine2), city: nullable(form.city),
      state: nullable(form.state), postal_code: nullable(form.postalCode), estimated_start_date: form.estimatedStartDate || null,
      estimated_end_date: form.estimatedEndDate || null, estimated_cost: numberOrNull(form.estimatedCost),
      contract_amount: numberOrNull(form.contractAmount), required_down_payment: numberOrNull(form.requiredDownPayment) ?? 0,
      job_site_latitude: null, job_site_longitude: null, job_site_geocoded_at: null, updated_at: new Date().toISOString(),
    }).eq("company_id", workspace.context.companyId).eq("id", projectId).select("id").single();
      if (response.error) setError(response.error.message || "Unable to update project.");
      else {
        await createSupabaseOrionEventPublisher(supabase).publishEvent({
        company_id: workspace.context.companyId, actor_profile_id: workspace.context.userId, event_type: "project.updated",
        aggregate_type: "project", aggregate_id: projectId, source_module: "projects",
        payload: { project_id: projectId, name: form.name.trim(), scope_of_work: nullable(form.description), address: [form.addressLine1, form.city, form.state, form.postalCode].filter(Boolean).join(", ") },
        metadata: { source: "visible_project_edit_form" },
        }).catch((eventError) => console.error("Project updated event publish error:", eventError));
        setSuccess("Project changes and scope of work saved and verified in B.O.S.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update project.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-[var(--color-surface-subtle)]" />;
  if (error && !form.name) return <ErrorState title="Unable to open project editor" description={error} />;

  return (
    <div className="space-y-6" data-orion-project-editor={projectId}>
      <PageHeader title={`Edit ${form.name}`} description="Update the project record and operational scope of work. Orion can operate these controls while you watch." secondaryActions={<Link href={`/projects/${projectId}`} className={getButtonClassName({ variant: "outline" })}>Back to Project</Link>} />
      <form onSubmit={save} className="space-y-5">
        <FormSection title="Project Details">
          <Field label="Project Name" id="project-name"><Input id="project-name" data-orion-control="project.name" value={form.name} onChange={(e) => update("name", e.target.value)} required /></Field>
          <Field label="Project Number" id="project-number"><Input id="project-number" value={form.projectNumber} readOnly /></Field>
          <Field label="Project Type" id="project-type"><Select id="project-type" data-orion-control="project.type" value={form.projectType} onChange={(e) => update("projectType", e.target.value)}><option value="">Select type</option>{PROJECT_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Status" id="project-status"><Select id="project-status" data-orion-control="project.status" data-orion-confirmation="required" value={form.status} onChange={(e) => update("status", e.target.value)}>{PROJECT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <div id="project-scope" className="scroll-mt-24 md:col-span-2">
            <Field label="Scope of Work" id="project-description"><Textarea id="project-description" data-orion-control="project.description" value={form.description} onChange={(e) => update("description", e.target.value)} rows={10} /></Field>
            <p className="mt-2 text-xs font-medium leading-5 text-[var(--bos-text-medium-on-light)]">This is the live operational project scope shown throughout B.O.S. Updating it does not rewrite a customer-signed estimate or contract. Material customer-facing scope changes should be documented through a Change Order.</p>
          </div>
        </FormSection>

        <FormSection title="Jobsite and Contact">
          <Field label="Job Site Name" id="job-site-name"><Input id="job-site-name" data-orion-control="project.jobSiteName" value={form.jobSiteName} onChange={(e) => update("jobSiteName", e.target.value)} /></Field>
          <Field label="Primary Contact" id="primary-contact"><Input id="primary-contact" data-orion-control="project.primaryContactName" value={form.primaryContactName} onChange={(e) => update("primaryContactName", e.target.value)} /></Field>
          <Field label="Contact Phone" id="contact-phone"><Input id="contact-phone" data-orion-control="project.primaryContactPhone" value={form.primaryContactPhone} onChange={(e) => update("primaryContactPhone", e.target.value)} /></Field>
          <Field label="Contact Email" id="contact-email"><Input id="contact-email" type="email" data-orion-control="project.primaryContactEmail" value={form.primaryContactEmail} onChange={(e) => update("primaryContactEmail", e.target.value)} /></Field>
          <Field label="Address" id="address-1"><Input id="address-1" data-orion-control="project.addressLine1" value={form.addressLine1} onChange={(e) => update("addressLine1", e.target.value)} /></Field>
          <Field label="Address Line 2" id="address-2"><Input id="address-2" data-orion-control="project.addressLine2" value={form.addressLine2} onChange={(e) => update("addressLine2", e.target.value)} /></Field>
          <Field label="City" id="city"><Input id="city" data-orion-control="project.city" value={form.city} onChange={(e) => update("city", e.target.value)} /></Field>
          <Field label="State" id="state"><Input id="state" data-orion-control="project.state" value={form.state} onChange={(e) => update("state", e.target.value)} /></Field>
          <Field label="ZIP Code" id="postal-code"><Input id="postal-code" data-orion-control="project.postalCode" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} /></Field>
        </FormSection>

        <FormSection title="Schedule and Financials">
          <Field label="Estimated Start" id="estimated-start"><Input id="estimated-start" type="date" data-orion-control="project.estimatedStartDate" value={form.estimatedStartDate} onChange={(e) => update("estimatedStartDate", e.target.value)} /></Field>
          <Field label="Estimated Completion" id="estimated-end"><Input id="estimated-end" type="date" data-orion-control="project.estimatedEndDate" value={form.estimatedEndDate} onChange={(e) => update("estimatedEndDate", e.target.value)} /></Field>
          <Field label="Estimated Cost" id="estimated-cost"><Input id="estimated-cost" type="number" min="0" step="0.01" data-orion-control="project.estimatedCost" value={form.estimatedCost} onChange={(e) => update("estimatedCost", e.target.value)} /></Field>
          <Field label="Contract Amount" id="contract-amount"><Input id="contract-amount" type="number" min="0" step="0.01" data-orion-control="project.contractAmount" value={form.contractAmount} onChange={(e) => update("contractAmount", e.target.value)} /></Field>
          <Field label="Required Down Payment" id="down-payment"><Input id="down-payment" type="number" min="0" step="0.01" data-orion-control="project.requiredDownPayment" value={form.requiredDownPayment} onChange={(e) => update("requiredDownPayment", e.target.value)} /></Field>
        </FormSection>

        {error ? <p role="alert" data-orion-status className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {success ? <p role="status" data-orion-status className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{success}</p> : null}
        <div className="flex justify-end"><Button type="submit" size="lg" data-orion-action="project.save" data-orion-verify="navigation-or-status" disabled={saving}>{saving ? "Saving..." : "Save Project Changes"}</Button></div>
      </form>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-[var(--bos-border-light)] bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-[var(--bos-text-strong-on-light)]">{title}</h2><div className="mt-5 grid gap-5 md:grid-cols-2">{children}</div></section>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <FormField label={label} htmlFor={id}>{children}</FormField>; }
function nullable(value: string) { return value.trim() || null; }
function numberOrNull(value: string) { const parsed = Number(value); return value.trim() && Number.isFinite(parsed) ? parsed : null; }
function toForm(row: ProjectRow): FormState {
  return {
    name: row.name, projectNumber: row.project_number || "", projectType: row.project_type || "", status: row.status,
    description: row.description || "", jobSiteName: row.job_site_name || "", primaryContactName: row.primary_contact_name || "",
    primaryContactPhone: row.primary_contact_phone || "", primaryContactEmail: row.primary_contact_email || "",
    addressLine1: row.address_line_1 || "", addressLine2: row.address_line_2 || "", city: row.city || "", state: row.state || "",
    postalCode: row.postal_code || "", estimatedStartDate: row.estimated_start_date || "", estimatedEndDate: row.estimated_end_date || "",
    estimatedCost: row.estimated_cost == null ? "" : String(row.estimated_cost), contractAmount: row.contract_amount == null ? "" : String(row.contract_amount),
    requiredDownPayment: row.required_down_payment == null ? "" : String(row.required_down_payment),
  };
}