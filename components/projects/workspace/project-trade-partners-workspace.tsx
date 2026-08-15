"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { ArrowUpRight, Building2, ClipboardCheck, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, ErrorState, FormField, Input, SearchInput, Select, SkeletonLoader } from "@/components/ui";
import { SubcontractorContractActions } from "./subcontractor-contract-actions";
import {
  createTradePartnerAssignmentsService,
  TradePartnerAssignmentsError,
  TRADE_PARTNER_CONTRACT_STATUSES,
  type CreateTradePartnerAssignmentInput,
  type TradePartnerAssignment,
  type TradePartnerAssignmentStatus,
  type UpdateTradePartnerAssignmentInput,
} from "@/lib/trade-partners";
import { createVendorsService, type VendorOption, VendorsServiceError } from "@/lib/vendors/service";

type ProjectTradePartnersWorkspaceProps = { projectId: string };
type AssignmentFormState = { vendorId: string; tradeName: string; scopeOfWork: string; primaryContactName: string; primaryContactPhone: string; primaryContactEmail: string; contractStatus: string; contractAmount: string; paymentTerms: string; retainagePercent: string; startDate: string; targetCompletionDate: string; crewSize: string; notes: string };
type SubcontractorSummary = { totalAssigned: number; active: number; pending: number; archived: number; totalContractValue: number | null; totalCrewMembers: number | null; averageCrewSize: number | null; nextScheduledStart: string | null };

const EMPTY_FORM: AssignmentFormState = { vendorId: "", tradeName: "", scopeOfWork: "", primaryContactName: "", primaryContactPhone: "", primaryContactEmail: "", contractStatus: "draft", contractAmount: "", paymentTerms: "", retainagePercent: "", startDate: "", targetCompletionDate: "", crewSize: "", notes: "" };
const STATUS_TONE: Record<TradePartnerAssignmentStatus, "brand" | "success" | "warning" | "danger" | "neutral" | "info"> = { active: "success", inactive: "neutral", archived: "warning" };
const CONTRACT_TONE: Record<string, "brand" | "success" | "warning" | "danger" | "neutral" | "info"> = { draft: "neutral", pending_signature: "warning", signed: "success", cancelled: "danger", closed: "info" };

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
  const [archivingAssignmentId, setArchivingAssignmentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true); setErrorMessage(null);
    try {
      const [assignmentRows, vendorRows] = await Promise.all([
        assignmentService.listProjectTradePartnerAssignments({ projectId, assignmentStatus: "all" }),
        vendorsService.listVendorOptions(),
      ]);
      setAssignments(assignmentRows); setVendors(vendorRows);
    } catch (error) { setErrorMessage(mapFriendlyError(error)); }
    finally { setIsLoading(false); }
  }, [assignmentService, projectId, vendorsService]);

  useEffect(() => { void loadData(); }, [loadData]);
  const filteredVendors = useMemo(() => {
    const query = vendorSearch.trim().toLowerCase();
    if (!query) return vendors;
    return vendors.filter((vendor) => [vendor.displayName, vendor.companyName, vendor.contactName, vendor.email || "", vendor.phone || "", vendor.mobile || ""].join(" ").toLowerCase().includes(query));
  }, [vendorSearch, vendors]);
  const vendorById = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);
  const summary = useMemo(() => buildSummary(assignments), [assignments]);

  const openCreateDialog = () => { setEditingAssignmentId(null); setForm(EMPTY_FORM); setFieldErrors({}); setFormError(null); setVendorSearch(""); setIsDialogOpen(true); };
  const openEditDialog = (assignment: TradePartnerAssignment) => {
    setEditingAssignmentId(assignment.id);
    setForm({ vendorId: assignment.vendorId, tradeName: assignment.tradeName, scopeOfWork: assignment.scopeOfWork || "", primaryContactName: assignment.primaryContactName || "", primaryContactPhone: assignment.primaryContactPhone || "", primaryContactEmail: assignment.primaryContactEmail || "", contractStatus: assignment.contractStatus, contractAmount: assignment.contractAmount !== null ? String(assignment.contractAmount) : "", paymentTerms: assignment.paymentTerms || "", retainagePercent: assignment.retainagePercent !== null ? String(assignment.retainagePercent) : "", startDate: assignment.startDate || "", targetCompletionDate: assignment.targetCompletionDate || "", crewSize: assignment.crewSize !== null ? String(assignment.crewSize) : "", notes: assignment.notes || "" });
    setFieldErrors({}); setFormError(null); setVendorSearch(""); setIsDialogOpen(true);
  };
  const closeDialog = () => { if (isSaving) return; setIsDialogOpen(false); setFormError(null); setFieldErrors({}); };
  const onVendorChange = (vendorId: string) => {
    setForm((current) => ({ ...current, vendorId }));
    const vendor = vendorById.get(vendorId); if (!vendor) return;
    setForm((current) => ({ ...current, vendorId, primaryContactName: current.primaryContactName || vendor.contactName, primaryContactPhone: current.primaryContactPhone || vendor.phone || vendor.mobile || "", primaryContactEmail: current.primaryContactEmail || vendor.email || "", paymentTerms: current.paymentTerms || vendor.paymentTerms || "" }));
  };

  const onSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.vendorId.trim()) errors.vendorId = "Vendor is required.";
    if (!form.tradeName.trim()) errors.tradeName = "Trade is required.";
    if (form.primaryContactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.primaryContactEmail.trim())) errors.primaryContactEmail = "Please enter a valid email.";
    if (form.contractAmount.trim() && !Number.isFinite(Number(form.contractAmount))) errors.contractAmount = "Contract amount must be a valid number.";
    if (form.retainagePercent.trim()) { const parsedRetainage = Number(form.retainagePercent); if (!Number.isFinite(parsedRetainage) || parsedRetainage < 0 || parsedRetainage > 100) errors.retainagePercent = "Retainage must be between 0 and 100."; }
    if (form.crewSize.trim()) { const parsedCrew = Number(form.crewSize); if (!Number.isInteger(parsedCrew) || parsedCrew < 0) errors.crewSize = "Crew size must be a non-negative whole number."; }
    if (form.startDate && form.targetCompletionDate && form.targetCompletionDate < form.startDate) errors.targetCompletionDate = "Target completion cannot be before start date.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setFormError("Please correct the highlighted fields."); return; }
    setIsSaving(true); setFormError(null);
    try {
      const basePayload = { tradeName: form.tradeName.trim(), scopeOfWork: toNullableText(form.scopeOfWork), primaryContactName: toNullableText(form.primaryContactName), primaryContactPhone: toNullableText(form.primaryContactPhone), primaryContactEmail: toNullableText(form.primaryContactEmail), contractStatus: form.contractStatus, contractAmount: toNullableNumber(form.contractAmount), paymentTerms: toNullableText(form.paymentTerms), retainagePercent: toNullableNumber(form.retainagePercent), startDate: toNullableText(form.startDate), targetCompletionDate: toNullableText(form.targetCompletionDate), crewSize: toNullableInteger(form.crewSize), notes: toNullableText(form.notes) };
      if (editingAssignmentId) await assignmentService.updateTradePartnerAssignment(editingAssignmentId, basePayload as UpdateTradePartnerAssignmentInput);
      else await assignmentService.createTradePartnerAssignment({ projectId, vendorId: form.vendorId, assignmentStatus: "active", ...basePayload } as CreateTradePartnerAssignmentInput);
      setIsDialogOpen(false); setForm(EMPTY_FORM); setEditingAssignmentId(null); setFieldErrors({}); setFormError(null); await loadData();
    } catch (error) { setFormError(mapFriendlyError(error)); }
    finally { setIsSaving(false); }
  };

  const onArchive = async (assignmentId: string) => {
    setErrorMessage(null); setArchivingAssignmentId(assignmentId);
    try { await assignmentService.archiveTradePartnerAssignment(assignmentId); await loadData(); }
    catch (error) { setErrorMessage(mapFriendlyError(error)); }
    finally { setArchivingAssignmentId(null); }
  };

  if (isLoading) return <section className="grid gap-4 md:grid-cols-2"><SkeletonLoader className="h-56 w-full" /><SkeletonLoader className="h-56 w-full" /></section>;
  if (errorMessage && assignments.length === 0) return <ErrorState title="Unable to load subcontractors" description={errorMessage} />;

  return <div className="space-y-4">
    {errorMessage ? <ErrorState title="Unable to complete request" description={errorMessage} /> : null}
    {assignments.length === 0 ? <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] px-6 py-5 shadow-[var(--bos-shadow-workspace-card)]"><div className="mx-auto max-w-xl space-y-4 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-brand-700)] shadow-[var(--shadow-small)]"><Users size={20} aria-hidden="true" /></div><h3 className="text-section-title font-bold tracking-tight text-[var(--bos-text-strong-on-light)]">No Subcontractors Assigned</h3><p className="text-sm font-medium leading-7 text-[var(--bos-text-medium-on-light)]">Assign your first subcontractor to begin managing project trade coverage, contract status, and field readiness.</p><div className="rounded-[12px] border border-[#d8e5f5] bg-[#f8fbff] px-4 py-3 text-left"><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#3f5c80]">When you assign a subcontractor</p><p className="mt-1 text-sm font-semibold text-[#446283]">This workspace starts tracking contract progress, crew planning, and readiness milestones in one place.</p></div><div><Button type="button" onClick={openCreateDialog}>Assign Subcontractor</Button></div></div></section> : <><div className="flex items-center justify-end"><Button type="button" onClick={openCreateDialog}>Assign Subcontractor</Button></div><section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] xl:items-start"><div className="grid min-w-0 gap-4 md:grid-cols-2">{assignments.map((assignment) => {
      const vendor = vendorById.get(assignment.vendorId); const companyName = vendor?.displayName || vendor?.companyName || "Not Assigned"; const trade = assignment.tradeName || "Not Assigned"; const assignmentStatusLabel = prettifyToken(assignment.assignmentStatus); const contractStatusLabel = prettifyToken(assignment.contractStatus); const contactName = assignment.primaryContactName || vendor?.contactName || "Not Assigned"; const phoneNumber = assignment.primaryContactPhone || vendor?.phone || vendor?.mobile || "Not Provided";
      return <Card key={assignment.id} className="min-w-0 overflow-hidden border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] shadow-[var(--bos-shadow-workspace-card)] transition duration-200 hover:shadow-[0_18px_28px_-20px_rgba(6,16,40,0.36)]"><CardHeader className="space-y-2 border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f3f7fd)] pb-4"><div className="flex items-start justify-between gap-2"><CardTitle className="min-w-0 break-words text-card-title font-bold text-[var(--bos-text-strong-on-light)]">{companyName}</CardTitle><Badge tone={STATUS_TONE[assignment.assignmentStatus]}>{assignmentStatusLabel}</Badge></div><p className="text-sm font-bold text-[var(--bos-text-medium-on-light)]">{trade}</p></CardHeader><CardContent className="space-y-3 p-4 text-sm text-[var(--bos-text-medium-on-light)]"><DetailRow label="Contract Status" value={contractStatusLabel} icon={<ClipboardCheck size={14} aria-hidden="true" />} /><div><Badge tone={CONTRACT_TONE[assignment.contractStatus] || "neutral"}>{contractStatusLabel}</Badge></div><DetailRow label="Contract Amount" value={formatMoney(assignment.contractAmount)} /><DetailRow label="Crew Size" value={assignment.crewSize !== null ? String(assignment.crewSize) : "Not Provided"} /><DetailRow label="Start Date" value={assignment.startDate || "Not Scheduled"} /><DetailRow label="Target Completion" value={assignment.targetCompletionDate || "Not Scheduled"} /><DetailRow label="Primary Contact" value={contactName} icon={<Building2 size={14} aria-hidden="true" />} /><DetailRow label="Phone Number" value={phoneNumber} /><SubcontractorContractActions projectId={projectId} assignmentId={assignment.id} email={assignment.primaryContactEmail || vendor?.email || null} /><div className="grid gap-2 sm:grid-cols-3"><Link href={`/vendors/${assignment.vendorId}`} className="block"><Button type="button" variant="outline" className="w-full">View Details<ArrowUpRight size={14} aria-hidden="true" /></Button></Link><Button type="button" variant="outline" onClick={() => openEditDialog(assignment)}>Edit</Button><Button type="button" variant="outline" disabled={assignment.assignmentStatus === "archived" || archivingAssignmentId === assignment.id} onClick={() => void onArchive(assignment.id)}>{archivingAssignmentId === assignment.id ? "Archiving..." : "Archive"}</Button></div></CardContent></Card>;
    })}</div><Card className="h-fit border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] shadow-[var(--bos-shadow-workspace-card)]"><CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f3f7fd)]"><CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Project Subcontractor Summary</CardTitle></CardHeader><CardContent className="space-y-2 p-4"><SummaryRow label="Total Assigned" value={String(summary.totalAssigned)} /><SummaryRow label="Active" value={String(summary.active)} /><SummaryRow label="Pending Contract Status" value={String(summary.pending)} /><SummaryRow label="Archived" value={String(summary.archived)} /><SummaryRow label="Total Contract Value" value={formatMoney(summary.totalContractValue, "Not Provided")} /><SummaryRow label="Total Crew Members" value={summary.totalCrewMembers === null ? "Not Provided" : String(summary.totalCrewMembers)} /><SummaryRow label="Average Crew Size" value={summary.averageCrewSize === null ? "Not Provided" : formatCrewAverage(summary.averageCrewSize)} /><SummaryRow label="Next Scheduled Start" value={summary.nextScheduledStart || "Not Scheduled"} /></CardContent></Card></section></>}

    <Dialog open={isDialogOpen} onClose={closeDialog} ariaLabel={editingAssignmentId ? "Edit subcontractor assignment" : "Assign subcontractor"} backdropLabel="Close subcontractor assignment" panelClassName="max-h-[92vh] max-w-4xl overflow-auto rounded-[var(--radius-2xl)] p-5"><div className="space-y-4"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold tracking-[-0.01em] text-[var(--color-text-primary)]">{editingAssignmentId ? "Edit Subcontractor Assignment" : "Assign Subcontractor"}</h3><Button type="button" variant="outline" size="sm" onClick={closeDialog} disabled={isSaving}>Close</Button></div><div className="space-y-3 rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/65 p-4"><p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Vendor</p><p className="text-sm font-medium text-[var(--color-text-secondary)]">Choose a trade partner to preload contact details and payment terms.</p><SearchInput value={vendorSearch} onChange={(event) => setVendorSearch(event.currentTarget.value)} placeholder="Search vendors" /><Select value={form.vendorId} onChange={(event) => onVendorChange(event.currentTarget.value)} disabled={Boolean(editingAssignmentId)} aria-invalid={Boolean(fieldErrors.vendorId)}><option value="">Select a vendor</option>{filteredVendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.displayName} ({vendor.companyName})</option>)}</Select>{fieldErrors.vendorId ? <p className="text-xs font-semibold text-[var(--color-danger-700)]">{fieldErrors.vendorId}</p> : null}</div><div className="grid gap-3 md:grid-cols-2"><Field label="Trade" value={form.tradeName} onChange={(value) => setForm((current) => ({ ...current, tradeName: value }))} error={fieldErrors.tradeName} required /><Field label="Scope of Work" value={form.scopeOfWork} onChange={(value) => setForm((current) => ({ ...current, scopeOfWork: value }))} /><Field label="Primary Contact Name" value={form.primaryContactName} onChange={(value) => setForm((current) => ({ ...current, primaryContactName: value }))} /><Field label="Primary Contact Phone" value={form.primaryContactPhone} onChange={(value) => setForm((current) => ({ ...current, primaryContactPhone: value }))} /><Field label="Primary Contact Email" value={form.primaryContactEmail} onChange={(value) => setForm((current) => ({ ...current, primaryContactEmail: value }))} error={fieldErrors.primaryContactEmail} /><div className="space-y-1.5"><label className="text-sm font-bold text-[var(--color-text-primary)]">Contract Status</label><Select value={form.contractStatus} onChange={(event) => setForm((current) => ({ ...current, contractStatus: event.currentTarget.value }))}>{TRADE_PARTNER_CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{prettifyToken(status)}</option>)}</Select></div><Field label="Contract Amount" type="number" value={form.contractAmount} onChange={(value) => setForm((current) => ({ ...current, contractAmount: value }))} error={fieldErrors.contractAmount} /><Field label="Payment Terms" value={form.paymentTerms} onChange={(value) => setForm((current) => ({ ...current, paymentTerms: value }))} /><Field label="Retainage %" type="number" value={form.retainagePercent} onChange={(value) => setForm((current) => ({ ...current, retainagePercent: value }))} error={fieldErrors.retainagePercent} /><Field label="Start Date" type="date" value={form.startDate} onChange={(value) => setForm((current) => ({ ...current, startDate: value }))} /><Field label="Target Completion Date" type="date" value={form.targetCompletionDate} onChange={(value) => setForm((current) => ({ ...current, targetCompletionDate: value }))} error={fieldErrors.targetCompletionDate} /><Field label="Crew Size" type="number" value={form.crewSize} onChange={(value) => setForm((current) => ({ ...current, crewSize: value }))} error={fieldErrors.crewSize} /></div><div className="space-y-1.5"><label className="text-sm font-bold text-[var(--color-text-primary)]">Notes</label><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.currentTarget.value }))} className="min-h-24 w-full rounded-[var(--radius-lg)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-4 py-3 text-base font-medium text-[var(--bos-text-primary)] outline-none transition focus-visible:border-[var(--orion-blue)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]" /></div>{formError ? <p className="text-sm font-semibold text-[var(--color-danger-700)]">{formError}</p> : null}<div className="flex flex-wrap items-center justify-end gap-2"><Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>Cancel</Button><Button type="button" onClick={() => void onSave()} disabled={isSaving}>{isSaving ? "Saving..." : editingAssignmentId ? "Save Changes" : "Assign Subcontractor"}</Button></div></div></Dialog>
  </div>;
}

function Field(props: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date"; error?: string; required?: boolean }) { return <FormField label={props.label} required={props.required}><Input type={props.type || "text"} value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)} aria-invalid={Boolean(props.error)} />{props.error ? <p className="text-xs font-semibold text-[var(--color-danger-700)]">{props.error}</p> : null}</FormField>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3 rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5"><p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="text-right text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</p></div>; }
function toNullableText(value: string) { const trimmed = value.trim(); return trimmed.length > 0 ? trimmed : null; }
function toNullableNumber(value: string) { const trimmed = value.trim(); if (!trimmed) return null; const parsed = Number(trimmed); return Number.isFinite(parsed) ? parsed : null; }
function toNullableInteger(value: string) { const parsed = toNullableNumber(value); if (parsed === null) return null; return Number.isInteger(parsed) ? parsed : null; }
function formatMoney(value: number | null, fallback = "Not Provided") { if (value === null) return fallback; return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
function prettifyToken(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function formatCrewAverage(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
function buildSummary(assignments: TradePartnerAssignment[]): SubcontractorSummary {
  const active = assignments.filter((assignment) => assignment.assignmentStatus === "active").length;
  const archived = assignments.filter((assignment) => assignment.assignmentStatus === "archived").length;
  const pending = assignments.filter((assignment) => assignment.assignmentStatus !== "archived" && (assignment.contractStatus === "draft" || assignment.contractStatus === "pending_signature")).length;
  const contractValues = assignments.map((assignment) => assignment.contractAmount).filter((value): value is number => value !== null);
  const crewValues = assignments.map((assignment) => assignment.crewSize).filter((value): value is number => value !== null);
  const nextStartDate = assignments.map((assignment) => assignment.startDate).filter((value): value is string => Boolean(value)).sort((left, right) => left.localeCompare(right))[0] || null;
  const totalContractValue = contractValues.length === 0 ? null : contractValues.reduce((sum, value) => sum + value, 0);
  const totalCrewMembers = crewValues.length === 0 ? null : crewValues.reduce((sum, value) => sum + value, 0);
  return { totalAssigned: assignments.length, active, pending, archived, totalContractValue, totalCrewMembers, averageCrewSize: totalCrewMembers === null ? null : totalCrewMembers / crewValues.length, nextScheduledStart: nextStartDate };
}
function mapFriendlyError(error: unknown) {
  if (error instanceof TradePartnerAssignmentsError) { if (error.code === "CONFLICT") return "This vendor already has an active assignment on this project."; if (error.code === "VALIDATION") return "Please review the assignment details and try again."; if (error.code === "NOT_FOUND") return "The selected project or vendor could not be found."; return "Unable to save subcontractor assignment right now. Please try again."; }
  if (error instanceof VendorsServiceError) return "Unable to load vendors right now. Please try again.";
  return "Something went wrong while processing this request.";
}
function DetailRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) { return <div className="flex items-start justify-between gap-3 rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5"><p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="text-right text-sm font-bold text-[var(--bos-text-strong-on-light)]">{icon ? <span className="mr-1 inline-flex align-middle">{icon}</span> : null}{value}</p></div>; }
