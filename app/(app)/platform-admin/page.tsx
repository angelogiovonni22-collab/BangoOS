import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { PlatformTenantConsole } from "@/components/platform-admin/platform-tenant-console";
import type { PlatformPlan, PlatformTenant, PlatformTenantStatus } from "@/lib/platform-admin/types";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformAdminPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: administrator } = await supabase.from("bos_platform_admins").select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!administrator) redirect("/dashboard");

  const [companies, accounts, memberships, projects] = await Promise.all([
    supabase.from("companies").select("id, name, slug, created_at").order("created_at", { ascending: false }),
    supabase.from("bos_tenant_accounts").select("company_id, plan_key, lifecycle_status, seat_limit, orion_text_allowance, orion_voice_minutes, support_tier, trial_ends_at, internal_notes, subscription_status, billing_interval, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, created_at, updated_at"),
    supabase.from("company_memberships").select("company_id").eq("status", "active"),
    supabase.from("projects").select("company_id"),
  ]);
  const failure = [companies, accounts, memberships, projects].find((result) => result.error);
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
  const active = tenants.filter((tenant) => tenant.lifecycleStatus === "active").length;
  const trials = tenants.filter((tenant) => tenant.lifecycleStatus === "trial").length;
  const totalMembers = tenants.reduce((total, tenant) => total + tenant.memberCount, 0);

  return <div className="container-wide space-y-[var(--space-section)]"><PageHeader eyebrow="B.O.S. Platform" title="Customer Administration" description="Private platform control center for customer companies, subscriptions, seats, Orion allowances, onboarding, and account lifecycle." /><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Customer companies" value={String(tenants.length)} /><Kpi label="Active accounts" value={String(active)} /><Kpi label="Trials" value={String(trials)} /><Kpi label="Managed users" value={String(totalMembers)} /></section><PlatformTenantConsole initialTenants={tenants} /></div>;
}

function Kpi({ label, value }: { label: string; value: string }) { return <article className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-small)]"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">{label}</p><p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{value}</p></article>; }
