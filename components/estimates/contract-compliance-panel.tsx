"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ContractComplianceEvaluation } from "@/lib/compliance/contract-compliance";
import type { EstimateComplianceProfile } from "@/lib/compliance/estimate-contract-compliance-service";

const emptyProfile: EstimateComplianceProfile = {
  propertyState: "OH",
  propertyClass: "unknown",
  pricingType: "unknown",
  supplierName: "Bango Construction LLC",
  supplierPhysicalAddress: "",
  supplierPhone: "",
  supplierTaxpayerIdPresent: false,
  ownerName: "",
  ownerAddress: "",
  ownerPhone: "",
  projectAddress: "",
  anticipatedStart: "",
  anticipatedCompletion: "",
  excludedInstallationOrDeliveryCostsDisclosed: false,
  liabilityInsuranceDocumented: false,
  liabilityCoverageAmount: null,
  insuranceDocumentReference: "",
  excessCostMethod: null,
  depositAmount: null,
  specialOrderAmount: null,
  specialOrderNonreturnable: false,
};

export function ContractCompliancePanel({ estimateId, totalAmount }: { estimateId: string; totalAmount: number }) {
  const [profile, setProfile] = useState<EstimateComplianceProfile>(emptyProfile);
  const [evaluation, setEvaluation] = useState<ContractComplianceEvaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/estimates/${estimateId}/compliance`, { cache: "no-store" });
        const body = await response.json();
        if (!active || !response.ok) return;
        setProfile({ ...emptyProfile, ...body.profile });
        setEvaluation(body.evaluation || null);
      } catch {
        // The panel remains editable even if the initial read is unavailable.
      }
    })();
    return () => { active = false; };
  }, [estimateId]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/estimates/${estimateId}/compliance`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save contract compliance details.");
      setProfile({ ...emptyProfile, ...body.profile });
      setEvaluation(body.evaluation || null);
      setMessage(body.evaluation?.status === "COMPLIANT" ? "Compliance check passed. Ready to send." : "Saved. Review the items requiring attention below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save contract compliance details.");
    } finally {
      setBusy(false);
    }
  }

  const enhanced = totalAmount >= 25_000;
  const status = evaluation?.status || (enhanced ? "REVIEW_REQUIRED" : "COMPLIANT");
  const attention = evaluation?.checks.filter((check) => check.status === "FAIL" || check.status === "REVIEW") || [];

  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Contract Compliance</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Ohio residential contract readiness. B.O.S. checks requirements before a signing link can be sent.</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!enhanced ? (
          <p className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            This estimate is below the $25,000 Ohio enhanced-contract send gate. You can still complete these details for the project record.
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Project state"><input className={inputClass} value={profile.propertyState || ""} onChange={(e) => setProfile({ ...profile, propertyState: e.target.value })} /></Field>
          <Field label="Property classification"><select className={inputClass} value={profile.propertyClass} onChange={(e) => setProfile({ ...profile, propertyClass: e.target.value as EstimateComplianceProfile["propertyClass"] })}><option value="unknown">Select classification</option><option value="one_to_three_family">1–3 family dwelling</option><option value="individual_unit_in_four_plus">Individual unit in 4+ dwelling building</option><option value="four_plus_common_or_building">4+ dwelling building/common work</option><option value="condominium_common_area">Condominium common area</option><option value="manufactured_or_mobile">Manufactured/mobile home</option></select></Field>
          <Field label="Pricing type"><select className={inputClass} value={profile.pricingType} onChange={(e) => setProfile({ ...profile, pricingType: e.target.value as EstimateComplianceProfile["pricingType"] })}><option value="unknown">Select pricing type</option><option value="fixed">Fixed price</option><option value="estimated">Estimated price</option><option value="cost_plus">Cost-plus</option></select></Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Contractor legal name"><input className={inputClass} value={profile.supplierName || ""} onChange={(e) => setProfile({ ...profile, supplierName: e.target.value })} /></Field>
          <Field label="Contractor business phone"><input className={inputClass} value={profile.supplierPhone || ""} onChange={(e) => setProfile({ ...profile, supplierPhone: e.target.value })} /></Field>
          <Field label="Contractor physical business address"><input className={inputClass} value={profile.supplierPhysicalAddress || ""} onChange={(e) => setProfile({ ...profile, supplierPhysicalAddress: e.target.value })} /></Field>
          <Check label="Taxpayer identification information is recorded securely" checked={profile.supplierTaxpayerIdPresent === true} onChange={(checked) => setProfile({ ...profile, supplierTaxpayerIdPresent: checked })} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Owner/customer name"><input className={inputClass} value={profile.ownerName || ""} onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })} /></Field>
          <Field label="Owner/customer phone"><input className={inputClass} value={profile.ownerPhone || ""} onChange={(e) => setProfile({ ...profile, ownerPhone: e.target.value })} /></Field>
          <Field label="Owner/customer address"><input className={inputClass} value={profile.ownerAddress || ""} onChange={(e) => setProfile({ ...profile, ownerAddress: e.target.value })} /></Field>
          <Field label="Project property address"><input className={inputClass} value={profile.projectAddress || ""} onChange={(e) => setProfile({ ...profile, projectAddress: e.target.value })} /></Field>
          <Field label="Anticipated start date or period"><input className={inputClass} value={profile.anticipatedStart || ""} onChange={(e) => setProfile({ ...profile, anticipatedStart: e.target.value })} placeholder="e.g. September 2026" /></Field>
          <Field label="Anticipated completion date or period"><input className={inputClass} value={profile.anticipatedCompletion || ""} onChange={(e) => setProfile({ ...profile, anticipatedCompletion: e.target.value })} placeholder="e.g. October 2026" /></Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Check label="All installation, delivery, and other excluded costs are disclosed (or none are excluded)" checked={profile.excludedInstallationOrDeliveryCostsDisclosed === true} onChange={(checked) => setProfile({ ...profile, excludedInstallationOrDeliveryCostsDisclosed: checked })} />
          <Check label="General liability insurance certificate is documented" checked={profile.liabilityInsuranceDocumented === true} onChange={(checked) => setProfile({ ...profile, liabilityInsuranceDocumented: checked })} />
          <Field label="General liability coverage amount"><input className={inputClass} type="number" min="0" value={profile.liabilityCoverageAmount ?? ""} onChange={(e) => setProfile({ ...profile, liabilityCoverageAmount: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <Field label="Insurance document reference"><input className={inputClass} value={profile.insuranceDocumentReference || ""} onChange={(e) => setProfile({ ...profile, insuranceDocumentReference: e.target.value })} placeholder="File name, document ID, or policy reference" /></Field>
          <Field label="Excess-cost selection"><select className={inputClass} value={profile.excessCostMethod || ""} onChange={(e) => setProfile({ ...profile, excessCostMethod: (e.target.value || null) as EstimateComplianceProfile["excessCostMethod"] })}><option value="">Select method</option><option value="written">Written estimate</option><option value="oral">Oral estimate</option><option value="firm_price_no_excess">Firm price — no excess costs charged</option></select></Field>
        </div>

        {attention.length ? (
          <div className="rounded-[var(--radius-control)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Items requiring attention</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{attention.map((check) => <li key={check.id}>{check.reason || check.label}</li>)}</ul>
          </div>
        ) : evaluation ? (
          <div className="rounded-[var(--radius-control)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">All currently applicable automated checks passed.</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="md" isLoading={busy} onClick={() => void save()}>Save &amp; Check Compliance</Button>
          {message ? <span className="text-sm text-[var(--color-text-secondary)]" role="status">{message}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

const inputClass = "mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{label}{children}</label>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-start gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-3 text-sm text-[var(--color-text-primary)]"><input className="mt-1" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;
}

function StatusBadge({ status }: { status: "COMPLIANT" | "ACTION_REQUIRED" | "REVIEW_REQUIRED" }) {
  const classes = status === "COMPLIANT" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : status === "ACTION_REQUIRED" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800";
  const label = status === "COMPLIANT" ? "Ready to Send" : status === "ACTION_REQUIRED" ? "Action Required" : "Review Required";
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.05em] ${classes}`}>{label}</span>;
}
