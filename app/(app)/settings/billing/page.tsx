import { redirect } from "next/navigation";
import { SubscriptionBillingConsole } from "@/components/billing/subscription-billing-console";
import { PageHeader } from "@/components/ui";
import { getServerLocale } from "@/lib/i18n/server";
import type { PlatformPlan } from "@/lib/platform-admin/types";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function SubscriptionBillingPage() {
  const locale = await getServerLocale();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) redirect("/login");
  if (!workspace.context.role || !(["owner", "administrator"] as string[]).includes(workspace.context.role)) redirect("/settings");
  const { data: account, error } = await supabase.from("bos_tenant_accounts").select("plan_key, lifecycle_status, subscription_status, billing_interval, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id").eq("company_id", workspace.context.companyId).single();
  if (error || !account) throw new Error(error?.message || l("B.O.S. billing account not found.", "No se encontró la cuenta de facturación de B.O.S."));
  return <div className="container-wide space-y-[var(--space-section)]">
    <PageHeader eyebrow={l("Company settings", "Configuración de la empresa")} title={l("Subscription & Billing", "Suscripción y facturación")} description={l("Manage your B.O.S. plan, payment method, invoices, renewal, seats, and Orion capacity through Stripe's secure billing system.", "Administra tu plan de B.O.S., método de pago, facturas, renovación, puestos y capacidad de Orion mediante el sistema seguro de facturación de Stripe.")} />
    <SubscriptionBillingConsole sandboxConfigured={Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)} account={{ planKey: account.plan_key as PlatformPlan, lifecycleStatus: account.lifecycle_status, subscriptionStatus: account.subscription_status, billingInterval: account.billing_interval, currentPeriodEnd: account.current_period_end, cancelAtPeriodEnd: account.cancel_at_period_end, hasStripeCustomer: Boolean(account.stripe_customer_id), hasStripeSubscription: Boolean(account.stripe_subscription_id) }} />
  </div>;
}
