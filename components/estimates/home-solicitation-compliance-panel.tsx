"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { HomeSolicitationEvaluation } from "@/lib/compliance/ohio-home-solicitation";
import type { HomeSolicitationProfile } from "@/lib/compliance/home-solicitation-service";

const emptyProfile: HomeSolicitationProfile = {
  consumerPurpose: "unknown",
  solicitationLocation: "unknown",
  buyerInitiatedContact: null,
  sellerHasFixedOhioBusiness: null,
  entirelyMailOrPhoneBuyerInitiatedNoPriorContact: false,
  finalAgreementAfterPriorNegotiationsAtSellerBusiness: false,
  emergencyHandwrittenWaiver: false,
  federalRescissionRightApplies: null,
  sellerName: "Bango Construction LLC",
  sellerAddress: "",
  cancellationEmail: "",
  cancellationFax: "",
  noticeTemplateReady: false,
  duplicateNoticeConfigured: false,
  signedSellerCopyConfigured: false,
  assistedLiveSigning: false,
  oralDisclosureWorkflowConfirmed: false,
  workStartHoldConfigured: true,
  transactionSignedAt: null,
  cancellationDeadlineDate: null,
  cancelledAt: null,
  workReleasedAt: null,
};

export function HomeSolicitationCompliancePanel({ estimateId }: { estimateId: string }) {
  const [profile, setProfile] = useState<HomeSolicitationProfile>(emptyProfile);
  const [evaluation, setEvaluation] = useState<HomeSolicitationEvaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/estimates/${estimateId}/home-solicitation`, { cache: "no-store" });
        const body = await response.json();
        if (!active || !response.ok) return;
        setProfile({ ...emptyProfile, ...body.profile });
        setEvaluation(body.evaluation || null);
      } catch {
        // Keep the form usable if the initial read is unavailable.
      }
    })();
    return () => { active = false; };
  }, [estimateId]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/estimates/${estimateId}/home-solicitation`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save home-solicitation review.");
      setProfile({ ...emptyProfile, ...body.profile });
      setEvaluation(body.evaluation || null);
      setMessage(body.evaluation?.status === "COMPLIANT" ? "Home-solicitation review passed." : "Saved. Review the items requiring attention below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save home-solicitation review.");
    } finally {
      setBusy(false);
    }
  }

  const status = evaluation?.status || "REVIEW_REQUIRED";
  const attention = evaluation?.checks.filter((check) => check.status === "FAIL" || check.status === "REVIEW") || [];

  return <Card as="section" variant="elevated">
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Home Solicitation Review</CardTitle><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Determines whether Ohio&apos;s three-business-day cancellation workflow applies to this customer transaction.</p></div><StatusBadge status={status} applicable={evaluation?.applicable ?? null} /></div></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Personal/family/household purpose"><select className={inputClass} value={profile.consumerPurpose} onChange={(e) => setProfile({ ...profile, consumerPurpose: e.target.value as HomeSolicitationProfile["consumerPurpose"] })}><option value="unknown">Select</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
        <Field label="Where was agreement/solicitation made?"><select className={inputClass} value={profile.solicitationLocation} onChange={(e) => setProfile({ ...profile, solicitationLocation: e.target.value as HomeSolicitationProfile["solicitationLocation"] })}><option value="unknown">Select</option><option value="buyer_residence">Buyer residence</option><option value="seller_place_of_business">Seller place of business</option><option value="other_away_from_business">Other location away from seller business</option><option value="remote">Remote / electronic</option></select></Field>
        <Field label="Who initiated contact?"><select className={inputClass} value={tri(profile.buyerInitiatedContact)} onChange={(e) => setProfile({ ...profile, buyerInitiatedContact: fromTri(e.target.value) })}><option value="unknown">Unknown</option><option value="yes">Buyer</option><option value="no">Seller</option></select></Field>
        <Field label="Fixed Ohio business location?"><select className={inputClass} value={tri(profile.sellerHasFixedOhioBusiness)} onChange={(e) => setProfile({ ...profile, sellerHasFixedOhioBusiness: fromTri(e.target.value) })}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
        <Field label="Separate federal rescission right applies?"><select className={inputClass} value={tri(profile.federalRescissionRightApplies)} onChange={(e) => setProfile({ ...profile, federalRescissionRightApplies: fromTri(e.target.value) })}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Check label="Entire transaction was buyer-initiated mail/phone with no prior seller contact" checked={profile.entirelyMailOrPhoneBuyerInitiatedNoPriorContact} onChange={(v) => setProfile({ ...profile, entirelyMailOrPhoneBuyerInitiatedNoPriorContact: v })} />
        <Check label="Final agreement followed prior negotiations at seller's fixed retail business" checked={profile.finalAgreementAfterPriorNegotiationsAtSellerBusiness} onChange={(v) => setProfile({ ...profile, finalAgreementAfterPriorNegotiationsAtSellerBusiness: v })} />
        <Check label="Emergency exclusion claimed with separate handwritten buyer waiver" checked={profile.emergencyHandwrittenWaiver} onChange={(v) => setProfile({ ...profile, emergencyHandwrittenWaiver: v })} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Seller name"><input className={inputClass} value={profile.sellerName || ""} onChange={(e) => setProfile({ ...profile, sellerName: e.target.value })} /></Field>
        <Field label="Seller address"><input className={inputClass} value={profile.sellerAddress || ""} onChange={(e) => setProfile({ ...profile, sellerAddress: e.target.value })} /></Field>
        <Field label="Cancellation email"><input className={inputClass} type="email" value={profile.cancellationEmail || ""} onChange={(e) => setProfile({ ...profile, cancellationEmail: e.target.value })} /></Field>
        <Field label="Cancellation fax"><input className={inputClass} value={profile.cancellationFax || ""} onChange={(e) => setProfile({ ...profile, cancellationFax: e.target.value })} /></Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Check label="Required cancellation notice template is configured" checked={profile.noticeTemplateReady === true} onChange={(v) => setProfile({ ...profile, noticeTemplateReady: v })} />
        <Check label="Duplicate detachable/electronic-equivalent cancellation notices are configured" checked={profile.duplicateNoticeConfigured === true} onChange={(v) => setProfile({ ...profile, duplicateNoticeConfigured: v })} />
        <Check label="Signing will be assisted/live rather than unattended" checked={profile.assistedLiveSigning === true} onChange={(v) => setProfile({ ...profile, assistedLiveSigning: v })} />
        <Check label="B.O.S. work-start hold is enabled through the cancellation deadline" checked={profile.workStartHoldConfigured === true} onChange={(v) => setProfile({ ...profile, workStartHoldConfigured: v })} />
      </div>

      <p className="rounded-[var(--radius-control)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">Seller signature and the time-sensitive oral disclosure are recorded with authenticated actions in the Seller &amp; Assisted Signing section below.</p>
      {profile.cancellationDeadlineDate ? <div className="rounded-[var(--radius-control)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">Cancellation deadline: <strong>{profile.cancellationDeadlineDate}</strong>. Work remains on compliance hold until the applicable cancellation period expires or the record is otherwise lawfully released.</div> : null}
      {attention.length ? <div className="rounded-[var(--radius-control)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><p className="font-semibold">Items requiring attention</p><ul className="mt-2 list-disc space-y-1 pl-5">{attention.map((check) => <li key={check.id}>{check.reason || check.label}</li>)}</ul></div> : evaluation ? <div className="rounded-[var(--radius-control)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">No unresolved automated home-solicitation checks.</div> : null}
      <div className="flex flex-wrap items-center gap-3"><Button type="button" size="md" isLoading={busy} onClick={() => void save()}>Save &amp; Review</Button>{message ? <span className="text-sm text-[var(--color-text-secondary)]" role="status">{message}</span> : null}</div>
    </CardContent>
  </Card>;
}

const inputClass = "mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{label}{children}</label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-start gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-3 text-sm text-[var(--color-text-primary)]"><input className="mt-1" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>; }
function tri(value: boolean | null | undefined) { return value == null ? "unknown" : value ? "yes" : "no"; }
function fromTri(value: string) { return value === "yes" ? true : value === "no" ? false : null; }
function StatusBadge({ status, applicable }: { status: "COMPLIANT" | "ACTION_REQUIRED" | "REVIEW_REQUIRED"; applicable: boolean | null }) { const classes = status === "COMPLIANT" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : status === "ACTION_REQUIRED" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"; const label = status === "COMPLIANT" ? (applicable === false ? "Not Applicable" : "Ready") : status === "ACTION_REQUIRED" ? "Action Required" : "Review Required"; return <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.05em] ${classes}`}>{label}</span>; }
