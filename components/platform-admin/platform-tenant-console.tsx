"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_PLAN_OPTIONS, PLATFORM_STATUS_OPTIONS, type PlatformPlan, type PlatformTenant, type PlatformTenantStatus } from "@/lib/platform-admin/types";
import { useI18n } from "@/lib/i18n/provider";

function title(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatPlatformDate(value: string, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatPlatformDateTime(value: string, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function PlatformTenantConsole({ initialTenants }: { initialTenants: PlatformTenant[] }) {
  const router = useRouter();
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const [tenants, setTenants] = useState(initialTenants);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? tenants.filter((tenant) => `${tenant.companyName} ${tenant.slug || ""} ${tenant.planKey} ${tenant.lifecycleStatus}`.toLowerCase().includes(normalized)) : tenants;
  }, [query, tenants]);

  async function updateTenant(companyId: string, changes: Partial<Pick<PlatformTenant, "planKey" | "lifecycleStatus" | "seatLimit" | "orionTextAllowance" | "orionVoiceMinutes" | "internalNotes">>) {
    setSaving(companyId);
    setMessage(null);
    try {
      const response = await fetch(`/api/platform-admin/tenants/${companyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
      });
      const payload = await response.json() as { ok?: boolean; tenant?: PlatformTenant; error?: string };
      if (!response.ok || !payload.ok || !payload.tenant) throw new Error(payload.error || "Unable to update this company.");
      setTenants((current) => current.map((tenant) => tenant.companyId === companyId ? payload.tenant! : tenant));
      setMessage(`${payload.tenant.companyName} was updated.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this company.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="space-y-4" aria-label="Customer company management">
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-bold text-[var(--color-text-primary)]">Customer companies</h2><p className="text-sm text-[var(--color-text-secondary)]">Manage plans, lifecycle state, seats, and Orion allowances.</p></div>
        <label className="w-full sm:max-w-sm"><span className="sr-only">Search customer companies</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search companies or plans" className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)]" /></label>
      </div>
      {message ? <p role="status" className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)]">{message}</p> : null}
      <div className="grid gap-4">
        {filtered.map((tenant) => <TenantCard key={tenant.companyId} tenant={tenant} saving={saving === tenant.companyId} onSave={updateTenant} localeTag={localeTag} />)}
        {filtered.length === 0 ? <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-8 text-center text-sm text-[var(--color-text-secondary)]">No customer companies match this search.</div> : null}
      </div>
    </section>
  );
}

function TenantCard({ tenant, saving, onSave, localeTag }: { tenant: PlatformTenant; saving: boolean; onSave: (companyId: string, changes: Partial<PlatformTenant>) => Promise<void>; localeTag: string }) {
  const [planKey, setPlanKey] = useState<PlatformPlan>(tenant.planKey);
  const [lifecycleStatus, setLifecycleStatus] = useState<PlatformTenantStatus>(tenant.lifecycleStatus);
  const [seatLimit, setSeatLimit] = useState(tenant.seatLimit);
  const [orionTextAllowance, setOrionTextAllowance] = useState(tenant.orionTextAllowance);
  const [orionVoiceMinutes, setOrionVoiceMinutes] = useState(tenant.orionVoiceMinutes);
  const [internalNotes, setInternalNotes] = useState(tenant.internalNotes || "");
  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] shadow-[var(--shadow-small)]">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="text-lg font-bold text-[var(--color-text-primary)]">{tenant.companyName}</h3><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">{tenant.slug || "No workspace slug"}</p></div>
        <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">{title(tenant.planKey)}</span><span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{title(tenant.lifecycleStatus)}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{tenant.hasStripeSubscription ? `Stripe ${title(tenant.subscriptionStatus || "connected")}` : tenant.hasStripeCustomer ? "Stripe customer" : "Manual billing"}</span></div>
      </div>
      <div className="grid min-w-0 gap-4 p-5 lg:grid-cols-3">
        <div className="grid min-w-0 grid-cols-2 gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] p-4 text-sm"><Metric label="Members" value={`${tenant.memberCount}/${tenant.seatLimit}`} /><Metric label="Projects" value={String(tenant.projectCount)} /><Metric label="Text allowance" value={tenant.orionTextAllowance.toLocaleString(localeTag)} /><Metric label="Voice minutes" value={tenant.orionVoiceMinutes.toLocaleString(localeTag)} />{tenant.currentPeriodEnd ? <Metric label={tenant.cancelAtPeriodEnd ? "Access ends" : "Renews"} value={formatPlatformDate(tenant.currentPeriodEnd, localeTag)} /> : null}<Metric label="Billing" value={tenant.billingInterval ? title(tenant.billingInterval) : "Manual"} /></div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:col-span-2">
          <Field label="Plan"><select value={planKey} onChange={(event) => setPlanKey(event.target.value as PlatformPlan)}>{PLATFORM_PLAN_OPTIONS.map((option) => <option key={option} value={option}>{title(option)}</option>)}</select></Field>
          <Field label="Account status"><select value={lifecycleStatus} onChange={(event) => setLifecycleStatus(event.target.value as PlatformTenantStatus)}>{PLATFORM_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{title(option)}</option>)}</select></Field>
          <Field label="Seat limit"><input type="number" min={1} value={seatLimit} onChange={(event) => setSeatLimit(Number(event.target.value))} /></Field>
          <Field label="Orion text actions"><input type="number" min={0} value={orionTextAllowance} onChange={(event) => setOrionTextAllowance(Number(event.target.value))} /></Field>
          <Field label="Orion voice minutes"><input type="number" min={0} value={orionVoiceMinutes} onChange={(event) => setOrionVoiceMinutes(Number(event.target.value))} /></Field>
          <Field label="Internal support notes"><input value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Visible only to B.O.S. platform staff" /></Field>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] px-5 py-4"><p className="text-xs text-[var(--color-text-secondary)]">Updated {formatPlatformDateTime(tenant.updatedAt, localeTag)}</p><button type="button" disabled={saving} onClick={() => onSave(tenant.companyId, { planKey, lifecycleStatus, seatLimit, orionTextAllowance, orionVoiceMinutes, internalNotes })} className="rounded-[var(--radius-control)] bg-[var(--color-action-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : "Save company"}</button></div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p><p className="mt-1 break-words text-base font-bold leading-tight text-[var(--color-text-primary)]">{value}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="min-w-0 text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]"><span>{label}</span><span className="mt-1 block min-w-0 [&_input]:h-10 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-[var(--radius-control)] [&_input]:border [&_input]:border-[var(--color-border-strong)] [&_input]:bg-[var(--color-surface-subtle)] [&_input]:px-3 [&_input]:text-sm [&_input]:font-medium [&_input]:normal-case [&_input]:tracking-normal [&_input]:text-[var(--color-text-primary)] [&_select]:h-10 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-[var(--radius-control)] [&_select]:border [&_select]:border-[var(--color-border-strong)] [&_select]:bg-[var(--color-surface-subtle)] [&_select]:px-3 [&_select]:text-sm [&_select]:font-medium [&_select]:normal-case [&_select]:tracking-normal [&_select]:text-[var(--color-text-primary)]">{children}</span></label>; }
