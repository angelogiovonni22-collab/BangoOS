"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { ArrowUpRight, Building2, ClipboardCheck, Star, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, ErrorState, FormField, Input, SearchInput, Select, SkeletonLoader } from "@/components/ui";
import { SubcontractorContractActions } from "./subcontractor-contract-actions";
import {
  createTradePartnerAssignmentsService,
  TradePartnerAssignmentsError,
  type CreateTradePartnerAssignmentInput,
  type TradePartnerAssignment,
  type TradePartnerAssignmentStatus,
  type UpdateTradePartnerAssignmentInput,
} from "@/lib/trade-partners";
import { createVendorsService, type VendorOption, VendorsServiceError } from "@/lib/vendors/service";

type ProjectTradePartnersWorkspaceProps = { projectId: string };
type SubPayMethod = "lump_sum" | "hourly" | "day_rate" | "unit_rate" | "prevailing_wage";
type AssignmentFormState = {
  vendorId: string;
  tradeName: string;
  scopeOfWork: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  compensationMethod: SubPayMethod;
  rate: string;
  estimatedQuantity: string;
  contractAmount: string;
  paymentTerms: string;
  retainagePercent: string;
  startDate: string;
  targetCompletionDate: string;
  crewSize: string;
  notes: string;
};
type SubcontractorSummary = {
  totalAssigned: number;
  active: number;
  pending: number;
  archived: number;
  totalContractValue: number | null;
  totalCrewMembers: number | null;
  averageCrewSize: number | null;
  nextScheduledStart: string | null;
};

const EMPTY_FORM: AssignmentFormState = {
  vendorId: "", tradeName: "", scopeOfWork: "", primaryContactName: "", primaryContactPhone: "", primaryContactEmail: "",
  compensationMethod: "lump_sum", rate: "", estimatedQuantity: "", contractAmount: "", paymentTerms: "", retainagePercent: "",
  startDate: "", targetCompletionDate: "", crewSize: "", notes: "",
};
const STATUS_TONE: Record<TradePartnerAssignmentStatus, "brand" | "success" | "warning" | "danger" | "neutral" | "info"> = { active: "success", inactive: "neutral", archived: "warning" };
const CONTRACT_TONE: Record<string, "brand" | "success" | "warning" | "danger" | "neutral" | "info"> = { draft: "neutral", pending_signature: "warning", signed: "success", cancelled: "danger", closed: "info" };
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function ProjectTradePartnersWorkspace({ projectId }: ProjectTradePartnersWorkspaceProps) {
  const assignmentService = useMemo(() => createTradePartnerAssignmentsService(), []);
  const vendorsService = useMemo(() => createVendorsService(), []);
  const [assignments, setAssignments] = useState<TradePartnerAssignment[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [form, setForm] = useState<AssignmentFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [assignmentRows, vendorRows] = await Promise.all([
        assignmentService.listProjectTradePartnerAssignments({ projectId, assignmentStatus: "all" }),
        vendorsService.listVendorOptions(),
      ]);
      setAssignments(assignmentRows);
      setVendors(vendorRows);
    } catch (error) {
      setErrorMessage(mapFriendlyError(error));
    } finally {
      setIsLoading(false);
    }
  }, [assignmentService, projectId, vendorsService]);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredVendors = useMemo(() => {
    const query = vendorSearch.trim().toLowerCase();
    const rows = query
      ? vendors.filter((vendor) => [vendor.displayName, vendor.companyName, vendor.contactName, vendor.email || "", vendor.phone || "", vendor.mobile || ""].join(" ").toLowerCase().includes(query))
      : vendors;
    return rows;
  }, [vendorSearch, vendors]);
  const vendorById = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);
  const summary = useMemo(() => buildSummary(assignments), [assignments]);

  const openCreateDialog = () => {
    setEditingAssignmentId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError(null);
    setVendorSearch("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (assignment: TradePartnerAssignment) => {
    setEditingAssignmentId(assignment.id);
    setForm({
      ...EMPTY_FORM,
      vendorId: assignment.vendorId,
      tradeName: assignment.tradeName,
      scopeOfWork: assignment.scopeOfWork || "",
      primaryContactName: assignment.primaryContactName || "",
      primaryContactPhone: assignment.primaryContactPhone || "",
      primaryContactEmail: assignment.primaryContactEmail || "",
      contractAmount: assignment.contractAmount !== null ? String(assignment.contractAmount) : "",
      paymentTerms: assignment.paymentTerms || "",
      retainagePercent: assignment.retainagePercent !== null ? String(assignment.retainagePercent) : "",
      startDate: assignment.startDate || "",
      targetCompletionDate: assignment.targetCompletionDate || "",
      crewSize: assignment.crewSize !== null ? String(assignment.crewSize) : "",
      notes: assignment.notes || "",
    });
    setFieldErrors({});
    setFormError(null);
    setVendorSearch("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setIsDialogOpen(false);
    setFormError(null);
    setFieldErrors({});
  };

  const onVendorChange = (vendorId: string) => {
    const vendor = vendorById.get(vendorId);
    setForm((current) => ({
      ...current,
      vendorId,
      primaryContactName: current.primaryContactName || vendor?.contactName || "",
      primaryContactPhone: current.primaryContactPhone || vendor?.phone || vendor?.mobile || "",
      primaryContactEmail: current.primaryContactEmail || vendor?.email || "",
      paymentTerms: current.paymentTerms || vendor?.paymentTerms || "",
    }));
  };

  const calculatedAmount = useMemo(() => {
    if (editingAssignmentId) return toNullableNumber(form.contractAmount) ?? 0;
    if (["lump_sum", "prevailing_wage"].includes(form.compensationMethod)) return toNullableNumber(form.contractAmount) ?? 0;
    return Math.max(0, toNullableNumber(form.rate) ?? 0) * Math.max(0, toNullableNumber(form.estimatedQuantity) ?? 0);
  }, [editingAssignmentId, form.compensationMethod, form.contractAmount, form.estimatedQuantity, form.rate]);

  const onSave = async () => {
    const errors: Record<string, string> = {};
    const selectedVendor = vendorById.get(form.vendorId);
    if (!form.vendorId.trim()) errors.vendorId = "Trade Partner is required.";
    if (selectedVendor?.rehireStatus === "do_not_rehire") errors.vendorId = "This Trade Partner is marked Do Not Rehire.";
    if (!form.tradeName.trim()) errors.tradeName = "Trade is required.";
    if (!form.primaryContactEmail.trim()) errors.primaryContactEmail = "Email is required so B.O.S. can send the subcontract agreement.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.primaryContactEmail.trim())) errors.primaryContactEmail = "Please enter a valid email.";
    if (form.retainagePercent.trim()) {
      const value = Number(form.retainagePercent);
      if (!Number.isFinite(value) || value < 0 || value > 100) errors.retainagePercent = "Retainage must be between 0 and 100.";
    }
    if (form.crewSize.trim()) {
      const value = Number(form.crewSize);
      if (!Number.isInteger(value) || value < 0) errors.crewSize = "Crew size must be a non-negative whole number.";
    }
    if (form.startDate && form.targetCompletionDate && form.targetCompletionDate < form.startDate) errors.targetCompletionDate = "Target completion cannot be before start date.";
    if (!editingAssignmentId) {
      if (["hourly", "day_rate", "unit_rate"].includes(form.compensationMethod)) {
        if ((toNullableNumber(form.rate) ?? -1) < 0) errors.rate = "Enter a valid rate.";
        if ((toNullableNumber(form.estimatedQuantity) ?? 0) <= 0) errors.estimatedQuantity = "Enter an estimated quantity.";
      }
      if (["lump_sum", "prevailing_wage"].includes(form.compensationMethod) && calculatedAmount <= 0) errors.contractAmount = "Enter the committed amount.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editingAssignmentId) {
        const payload = {
          tradeName: form.tradeName.trim(), scopeOfWork: toNullableText(form.scopeOfWork), primaryContactName: toNullableText(form.primaryContactName),
          primaryContactPhone: toNullableText(form.primaryContactPhone), primaryContactEmail: toNullableText(form.primaryContactEmail), contractAmount: toNullableNumber(form.contractAmount),
          paymentTerms: toNullableText(form.paymentTerms), retainagePercent: toNullableNumber(form.retainagePercent), startDate: toNullableText(form.startDate),
          targetCompletionDate: toNullableText(form.targetCompletionDate), crewSize: toNullableInteger(form.crewSize), notes: toNullableText(form.notes),
        };
        await assignmentService.updateTradePartnerAssignment(editingAssignmentId, payload as UpdateTradePartnerAssignmentInput);
      } else {
        const paymentTerms = composePaymentTerms(form, calculatedAmount);
        const created = await assignmentService.createTradePartnerAssignment({
          projectId, vendorId: form.vendorId, assignmentStatus: "inactive", contractStatus: "draft", tradeName: form.tradeName.trim(),
          scopeOfWork: toNullableText(form.scopeOfWork), primaryContactName: toNullableText(form.primaryContactName), primaryContactPhone: toNullableText(form.primaryContactPhone),
          primaryContactEmail: toNullableText(form.primaryContactEmail), contractAmount: calculatedAmount, paymentTerms, retainagePercent: toNullableNumber(form.retainagePercent),
          startDate: toNullableText(form.startDate), targetCompletionDate: toNullableText(form.targetCompletionDate), crewSize: toNullableInteger(form.crewSize), notes: toNullableText(form.notes),
        } as CreateTradePartnerAssignmentInput);
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/subcontractors/${encodeURIComponent(created.id)}/agreement`, { method: "POST" });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error || "The Trade Partner was selected for the project, but B.O.S. could not send the agreement. The assignment remains inactive until the agreement is signed and compliance is cleared.");
      }
      setIsDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingAssignmentId(null);
      setFieldErrors({});
      setFormError(null);
      await loadData();
    } catch (error) {
      setFormError(mapFriendlyError(error));
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <section className="grid gap-4 md:grid-cols-2"><SkeletonLoader className="h-56 w-full" /><SkeletonLoader className="h-56 w-full" /></section>;
  if (errorMessage && assignments.length === 0) return <ErrorState title="Unable to load Trade Partners" description={errorMessage} />;

  return <div className="space-y-4">
    {errorMessage ? <ErrorState title="Unable to complete request" description={errorMessage} /> : null}
    {assignments.length === 0 ? (
      <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] px-6 py-5 shadow-[var(--bos-shadow-workspace-card)]">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-brand-700)] shadow-[var(--shadow-small)]"><Users size={20} /></div>
          <h3 className="text-section-title font-bold tracking-tight text-[var(--bos-text-strong-on-light)]">No Trade Partners Selected</h3>
          <p className="text-sm font-medium leading-7 text-[var(--bos-text-medium-on-light)]">Select a Trade Partner, define scope and compensation, and B.O.S. will email the agreement for signature. They do not become active until signed and cleared to mobilize.</p>
          <Button type="button" onClick={openCreateDialog}>Assign Trade Partner</Button>
        </div>
      </section>
    ) : <>
      <div className="flex items-center justify-end"><Button type="button" onClick={openCreateDialog}>Assign Trade Partner</Button></div>
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] xl:items-start">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {assignments.map((assignment) => {
            const vendor = vendorById.get(assignment.vendorId);
            const companyName = vendor?.displayName || vendor?.companyName || "Not Assigned";
            const contractStatusLabel = prettifyToken(assignment.contractStatus);
            const authorized = assignment.contractStatus === "signed" && assignment.assignmentStatus === "active";
            return <Card key={assignment.id} className="min-w-0 overflow-hidden border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] shadow-[var(--bos-shadow-workspace-card)]">
              <CardHeader className="space-y-2 border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f3f7fd)] pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="break-words text-card-title font-bold text-[var(--bos-text-strong-on-light)]">{companyName}</CardTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--bos-text-medium-on-light)]">
                      <span className="inline-flex items-center gap-1"><Star size={13} />{vendor?.performanceRating == null ? "Not rated" : `${vendor.performanceRating.toFixed(1)} / 5`}</span>
                      {vendor?.performanceReviewCount ? <span>· {vendor.performanceReviewCount} {vendor.performanceReviewCount === 1 ? "review" : "reviews"}</span> : null}
                      {vendor?.rehireStatus === "do_not_rehire" ? <Badge tone="danger">Do Not Rehire</Badge> : vendor?.rehireStatus === "review_before_assignment" ? <Badge tone="warning">Review First</Badge> : null}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[assignment.assignmentStatus]}>{authorized ? "Authorized to Start" : prettifyToken(assignment.assignmentStatus)}</Badge>
                </div>
                <p className="text-sm font-bold text-[var(--bos-text-medium-on-light)]">{assignment.tradeName}</p>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <DetailRow label="Contract Status" value={contractStatusLabel} icon={<ClipboardCheck size={14} />} />
                <div><Badge tone={CONTRACT_TONE[assignment.contractStatus] || "neutral"}>{contractStatusLabel}</Badge></div>
                <DetailRow label="Committed Amount" value={formatMoney(assignment.contractAmount)} />
                <DetailRow label="How Paid" value={assignment.paymentTerms || "Not Provided"} />
                <DetailRow label="Retainage" value={assignment.retainagePercent == null ? "Not specified" : `${assignment.retainagePercent}%`} />
                <DetailRow label="Crew Size" value={assignment.crewSize !== null ? String(assignment.crewSize) : "Not Provided"} />
                <DetailRow label="Schedule" value={[assignment.startDate, assignment.targetCompletionDate].filter(Boolean).join(" → ") || "Not Scheduled"} />
                <DetailRow label="Primary Contact" value={assignment.primaryContactName || vendor?.contactName || "Not Assigned"} icon={<Building2 size={14} />} />
                <SubcontractorContractActions projectId={projectId} assignmentId={assignment.id} email={assignment.primaryContactEmail || vendor?.email || null} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href={`/vendors/${assignment.vendorId}`}><Button type="button" variant="outline" className="w-full">View Trade Partner<ArrowUpRight size={14} /></Button></Link>
                  <Button type="button" variant="outline" onClick={() => openEditDialog(assignment)} disabled={assignment.assignmentStatus === "archived"}>Edit Assignment</Button>
                </div>
              </CardContent>
            </Card>;
          })}
        </div>
        <Card className="h-fit border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] shadow-[var(--bos-shadow-workspace-card)]">
          <CardHeader><CardTitle className="text-section-title font-bold">Project Trade Partner Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <SummaryRow label="Selected" value={String(summary.totalAssigned)} />
            <SummaryRow label="Authorized / Active" value={String(summary.active)} />
            <SummaryRow label="Awaiting Contract" value={String(summary.pending)} />
            <SummaryRow label="Historical / Closed" value={String(summary.archived)} />
            <SummaryRow label="Total Contract Value" value={formatMoney(summary.totalContractValue, "Not Provided")} />
            <SummaryRow label="Total Crew Members" value={summary.totalCrewMembers === null ? "Not Provided" : String(summary.totalCrewMembers)} />
            <SummaryRow label="Next Scheduled Start" value={summary.nextScheduledStart || "Not Scheduled"} />
          </CardContent>
        </Card>
      </section>
    </>}

    <Dialog open={isDialogOpen} onClose={closeDialog} ariaLabel={editingAssignmentId ? "Edit Trade Partner assignment" : "Assign Trade Partner"} backdropLabel="Close Trade Partner assignment" panelClassName="max-h-[92vh] max-w-4xl overflow-auto rounded-[var(--radius-2xl)] p-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{editingAssignmentId ? "Edit Trade Partner Assignment" : "Assign Trade Partner"}</h3>
            {!editingAssignmentId ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Saving sends the agreement automatically. The Trade Partner stays inactive until signature and mobilization clearance.</p> : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={closeDialog} disabled={isSaving}>Close</Button>
        </div>
        <div className="space-y-3 rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/65 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Trade Partner</p>
          <SearchInput value={vendorSearch} onChange={(event) => setVendorSearch(event.currentTarget.value)} placeholder="Search Trade Partners" />
          <Select value={form.vendorId} onChange={(event) => onVendorChange(event.currentTarget.value)} disabled={Boolean(editingAssignmentId)} aria-invalid={Boolean(fieldErrors.vendorId)}>
            <option value="">Select a Trade Partner</option>
            {filteredVendors.map((vendor) => <option key={vendor.id} value={vendor.id} disabled={vendor.rehireStatus === "do_not_rehire"}>{vendor.displayName} ({vendor.companyName}) · {vendor.performanceRating == null ? "Not rated" : `${vendor.performanceRating.toFixed(1)} ★`} · {vendor.rehireStatus === "do_not_rehire" ? "Do Not Rehire" : vendor.rehireStatus === "review_before_assignment" ? "Review First" : "Eligible"}</option>)}
          </Select>
          {fieldErrors.vendorId ? <FieldError text={fieldErrors.vendorId} /> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Trade" value={form.tradeName} onChange={(value) => setForm((current) => ({ ...current, tradeName: value }))} error={fieldErrors.tradeName} required />
          <Field label="Scope of Work" value={form.scopeOfWork} onChange={(value) => setForm((current) => ({ ...current, scopeOfWork: value }))} />
          <Field label="Primary Contact Name" value={form.primaryContactName} onChange={(value) => setForm((current) => ({ ...current, primaryContactName: value }))} />
          <Field label="Primary Contact Phone" value={form.primaryContactPhone} onChange={(value) => setForm((current) => ({ ...current, primaryContactPhone: value }))} />
          <Field label="Primary Contact Email" value={form.primaryContactEmail} onChange={(value) => setForm((current) => ({ ...current, primaryContactEmail: value }))} error={fieldErrors.primaryContactEmail} required />
        </div>
        {!editingAssignmentId ? <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
          <h4 className="font-bold text-[var(--color-text-primary)]">Compensation & commitment</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5"><label className="text-sm font-bold">How are we paying?</label><Select value={form.compensationMethod} onChange={(event) => setForm((current) => ({ ...current, compensationMethod: event.currentTarget.value as SubPayMethod }))}><option value="lump_sum">Lump sum</option><option value="hourly">Hourly</option><option value="day_rate">Day rate</option><option value="unit_rate">Unit / piece rate</option><option value="prevailing_wage">Prevailing wage</option></Select></div>
            {["hourly", "day_rate", "unit_rate"].includes(form.compensationMethod) ? <>
              <Field label={form.compensationMethod === "hourly" ? "Hourly Rate" : form.compensationMethod === "day_rate" ? "Day Rate" : "Unit Rate"} type="number" value={form.rate} onChange={(value) => setForm((current) => ({ ...current, rate: value }))} error={fieldErrors.rate} />
              <Field label={form.compensationMethod === "hourly" ? "Estimated Hours" : form.compensationMethod === "day_rate" ? "Estimated Days" : "Estimated Units"} type="number" value={form.estimatedQuantity} onChange={(value) => setForm((current) => ({ ...current, estimatedQuantity: value }))} error={fieldErrors.estimatedQuantity} />
            </> : <Field label={form.compensationMethod === "prevailing_wage" ? "Estimated Subcontract Commitment" : "Lump Sum Amount"} type="number" value={form.contractAmount} onChange={(value) => setForm((current) => ({ ...current, contractAmount: value }))} error={fieldErrors.contractAmount} />}
            <Field label="Payment Terms" value={form.paymentTerms} onChange={(value) => setForm((current) => ({ ...current, paymentTerms: value }))} />
            <Field label="Retainage %" type="number" value={form.retainagePercent} onChange={(value) => setForm((current) => ({ ...current, retainagePercent: value }))} error={fieldErrors.retainagePercent} />
          </div>
          <div className="mt-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Committed project cost</p><p className="mt-1 text-xl font-extrabold">{money(calculatedAmount)}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">This amount becomes a project commitment after the subcontract is signed.</p></div>
        </div> : <div className="grid gap-3 md:grid-cols-2"><Field label="Contract Amount" type="number" value={form.contractAmount} onChange={(value) => setForm((current) => ({ ...current, contractAmount: value }))} /><Field label="Payment Terms" value={form.paymentTerms} onChange={(value) => setForm((current) => ({ ...current, paymentTerms: value }))} /><Field label="Retainage %" type="number" value={form.retainagePercent} onChange={(value) => setForm((current) => ({ ...current, retainagePercent: value }))} /></div>}
        <div className="grid gap-3 md:grid-cols-3"><Field label="Start Date" type="date" value={form.startDate} onChange={(value) => setForm((current) => ({ ...current, startDate: value }))} /><Field label="Target Completion Date" type="date" value={form.targetCompletionDate} onChange={(value) => setForm((current) => ({ ...current, targetCompletionDate: value }))} error={fieldErrors.targetCompletionDate} /><Field label="Crew Size" type="number" value={form.crewSize} onChange={(value) => setForm((current) => ({ ...current, crewSize: value }))} error={fieldErrors.crewSize} /></div>
        <div className="space-y-1.5"><label className="text-sm font-bold">Notes</label><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.currentTarget.value }))} className="min-h-24 w-full rounded-[var(--radius-lg)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-4 py-3 text-base font-medium text-[var(--bos-text-primary)]" /></div>
        {formError ? <p className="rounded-xl border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-3 text-sm font-semibold text-[var(--color-danger-700)]">{formError}</p> : null}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>Cancel</Button><Button type="button" onClick={() => void onSave()} disabled={isSaving}>{isSaving ? "Saving & Sending…" : editingAssignmentId ? "Save Changes" : "Assign & Send Agreement"}</Button></div>
      </div>
    </Dialog>
  </div>;
}

function composePaymentTerms(form: AssignmentFormState, amount: number) {
  const custom = form.paymentTerms.trim();
  const qty = toNullableNumber(form.estimatedQuantity) || 0;
  const rate = toNullableNumber(form.rate) || 0;
  let commercial = "Lump sum";
  if (form.compensationMethod === "hourly") commercial = `Hourly · ${money(rate)}/hr · estimated ${qty} hrs`;
  if (form.compensationMethod === "day_rate") commercial = `Day rate · ${money(rate)}/day · estimated ${qty} days`;
  if (form.compensationMethod === "unit_rate") commercial = `Unit rate · ${money(rate)}/unit · estimated ${qty} units`;
  if (form.compensationMethod === "prevailing_wage") commercial = `Prevailing wage project · estimated subcontract commitment ${money(amount)} · wage determination/classification and certified-payroll requirements apply`;
  return custom ? `${commercial} · ${custom}` : commercial;
}
function Field(props: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date"; error?: string; required?: boolean }) { return <FormField label={props.label} required={props.required}><Input type={props.type || "text"} value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)} aria-invalid={Boolean(props.error)} />{props.error ? <FieldError text={props.error} /> : null}</FormField>; }
function FieldError({ text }: { text: string }) { return <p className="text-xs font-semibold text-[var(--color-danger-700)]">{text}</p>; }
function DetailRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) { return <div className="flex items-start justify-between gap-3 rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5"><p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="text-right text-sm font-bold text-[var(--bos-text-strong-on-light)]">{icon ? <span className="mr-1 inline-flex align-middle">{icon}</span> : null}{value}</p></div>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3 rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5"><p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="text-right text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</p></div>; }
function toNullableText(value: string) { const trimmed = value.trim(); return trimmed.length ? trimmed : null; }
function toNullableNumber(value: string) { const trimmed = value.trim(); if (!trimmed) return null; const parsed = Number(trimmed); return Number.isFinite(parsed) ? parsed : null; }
function toNullableInteger(value: string) { const parsed = toNullableNumber(value); return parsed === null ? null : Number.isInteger(parsed) ? parsed : null; }
function formatMoney(value: number | null, fallback = "Not Provided") { return value === null ? fallback : money(value); }
function prettifyToken(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function buildSummary(assignments: TradePartnerAssignment[]): SubcontractorSummary {
  const active = assignments.filter((assignment) => assignment.assignmentStatus === "active").length;
  const pending = assignments.filter((assignment) => !["signed", "closed"].includes(assignment.contractStatus) && assignment.assignmentStatus !== "archived").length;
  const archived = assignments.filter((assignment) => assignment.assignmentStatus === "archived").length;
  const values = assignments.filter((assignment) => assignment.assignmentStatus !== "archived" && assignment.contractAmount !== null).map((assignment) => assignment.contractAmount as number);
  const crews = assignments.filter((assignment) => assignment.assignmentStatus !== "archived" && assignment.crewSize !== null).map((assignment) => assignment.crewSize as number);
  const starts = assignments.filter((assignment) => assignment.assignmentStatus !== "archived" && assignment.startDate).map((assignment) => assignment.startDate as string).sort();
  return { totalAssigned: assignments.filter((assignment) => assignment.assignmentStatus !== "archived").length, active, pending, archived, totalContractValue: values.length ? values.reduce((sum, value) => sum + value, 0) : null, totalCrewMembers: crews.length ? crews.reduce((sum, value) => sum + value, 0) : null, averageCrewSize: crews.length ? crews.reduce((sum, value) => sum + value, 0) / crews.length : null, nextScheduledStart: starts[0] || null };
}
function mapFriendlyError(error: unknown) { if (error instanceof TradePartnerAssignmentsError || error instanceof VendorsServiceError) return error.message; if (error instanceof Error) return error.message; return "Unable to complete this Trade Partner request."; }
