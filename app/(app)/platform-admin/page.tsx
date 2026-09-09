import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { PlatformTenantConsole } from "@/components/platform-admin/platform-tenant-console";
import type { PlatformPlan, PlatformTenant, PlatformTenantStatus } from "@/lib/platform-admin/types";
import { createClient } from "@/lib/supabase/server";

const ORION_PRODUCTS = new Set(["orion_text", "orion_voice", "orion_document", "orion_autonomous_action"]);

type UsageSummaryRow = {
  company_id: string;
  product: string;
  event_count: number | string;
  provider_failed_count: number | string;
  unpriced_event_count: number | string;
  total_units: number | string;
  provider_cost_micros: number | string;
};

type LedgerSummaryRow = {
  company_id: string;
  product: string;
  settled_credits_consumed: number | string;
  customer_charge_cents: number | string;
  provider_cost_micros: number | string;
  margin_micros: number | string;
};

type IntelligenceCompanySummary = {
  orionEvents: number;
  blueprintEvents: number;
  providerFailures: number;
  providerUnits: number;
  unpricedEvents: number;
  observedProviderCostMicros: number;
  settledCredits: number;
  customerChargeCents: number;
  settledProviderCostMicros: number;
  marginMicros: number;
};

function numeric(value: number | string | null | undefined) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function dollarsFromCents(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
}

function dollarsFromMicros(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value / 1_000_000);
}

export default async function PlatformAdminPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: administrator } = await supabase.from("bos_platform_admins").select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!administrator) redirect("/dashboard");

  // Reporting views intentionally remain available before generated Supabase types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [companies, accounts, memberships, projects, usageSummary, ledgerSummary] = await Promise.all([
    supabase.from("companies").select("id, name, slug, created_at").order("created_at", { ascending: false }),
    supabase.from("bos_tenant_accounts").select("company_id, plan_key, lifecycle_status, seat_limit, orion_text_allowance, orion_voice_minutes, support_tier, trial_ends_at, internal_notes, subscription_status, billing_interval, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, created_at, updated_at"),
    supabase.from("company_memberships").select("company_id").eq("status", "active"),
    supabase.from("projects").select("company_id"),
    db.from("bos_intelligence_usage_summary").select("company_id,product,event_count,provider_failed_count,unpriced_event_count,total_units,provider_cost_micros"),
    db.from("bos_intelligence_ledger_summary").select("company_id,product,settled_credits_consumed,customer_charge_cents,provider_cost_micros,margin_micros"),
  ]);
  const failure = [companies, accounts, memberships, projects, usageSummary, ledgerSummary].find((result) => result.error);
  if (failure?.error) throw new Error(failure.error.message);

  const memberCounts = new Map<string, number>();
  for (const row of memberships.data || []) memberCounts.set(row.company_id, (memberCounts.get(row.company_id) || 0) + 1);
  const projectCounts = new Map<string, number>();
  for (const row of projects.data || []) projectCounts.set(row.company_id, (projectCounts.get(row.company_id) || 0) + 1);
  const accountsByCompany = new Map((accounts.data || []).map((account) => [account.company_id, account]));
  const tenants: PlatformTenant[] = (companies.data || []).map((company) => {
    const account = accountsByCompany.get(company.id);
    return {
      companyId: company.id, companyName: company.name, slug: company.slug,
      planKey: (account?.plan_key || "starter") as PlatformPlan,
      lifecycleStatus: (account?.lifecycle_status || "trial") as PlatformTenantStatus,
      seatLimit: account?.seat_limit || 2, memberCount: memberCounts.get(company.id) || 0, projectCount: projectCounts.get(company.id) || 0,
      orionTextAllowance: account?.orion_text_allowance || 0, orionVoiceMinutes: account?.orion_voice_minutes || 0,
      supportTier: account?.support_tier || "standard", trialEndsAt: account?.trial_ends_at || null, internalNotes: account?.internal_notes || null,
      subscriptionStatus: account?.subscription_status || null, billingInterval: account?.billing_interval || null, currentPeriodEnd: account?.current_period_end || null,
      cancelAtPeriodEnd: account?.cancel_at_period_end || false, hasStripeCustomer: Boolean(account?.stripe_customer_id), hasStripeSubscription: Boolean(account?.stripe_subscription_id),
      createdAt: account?.created_at || company.created_at, updatedAt: account?.updated_at || company.created_at,
    };
  });

  const intelligenceByCompany = new Map<string, IntelligenceCompanySummary>();
  const getSummary = (companyId: string) => {
    const existing = intelligenceByCompany.get(companyId);
    if (existing) return existing;
    const created: IntelligenceCompanySummary = {
      orionEvents: 0,
      blueprintEvents: 0,
      providerFailures: 0,
      providerUnits: 0,
      unpricedEvents: 0,
      observedProviderCostMicros: 0,
      settledCredits: 0,
      customerChargeCents: 0,
      settledProviderCostMicros: 0,
      marginMicros: 0,
    };
    intelligenceByCompany.set(companyId, created);
    return created;
  };

  for (const row of (usageSummary.data || []) as UsageSummaryRow[]) {
    const summary = getSummary(row.company_id);
    const count = numeric(row.event_count);
    if (ORION_PRODUCTS.has(row.product)) summary.orionEvents += count;
    else summary.blueprintEvents += count;
    summary.providerFailures += numeric(row.provider_failed_count);
    summary.providerUnits += numeric(row.total_units);
    summary.unpricedEvents += numeric(row.unpriced_event_count);
    summary.observedProviderCostMicros += numeric(row.provider_cost_micros);
  }
  for (const row of (ledgerSummary.data || []) as LedgerSummaryRow[]) {
    const summary = getSummary(row.company_id);
    summary.settledCredits += numeric(row.settled_credits_consumed);
    summary.customerChargeCents += numeric(row.customer_charge_cents);
    summary.settledProviderCostMicros += numeric(row.provider_cost_micros);
    summary.marginMicros += numeric(row.margin_micros);
  }

  const active = tenants.filter((tenant) => tenant.lifecycleStatus === "active").length;
  const trials = tenants.filter((tenant) => tenant.lifecycleStatus === "trial").length;
  const totalMembers = tenants.reduce((total, tenant) => total + tenant.memberCount, 0);
  const totalEvents = Array.from(intelligenceByCompany.values()).reduce((total, summary) => total + summary.orionEvents + summary.blueprintEvents, 0);
  const totalFailures = Array.from(intelligenceByCompany.values()).reduce((total, summary) => total + summary.providerFailures, 0);

  return (
    <div className="container-wide space-y-[var(--space-section)]">
      <PageHeader eyebrow="B.O.S. Platform" title="Customer Administration" description="Private platform control center for customer companies, subscriptions, seats, Orion allowances, Intelligence usage, onboarding, and account lifecycle." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Customer companies" value={String(tenants.length)} />
        <Kpi label="Active accounts" value={String(active)} />
        <Kpi label="Trials" value={String(trials)} />
        <Kpi label="Managed users" value={String(totalMembers)} />
        <Kpi label="Intelligence events" value={totalEvents.toLocaleString("en-US")} />
        <Kpi label="Provider failures" value={totalFailures.toLocaleString("en-US")} />
      </section>
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] shadow-[var(--shadow-small)]">
        <div className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-5 py-4">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">B.O.S. Intelligence economics</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Observed Orion and Blueprint provider usage versus settled accounting. Customer charging remains inactive until billing activation is explicitly approved.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border-subtle)] text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
              <tr><th className="px-5 py-3">Company</th><th className="px-4 py-3">Orion</th><th className="px-4 py-3">Blueprint</th><th className="px-4 py-3">Failures</th><th className="px-4 py-3">Provider units</th><th className="px-4 py-3">Provider cost</th><th className="px-4 py-3">Settled credits</th><th className="px-4 py-3">Customer charge</th><th className="px-4 py-3">Margin</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {tenants.map((tenant) => {
                const summary = intelligenceByCompany.get(tenant.companyId) || getSummary(tenant.companyId);
                const providerCost = summary.unpricedEvents > 0 ? `${summary.unpricedEvents.toLocaleString("en-US")} unpriced` : dollarsFromMicros(summary.observedProviderCostMicros);
                return <tr key={tenant.companyId} className="text-[var(--color-text-primary)]"><td className="px-5 py-3 font-bold">{tenant.companyName}</td><td className="px-4 py-3">{summary.orionEvents.toLocaleString("en-US")}</td><td className="px-4 py-3">{summary.blueprintEvents.toLocaleString("en-US")}</td><td className="px-4 py-3">{summary.providerFailures.toLocaleString("en-US")}</td><td className="px-4 py-3">{summary.providerUnits.toLocaleString("en-US")}</td><td className="px-4 py-3">{providerCost}</td><td className="px-4 py-3">{summary.settledCredits.toLocaleString("en-US")}</td><td className="px-4 py-3">{dollarsFromCents(summary.customerChargeCents)}</td><td className="px-4 py-3">{dollarsFromMicros(summary.marginMicros)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
      <PlatformTenantConsole initialTenants={tenants} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) { return <article className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-small)]"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">{label}</p><p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{value}</p></article>; }
