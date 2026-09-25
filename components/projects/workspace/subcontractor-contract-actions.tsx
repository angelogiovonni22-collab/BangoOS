"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Badge, Button, getButtonClassName } from "@/components/ui";
import { SubcontractorOperationsActions } from "./subcontractor-operations-actions";
import { SubcontractorLifecycleActions } from "./subcontractor-lifecycle-actions";

type Requirement = { requirement_type: string; required: boolean; status: string; verified_at: string | null; expires_at: string | null };
type ComplianceDocument = { id: string; requirementType: string; originalFilename: string; fileSizeBytes: number; expiresAt: string | null; viewUrl: string | null; source?: string | null; reviewStatus?: string | null; reviewNote?: string | null };
type MobilizationPayload = { assignmentContractStatus: string; authorization: { id: string; status: string; signed_at: string | null; sent_at: string | null } | null; master: { id: string; status: string; signed_at: string | null } | null; requirements: Requirement[]; mobilizationStatus: string; blockers: string[] };
type PortalState = { active: boolean; pending: boolean; invitationStatus: string | null };
type LoadedMobilization = { statusBody: MobilizationPayload; documents: ComplianceDocument[]; portal: PortalState };

const label = (value: string) => value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const uploadable = new Set(["w9", "coi", "workers_comp", "licenses", "safety_acknowledgement"]);

async function fetchMobilization(projectId: string, assignmentId: string): Promise<LoadedMobilization> {
  const [statusResponse, docsResponse, portalResponse] = await Promise.all([
    fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/mobilization`),
    fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/compliance-documents`),
    fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/portal-access`, { cache: "no-store" }),
  ]);
  const statusBody = await statusResponse.json();
  const docsBody = await docsResponse.json();
  const portalBody = await portalResponse.json();
  if (!statusResponse.ok) throw new Error(statusBody.error || "Unable to load subcontract status.");
  if (!docsResponse.ok) throw new Error(docsBody.error || "Unable to load compliance documents.");
  return {
    statusBody,
    documents: Array.isArray(docsBody.documents) ? docsBody.documents : [],
    portal: portalResponse.ok
      ? { active: Boolean(portalBody.active), pending: Boolean(portalBody.pending), invitationStatus: portalBody.invitationStatus || null }
      : { active: false, pending: false, invitationStatus: null },
  };
}

export function SubcontractorContractActions({ projectId, assignmentId, email }: { projectId: string; assignmentId: string; email: string | null }) {
  const [data, setData] = useState<MobilizationPayload | null>(null);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [portal, setPortal] = useState<PortalState>({ active: false, pending: false, invitationStatus: null });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const loaded = await fetchMobilization(projectId, assignmentId);
      setData(loaded.statusBody);
      setDocuments(loaded.documents);
      setPortal(loaded.portal);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load subcontract status."); }
  }, [assignmentId, projectId]);

  useEffect(() => {
    let active = true;
    void fetchMobilization(projectId, assignmentId)
      .then((loaded) => {
        if (!active) return;
        setData(loaded.statusBody);
        setDocuments(loaded.documents);
        setPortal(loaded.portal);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Unable to load subcontract status.");
      });
    return () => { active = false; };
  }, [assignmentId, projectId]);

  async function sendAgreement() {
    setBusy("send"); setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/agreement`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to send agreement.");
      setMessage(
        body.delivery?.delivered === false
          ? "Agreement created. Email delivery is not configured."
          : body.portalSetup?.required && body.portalSetup?.sent
            ? "Subcontract agreement and secure Trade Partner account setup sent."
            : body.portalSetup?.required && body.portalSetup?.warning
              ? "Subcontract agreement sent, but the Trade Partner account setup email needs attention."
              : "Subcontract agreement sent."
      );
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send agreement."); }
    finally { setBusy(null); }
  }

  async function sendPortalAccess() {
    setBusy("portal"); setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/portal-access`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to send Trade Partner portal access.");
      setMessage(body.alreadyActive ? "This Trade Partner already has active B.O.S. portal access." : "Secure Trade Partner portal setup email sent.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send Trade Partner portal access."); }
    finally { setBusy(null); }
  }

  async function updateRequirement(requirementType: string, status: "verified" | "waived" | "rejected") {
    setBusy(requirementType); setMessage(null);
    try {
      const note = status === "rejected" ? window.prompt("Why is this document being rejected? The Trade Partner will see this note.") : null;
      if (status === "rejected" && note === null) return;
      const response = await fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/mobilization`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requirementType, status, note }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update requirement.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update requirement."); }
    finally { setBusy(null); }
  }

  async function uploadDocument(requirementType: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy(`upload:${requirementType}`); setMessage(null);
    try {
      const form = new FormData();
      form.append("requirementType", requirementType);
      form.append("file", file);
      const response = await fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/compliance-documents`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to upload document.");
      setMessage(`${label(requirementType)} uploaded for review.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to upload document."); }
    finally { setBusy(null); }
  }

  const signed = data?.authorization?.status === "signed";
  const sent = data?.authorization?.status === "sent";
  const cleared = data?.mobilizationStatus === "cleared";
  const docFor = (type: string) => documents.find((doc) => doc.requirementType === type);
  const openRequirements = data?.requirements?.filter((item) => item.required && !["verified", "waived"].includes(item.status)) || [];
  const requirementToneClass = (status: string) => ["verified", "waived"].includes(status)
    ? "border-emerald-300/50 bg-emerald-50 text-emerald-800"
    : status === "expired"
      ? "border-red-300/50 bg-red-50 text-red-800"
      : "border-amber-300/50 bg-amber-50 text-amber-800";

  return <div className="space-y-3">
    <div className="space-y-3 rounded-[14px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">Subcontract & Mobilization</p><p className="mt-1 text-sm font-bold text-[var(--bos-text-strong-on-light)]">{cleared ? "Cleared to Mobilize" : "Mobilization Hold"}</p><p className="mt-1 text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{cleared ? "All required mobilization items are cleared." : `${openRequirements.length} blocking requirement${openRequirements.length === 1 ? "" : "s"} must be cleared before work starts.`}</p></div><Badge tone={cleared ? "success" : "warning"}>{cleared ? "Cleared" : `${openRequirements.length} Open`}</Badge></div>
      <div className="grid gap-1 text-xs font-semibold text-[var(--bos-text-medium-on-light)]"><p>Master Agreement: {label(data?.master?.status || "not_created")}</p><p>Project Work Authorization: {label(data?.authorization?.status || "not_created")}</p></div>
      {openRequirements.length ? <div className="flex flex-wrap gap-1.5">{openRequirements.map((requirement) => <span key={requirement.requirement_type} className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${requirementToneClass(requirement.status)}`}>{label(requirement.requirement_type)} · {label(requirement.status)}</span>)}</div> : null}
      <div className="flex flex-wrap items-center gap-2">
        {signed ? <><Badge tone="success">Agreement Signed</Badge><Link href={`/projects/${projectId}/subcontractors/${assignmentId}/agreement`} className={getButtonClassName({ variant: "outline", size: "sm" })}>View Agreement</Link></> : <Button type="button" size="sm" className="flex-1" disabled={busy === "send" || !email} onClick={() => void sendAgreement()}>{busy === "send" ? "Sending…" : sent ? "Resend Agreement" : "Send Agreement"}</Button>}
        {portal.active ? <Badge tone="success">Portal Active</Badge> : <Button type="button" size="sm" variant="outline" className="flex-1" disabled={busy === "portal" || !email} onClick={() => void sendPortalAccess()}>{busy === "portal" ? "Sending Portal Setup…" : portal.pending ? "Resend Portal Setup" : "Send Portal Setup"}</Button>}
      </div>
      {!email ? <p className="text-xs font-semibold text-[var(--color-danger-700)]">Add a subcontractor email address before sending.</p> : null}
      {data?.requirements?.length ? <details open={openRequirements.length > 0}><summary className="cursor-pointer text-xs font-black text-[var(--bos-text-strong-on-light)]">Mobilization Requirements ({openRequirements.length} open)</summary><div className="mt-2 space-y-2">{data.requirements.map((requirement) => {
        const doc = docFor(requirement.requirement_type);
        return <div key={requirement.requirement_type} className="rounded-lg border border-[var(--bos-border-light)] bg-white px-2.5 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-slate-900">{label(requirement.requirement_type)}</p><p className="text-[11px] font-semibold text-slate-500">{label(requirement.status)}</p>{doc ? <div className="mt-1 max-w-[320px] text-[11px] text-slate-600"><p className="truncate">{doc.viewUrl ? <a className="underline" href={doc.viewUrl} target="_blank" rel="noreferrer">{doc.originalFilename}</a> : doc.originalFilename}</p><p className="mt-0.5">{doc.source === "company_profile" ? "Company profile document" : "Project document"}{doc.reviewStatus ? ` · ${label(doc.reviewStatus)}` : ""}</p>{doc.reviewNote ? <p className="mt-0.5 text-amber-700">Review note: {doc.reviewNote}</p> : null}</div> : null}</div>{uploadable.has(requirement.requirement_type) ? <div className="flex flex-wrap gap-1"><label className="cursor-pointer rounded-md border px-2 py-1 text-[11px] font-bold"><input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" disabled={busy === `upload:${requirement.requirement_type}`} onChange={(event) => void uploadDocument(requirement.requirement_type, event)} />{busy === `upload:${requirement.requirement_type}` ? "Uploading…" : doc ? "Replace" : "Upload"}</label><button type="button" aria-label="Verify and approve compliance document" disabled={busy === requirement.requirement_type || !doc} onClick={() => void updateRequirement(requirement.requirement_type, "verified")} className="rounded-md border px-2 py-1 text-[11px] font-bold disabled:opacity-40">Approve</button>{doc?.source === "company_profile" ? <button type="button" disabled={busy === requirement.requirement_type || !doc} onClick={() => void updateRequirement(requirement.requirement_type, "rejected")} className="rounded-md border border-rose-300 px-2 py-1 text-[11px] font-bold text-rose-700 disabled:opacity-40">Reject</button> : null}<button type="button" disabled={busy === requirement.requirement_type} onClick={() => void updateRequirement(requirement.requirement_type, "waived")} className="rounded-md border px-2 py-1 text-[11px] font-bold">Waive</button></div> : null}</div></div>;
      })}</div></details> : null}
      {message ? <p className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{message}</p> : null}
      <details className="rounded-xl border border-[var(--bos-border-light)] bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-black uppercase tracking-[0.06em] text-[var(--bos-text-strong-on-light)]">Operations & Billing</summary>
        <div className="border-t border-[var(--bos-border-light)] p-3"><SubcontractorOperationsActions projectId={projectId} assignmentId={assignmentId} /></div>
      </details>
      <details className="rounded-xl border border-[var(--bos-border-light)] bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-black uppercase tracking-[0.06em] text-[var(--bos-text-strong-on-light)]">Performance & Assignment Actions</summary>
        <div className="border-t border-[var(--bos-border-light)] p-3"><SubcontractorLifecycleActions projectId={projectId} assignmentId={assignmentId} /></div>
      </details>
    </div>
  </div>;
}
