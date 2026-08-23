import type { PlatformPlan } from "@/lib/platform-admin/types";

export type BillingInterval = "month" | "year";

export type BillingPlanDefinition = {
  key: PlatformPlan;
  name: string;
  description: string;
  seatLimit: number;
  orionTextAllowance: number;
  orionVoiceMinutes: number;
  supportTier: "standard" | "priority" | "dedicated";
  features: string[];
};

export const BILLING_PLANS: BillingPlanDefinition[] = [
  { key: "starter", name: "Starter", description: "Core B.O.S. operations for small contractors.", seatLimit: 3, orionTextAllowance: 500, orionVoiceMinutes: 60, supportTier: "standard", features: ["Projects, customers, and scheduling", "Estimates and invoices", "500 Orion text actions", "3 team seats"] },
  { key: "professional", name: "Professional", description: "Connected field and office operations for growing teams.", seatLimit: 8, orionTextAllowance: 1500, orionVoiceMinutes: 180, supportTier: "standard", features: ["Everything in Starter", "Workforce and field operations", "1,500 Orion text actions", "8 team seats"] },
  { key: "business", name: "Business", description: "Full operating control for established construction companies.", seatLimit: 15, orionTextAllowance: 3000, orionVoiceMinutes: 400, supportTier: "priority", features: ["Everything in Professional", "Advanced finance and compliance", "3,000 Orion text actions", "Priority support"] },
  { key: "enterprise", name: "Enterprise", description: "Custom capacity, controls, and support for large organizations.", seatLimit: 50, orionTextAllowance: 10000, orionVoiceMinutes: 1500, supportTier: "dedicated", features: ["Everything in Business", "Custom limits and onboarding", "Dedicated support", "Enterprise administration"] },
];

const PRICE_ENV: Record<PlatformPlan, Record<BillingInterval, string>> = {
  starter: { month: "STRIPE_PRICE_STARTER_MONTHLY", year: "STRIPE_PRICE_STARTER_ANNUAL" },
  professional: { month: "STRIPE_PRICE_PROFESSIONAL_MONTHLY", year: "STRIPE_PRICE_PROFESSIONAL_ANNUAL" },
  business: { month: "STRIPE_PRICE_BUSINESS_MONTHLY", year: "STRIPE_PRICE_BUSINESS_ANNUAL" },
  enterprise: { month: "STRIPE_PRICE_ENTERPRISE_MONTHLY", year: "STRIPE_PRICE_ENTERPRISE_ANNUAL" },
};

export function getBillingPlan(planKey: PlatformPlan) {
  return BILLING_PLANS.find((plan) => plan.key === planKey) ?? null;
}

export function getStripePriceId(planKey: PlatformPlan, interval: BillingInterval) {
  return process.env[PRICE_ENV[planKey][interval]]?.trim() || null;
}

export function resolvePlanFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  for (const plan of BILLING_PLANS) {
    for (const interval of ["month", "year"] as const) {
      if (getStripePriceId(plan.key, interval) === priceId) return { plan, interval };
    }
  }
  return null;
}

