"use client";

import { useState } from "react";
import { BILLING_PLANS, type BillingInterval } from "@/lib/billing/plans";
import type { PlatformPlan } from "@/lib/platform-admin/types";
import { useI18n } from "@/lib/i18n/provider";

type BillingAccount = {
  planKey: PlatformPlan;
  lifecycleStatus: string;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
};

type PlanCopy = { description: string; features: string[] };

function formatBillingDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function spanishPlanCopy(planKey: PlatformPlan): PlanCopy | null {
  const copy: Record<PlatformPlan, PlanCopy> = {
    starter: {
      description: "Operaciones esenciales de B.O.S. para contratistas pequeños.",
      features: ["Proyectos, clientes y programación", "Presupuestos y facturas", "500 acciones de texto de Orion", "3 puestos de equipo"],
    },
    professional: {
      description: "Operaciones conectadas de campo y oficina para equipos en crecimiento.",
      features: ["Todo lo incluido en Starter", "Fuerza laboral y operaciones de campo", "1,500 acciones de texto de Orion", "8 puestos de equipo"],
    },
    business: {
      description: "Control operativo completo para empresas de construcción establecidas.",
      features: ["Todo lo incluido en Professional", "Finanzas y cumplimiento avanzados", "3,000 acciones de texto de Orion", "Soporte prioritario"],
    },
    enterprise: {
      description: "Capacidad, controles y soporte personalizados para organizaciones grandes.",
      features: ["Todo lo incluido en Business", "Límites e incorporación personalizados", "Soporte dedicado", "Administración empresarial"],
    },
  };
  return copy[planKey] ?? null;
}

function localizeStatus(value: string, es: boolean) {
  if (!es) return value.replaceAll("_", " ");
  const labels: Record<string, string> = {
    active: "activo",
    trialing: "en prueba",
    incomplete: "incompleto",
    incomplete_expired: "incompleto vencido",
    past_due: "vencido",
    canceled: "cancelado",
    unpaid: "sin pagar",
    paused: "pausado",
    suspended: "suspendido",
  };
  return labels[value.toLowerCase()] || value.replaceAll("_", " ");
}

export function SubscriptionBillingConsole({ account, sandboxConfigured }: { account: BillingAccount; sandboxConfigured: boolean }) {
  const { locale } = useI18n();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function redirectFrom(endpoint: string, body?: object) {
    setWorking(endpoint);
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || l("The billing request could not be completed.", "No se pudo completar la solicitud de facturación."));
      window.location.assign(payload.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l("The billing request could not be completed.", "No se pudo completar la solicitud de facturación."));
      setWorking(null);
    }
  }

  const rawStatus = account.subscriptionStatus || account.lifecycleStatus;
  const billedLabel = account.billingInterval === "year" ? l("annual", "anualmente") : account.billingInterval === "month" ? l("monthly", "mensualmente") : account.billingInterval;

  return <div className="space-y-5">
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-small)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">{l("Current subscription", "Suscripción actual")}</p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{BILLING_PLANS.find((plan) => plan.key === account.planKey)?.name || "B.O.S."}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{l("Status", "Estado")}: {localizeStatus(rawStatus, es)}{billedLabel ? ` · ${l("billed", "facturado")} ${billedLabel}` : ""}</p>
          {account.currentPeriodEnd ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{account.cancelAtPeriodEnd ? l("Access ends", "El acceso termina") : l("Next renewal", "Próxima renovación")}: {formatBillingDate(account.currentPeriodEnd, locale)}</p> : null}
        </div>
        {account.hasStripeCustomer ? <button type="button" disabled={working !== null} onClick={() => redirectFrom("/api/billing/portal")} className="rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-primary)] disabled:opacity-60">{working === "/api/billing/portal" ? l("Opening…", "Abriendo…") : l("Manage billing", "Administrar facturación")}</button> : null}
      </div>
    </section>

    {!sandboxConfigured ? <p role="status" className="rounded-[var(--radius-control)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{l("Stripe Sandbox connection is awaiting its secure Vercel environment configuration. No payment can be collected yet.", "La conexión de Stripe Sandbox está esperando su configuración segura en Vercel. Todavía no se puede cobrar ningún pago.")}</p> : null}
    {message ? <p role="alert" className="rounded-[var(--radius-control)] border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">{message}</p> : null}

    <section aria-labelledby="billing-plans-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 id="billing-plans-heading" className="text-xl font-bold text-[var(--color-text-primary)]">{l("B.O.S. plans", "Planes de B.O.S.")}</h2><p className="text-sm text-[var(--color-text-secondary)]">{l("Choose the operating capacity that fits your company.", "Elige la capacidad operativa que se adapte a tu empresa.")}</p></div>
        <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-1" aria-label={l("Billing interval", "Intervalo de facturación")}>
          {(["month", "year"] as const).map((value) => <button key={value} type="button" aria-pressed={interval === value} onClick={() => setInterval(value)} className={`rounded-[8px] px-4 py-2 text-sm font-bold ${interval === value ? "bg-[var(--color-action-primary)] text-white" : "text-[var(--color-text-secondary)]"}`}>{value === "month" ? l("Monthly", "Mensual") : l("Annual", "Anual")}</button>)}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BILLING_PLANS.map((plan) => {
          const current = plan.key === account.planKey;
          const enterprise = plan.key === "enterprise";
          const translated = es ? spanishPlanCopy(plan.key) : null;
          const description = translated?.description || plan.description;
          const features = translated?.features || plan.features;
          return <article key={plan.key} className={`flex flex-col rounded-[var(--radius-card)] border bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-small)] ${current ? "border-[var(--color-action-primary)] ring-2 ring-[color-mix(in_srgb,var(--color-action-primary)_18%,transparent)]" : "border-[var(--color-border-subtle)]"}`}>
            <div><div className="flex items-center justify-between gap-2"><h3 className="text-lg font-bold text-[var(--color-text-primary)]">{plan.name}</h3>{current ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">{l("Current", "Actual")}</span> : null}</div><p className="mt-2 min-h-10 text-sm text-[var(--color-text-secondary)]">{description}</p></div>
            <p className="mt-4 text-sm font-bold text-[var(--color-text-primary)]">{enterprise ? l("Custom pricing", "Precio personalizado") : l("Stripe price shown securely at checkout", "El precio de Stripe se muestra de forma segura al pagar")}</p>
            <ul className="my-5 space-y-2 text-sm text-[var(--color-text-secondary)]">{features.map((feature) => <li key={feature} className="flex gap-2"><span aria-hidden="true" className="font-bold text-emerald-600">✓</span><span>{feature}</span></li>)}</ul>
            <button type="button" disabled={working !== null || current || account.hasStripeSubscription || !sandboxConfigured || enterprise} onClick={() => redirectFrom("/api/billing/checkout", { planKey: plan.key, interval })} className="mt-auto rounded-[var(--radius-control)] bg-[var(--color-action-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{current ? l("Current plan", "Plan actual") : enterprise ? l("Platform review required", "Se requiere revisión de la plataforma") : account.hasStripeSubscription ? l("Use Manage billing", "Usa Administrar facturación") : working === "/api/billing/checkout" ? l("Opening checkout…", "Abriendo pago…") : l("Start secure checkout", "Iniciar pago seguro")}</button>
          </article>;
        })}
      </div>
    </section>
  </div>;
}
