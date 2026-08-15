"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui";

type Requirement = { requirement_type: string; required: boolean; status: string; verified_at: string | null; expires_at: string | null };
type MobilizationPayload = {
  assignmentContractStatus: string;
  authorization: { id: string; status: string; signed_at: string | null; sent_at: string | null } | null;
  master: { id: string; status: string; signed_at: string | null } | null;
  requirements: Requirement[];
  mobilizationStatus: string;
  blockers: string[];
};

const label = (value: string) => value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

export function SubcontractorContractActions({ projectId, assignmentId, email }: { projectId: string; assignmentId: string; email: string | null }) {
  const [data, setData] = useState<MobilizationPayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/mobilization`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load subcontract status.");
      setData(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load subcontract status.");
    }
  }, [assignmentId, projectId]);

  useEffect(() => { void load(); }, [load]);

  async function sendAgreement() {
    setBusy("send"); setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/agreement`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to send agreement.");
      setMessage(body.delivery?.delivered === false ? "Agreement created. Email delivery is not configured; use the secure link from the API response for testing." : "Subcontract agreement sent.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send agreement."); }
    finally { setBusy(null); }
  }

  async function updateRequirement(requirementType: string, status: "verified" | "waived" | "missing") {
    setBusy(requirementType); setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/subcontractors/${assignmentId}/mobilization`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requirementType, status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update requirement.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update requirement."); }
    finally { setBusy(null); }
  }

  const signed = data?.authorization?.status === "signed";
  const cleared = data?.mobilizationStatus === "cleared";

  return <div className="space-y-3 rounded-[14px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">Subcontract & Mobilization</p><p className="mt-1 text-sm font-bold text-[var(--bos-text-strong-on-light)]">{cleared ? "CLEARED TO MOBILIZE" : "NOT CLEARED TO MOBILIZE"}</p></div><Badge tone={cleared ? "success" : "warning"}>{cleared ? "Cleared" : "Hold"}</Badge></div>
    <div className="grid gap-1 text-xs font-semibold text-[var(--bos-text-medium-on-light)]"><p>Master Agreement: {label(data?.master?.status || "not_created")}</p><p>Project Work Authorization: {label(data?.authorization?.status || "not_created")}</p></div>
    <Button type="button" size="sm" className="w-full" disabled={busy === "send" || !email} onClick={() => void sendAgreement()}>{busy === "send" ? "Sending…" : signed ? "Resend Agreement" : "Send Agreement"}</Button>
    {!email ? <p className="text-xs font-semibold text-[var(--color-danger-700)]">Add a subcontractor email address before sending.</p> : null}
    {data?.requirements?.length ? <details><summary className="cursor-pointer text-xs font-black text-[var(--bos-text-strong-on-light)]">Mobilization Requirements ({data.requirements.filter((item) => item.required && !["verified","waived"].includes(item.status)).length} open)</summary><div className="mt-2 space-y-2">{data.requirements.map((requirement) => <div key={requirement.requirement_type} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--bos-border-light)] bg-white px-2.5 py-2"><div><p className="text-xs font-bold text-slate-900">{label(requirement.requirement_type)}</p><p className="text-[11px] font-semibold text-slate-500">{label(requirement.status)}</p></div>{!["master_agreement","work_authorization","scope_confirmation"].includes(requirement.requirement_type) ? <div className="flex gap-1"><button type="button" disabled={busy === requirement.requirement_type} onClick={() => void updateRequirement(requirement.requirement_type, "verified")} className="rounded-md border px-2 py-1 text-[11px] font-bold">Verify</button><button type="button" disabled={busy === requirement.requirement_type} onClick={() => void updateRequirement(requirement.requirement_type, "waived")} className="rounded-md border px-2 py-1 text-[11px] font-bold">Waive</button></div> : null}</div>)}</div></details> : null}
    {message ? <p className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{message}</p> : null}
  </div>;
}
