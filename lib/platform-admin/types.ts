export const PLATFORM_PLAN_OPTIONS = ["starter", "professional", "business", "enterprise"] as const;
export const PLATFORM_STATUS_OPTIONS = ["trial", "active", "past_due", "suspended", "canceled"] as const;

export type PlatformPlan = (typeof PLATFORM_PLAN_OPTIONS)[number];
export type PlatformTenantStatus = (typeof PLATFORM_STATUS_OPTIONS)[number];

export type PlatformTenant = {
  companyId: string;
  companyName: string;
  slug: string | null;
  planKey: PlatformPlan;
  lifecycleStatus: PlatformTenantStatus;
  seatLimit: number;
  memberCount: number;
  projectCount: number;
  orionTextAllowance: number;
  orionVoiceMinutes: number;
  supportTier: string;
  trialEndsAt: string | null;
  internalNotes: string | null;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  createdAt: string;
  updatedAt: string;
};
