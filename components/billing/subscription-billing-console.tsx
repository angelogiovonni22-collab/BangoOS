"use client";

import { useState } from "react";
import { BILLING_PLANS, type BillingInterval } from "@/lib/billing/plans";
import type { PlatformPlan } from "@/lib/platform-admin/types";

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

export function SubscriptionBillingConsole({ account, sandboxConfigured }: { account: BillingAccount; sandboxConfigured: boolean }) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function redirectFrom(endpoint: string, body?: object) {
    setWorking(endpoint);
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "The billing request could not be completed.");
      window.location.assign(payload.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The billing request could not be completed.");
      setWorking(null);
    }
  }

  return <div className="space-y-5">
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-small)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Current subscription</p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{BILLING_PLANS.find((plan) => plan.key === account.planKey)?.name || "B.O.S."}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Status: {account.subscriptionStatus || account.lifecycleStatus}{account.billingInterval ? ` · billed ${account.billingInterval}ly` : ""}</p>
          {account.currentPeriodEnd ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{account.cancelAtPeriodEnd ? "Access ends" : "Next renewal"}: {new Date(account.currentPeriodEnd).toLocaleDateString()}</p> : null}
        </div>
        {account.hasStripeCustomer ? <button type="button" disabled={working !== null} onClick={() => redirectFrom("/api/billing/portal")} className="rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-primary)] disabled:opacity-60">{working === "/api/billing/portal" ? "Opening…" : "Manage billing"}</button> : null}
      </div>
    </section>

    {!sandboxConfigured ? <p role="status" className="rounded-[var(--radius-control)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Stripe Sandbox connection is awaiting its secure Vercel environment configuration. No payment can be collected yet.</p> : null}
    {message ? <p role="alert" className="rounded-[var(--radius-control)] border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">{message}</p> : null}

    <section aria-labelledby="billing-plans-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 id="billing-plans-heading" className="text-xl font-bold text-[var(--color-text-primary)]">B.O.S. plans</h2><p className="text-sm text-[var(--color-text-secondary)]">Choose the operating capacity that fits your company.</p></div>
        <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-1" aria-label="Billing interval">
          {(["month", "year"] as const).map((value) => <button key={value} type="button" aria-pressed={interval === value} onClick={() => setInterval(value)} className={`rounded-[8px] px-4 py-2 text-sm font-bold ${interval === value ? "bg-[var(--color-action-primary)] text-white" : "text-[var(--color-text-secondary)]"}`}>{value === "month" ? "Monthly" : "Annual"}</button>)}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BILLING_PLANS.map((plan) => {
          const current = plan.key === account.planKey;
          const enterprise = plan.key === "enterprise";
          return <article key={plan.key} className={`flex flex-col rounded-[var(--radius-card)] border bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-small)] ${current ? "border-[var(--color-action-primary)] ring-2 ring-[color-mix(in_srgb,var(--color-action-primary)_18%,transparent)]" : "border-[var(--color-border-subtle)]"}`}>
            <div><div className="flex items-center justify-between gap-2"><h3 className="text-lg font-bold text-[var(--color-text-primary)]">{plan.name}</h3>{current ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">Current</span> : null}</div><p className="mt-2 min-h-10 text-sm text-[var(--color-text-secondary)]">{plan.description}</p></div>
            <p className="mt-4 text-sm font-bold text-[var(--color-text-primary)]">{enterprise ? "Custom pricing" : "Stripe price shown securely at checkout"}</p>
            <ul className="my-5 space-y-2 text-sm text-[var(--color-text-secondary)]">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><span aria-hidden="true" className="font-bold text-emerald-600">✓</span><span>{feature}</span></li>)}</ul>
            <button type="button" disabled={working !== null || current || account.hasStripeSubscription || !sandboxConfigured || enterprise} onClick={() => redirectFrom("/api/billing/checkout", { planKey: plan.key, interval })} className="mt-auto rounded-[var(--radius-control)] bg-[var(--color-action-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{current ? "Current plan" : enterprise ? "Platform review required" : account.hasStripeSubscription ? "Use Manage billing" : working === "/api/billing/checkout" ? "Opening checkout…" : "Start secure checkout"}</button>
          </article>;
        })}
      </div>
    </section>
  </div>;
}

