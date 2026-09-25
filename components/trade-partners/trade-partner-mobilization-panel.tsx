"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Badge, Button } from "@/components/ui";

type Requirement = { id: string; requirement_type: string; required: boolean; status: string; expires_at: string | null };
type CompanyDocument = { id: string; requirementType: string; originalFilename: string; expiresAt: string | null; reviewStatus: string; reviewNote: string | null; viewUrl: string | null };
type Payload = { assignment?: { mobilization_status?: string }; requirements: Requirement[]; companyDocuments: CompanyDocument[]; companyRequirementTypes: string[]; error?: string };

const LABELS: Record<string, string> = {
  master_agreement: "Master Agreement",
  work_authorization: "Project Work Authorization",
  w9: "W-9",
  coi: "Certificate of Insurance",
  workers_comp: "Workers' Compensation",
  licenses: "License / Certification",
  safety_acknowledgement: "Project Safety Acknowledgement",
  scope_confirmation: "Scope Confirmation",
};

const EXPIRING_COMPANY_REQUIREMENTS = new Set(["coi", "workers_comp", "licenses"]);

export function TradePartnerMobilizationPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expiresAtByType, setExpiresAtByType] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/trade-partners/projects/" + encodeURIComponent(projectId) + "/mobilization", { cache: "no-store" });
    const body = await response.json() as Payload;
    if (!response.ok) throw new Error(body.error || "Unable to load mobilization requirements.");
    setData(body);
  }, [projectId]);

  useEffect(() => {
    let active = true;
    void fetch("/api/trade-partners/projects/" + encodeURIComponent(projectId) + "/mobilization", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as Payload;
        if (!response.ok) throw new Error(body.error || "Unable to load mobilization requirements.");
        if (active) setData(body);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load mobilization requirements.");
      });
    return () => { active = false; };
  }, [projectId]);

  const docs = useMemo(() => new Map((data?.companyDocuments || []).map((doc) => [doc.requirementType, doc])), [data?.companyDocuments]);
  const openCount = (data?.requirements || []).filter((row) => row.required && !["verified", "waived"].includes(row.status)).length;
  const cleared = data?.assignment?.mobilization_status === "cleared";

  async function upload(type: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy("upload:" + type);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("requirementType", type);
      const expiresAt = expiresAtByType[type];
      if (expiresAt) form.append("expiresAt", expiresAt);
      const response = await fetch("/api/trade-partners/onboarding/documents", { method: "POST", body: form });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to upload document.");
      setMessage((LABELS[type] || "Document") + " submitted for review.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload document.");
    } finally {
      setBusy(null);
    }
  }

  async function acknowledge(action: "safety_acknowledgement" | "scope_confirmation") {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/trade-partners/projects/" + encodeURIComponent(projectId) + "/mobilization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, accepted: true }),
      });
      const body = await response.json() as Payload;
      if (!response.ok) throw new Error(body.error || "Unable to record acknowledgement.");
      setData(body);
      setMessage(action === "safety_acknowledgement" ? "Project safety acknowledgement recorded." : "Assigned scope confirmed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record acknowledgement.");
    } finally {
      setBusy(null);
    }
  }

  return <section id="mobilization" className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8ec3ff]">Before You Start Work</p>
        <h2 className="mt-1 text-xl font-semibold">Mobilization Requirements</h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--bos-text-secondary)]">Company documents carry across assigned projects. Project-specific acknowledgements stay with this job. B.O.S. clears mobilization automatically when every required item is complete.</p>
      </div>
      <Badge tone={cleared ? "success" : "warning"}>{cleared ? "Cleared to Mobilize" : String(openCount) + " Open"}</Badge>
    </div>

    {!data ? <p className="mt-4 text-sm text-[var(--bos-text-secondary)]">Loading mobilization status...</p> :
      <div className="mt-5 space-y-3">{data.requirements.map((requirement) => {
        const companyLevel = data.companyRequirementTypes.includes(requirement.requirement_type);
        const doc = companyLevel ? docs.get(requirement.requirement_type) : undefined;
        const actionable = ["safety_acknowledgement", "scope_confirmation"].includes(requirement.requirement_type) && requirement.status !== "verified";
        return <div key={requirement.id} className="rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{LABELS[requirement.requirement_type] || pretty(requirement.requirement_type)}</p>
                <StatusBadge status={requirement.status} />
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--bos-text-muted)]">{companyLevel ? "Company profile" : "Project specific"}</span>
              </div>
              {doc ? <div className="mt-2 text-xs text-[var(--bos-text-secondary)]">
                {doc.viewUrl ? <a href={doc.viewUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#8ec3ff] hover:underline">{doc.originalFilename}</a> : <span>{doc.originalFilename}</span>}
                {doc.expiresAt ? <span> · Expires {formatDate(doc.expiresAt)}</span> : null}
                {doc.reviewNote ? <p className="mt-1 text-amber-300">Review note: {doc.reviewNote}</p> : null}
              </div> : companyLevel ? <p className="mt-2 text-xs text-[var(--bos-text-secondary)]">No current document is on file.</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {companyLevel ? <>
                {EXPIRING_COMPANY_REQUIREMENTS.has(requirement.requirement_type) ? <input type="date" aria-label={(LABELS[requirement.requirement_type] || pretty(requirement.requirement_type)) + " expiration date"} value={expiresAtByType[requirement.requirement_type] || ""} onChange={(event) => setExpiresAtByType((current) => ({ ...current, [requirement.requirement_type]: event.currentTarget.value }))} className="h-9 rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-2 text-xs" /> : null}
                <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[var(--bos-border-default)] px-3 text-xs font-semibold">
                  <input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" disabled={busy === "upload:" + requirement.requirement_type} onChange={(event) => void upload(requirement.requirement_type, event)} />
                  {busy === "upload:" + requirement.requirement_type ? "Uploading..." : doc ? "Replace" : "Upload"}
                </label>
              </> : null}
              {actionable ? <Button type="button" size="sm" disabled={busy === requirement.requirement_type} onClick={() => void acknowledge(requirement.requirement_type as "safety_acknowledgement" | "scope_confirmation")}>{busy === requirement.requirement_type ? "Saving..." : requirement.requirement_type === "safety_acknowledgement" ? "Acknowledge" : "Confirm Scope"}</Button> : null}
            </div>
          </div>
        </div>;
      })}</div>
    }

    {message ? <p className="mt-4 rounded-lg border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] px-3 py-2 text-sm font-semibold text-[var(--bos-text-secondary)]">{message}</p> : null}
    {!cleared && data ? <p className="mt-4 text-xs font-semibold text-amber-300">Do not begin work until this panel shows Cleared to Mobilize.</p> : null}
  </section>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "verified" || status === "waived" ? "success" : status === "expired" ? "danger" : status === "pending" ? "warning" : "neutral";
  return <Badge tone={tone}>{status === "verified" ? "Approved" : pretty(status)}</Badge>;
}
function pretty(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date); }
