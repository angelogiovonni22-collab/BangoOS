import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingPlan, resolvePlanFromPriceId } from "@/lib/billing/plans";
import { PLATFORM_PLAN_OPTIONS, type PlatformPlan } from "@/lib/platform-admin/types";
import type { Database, Json } from "@/types/database.types";

export type StripeEvent = { id: string; type: string; livemode: boolean; created: number; data: { object: Record<string, unknown> } };

function text(value: unknown) { return typeof value === "string" ? value : null; }
function metadata(object: Record<string, unknown>) { return (object.metadata && typeof object.metadata === "object" ? object.metadata : {}) as Record<string, unknown>; }
function stripeId(value: unknown) { return typeof value === "string" ? value : value && typeof value === "object" && "id" in value ? text((value as { id?: unknown }).id) : null; }
function timestamp(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null; }
function subscriptionPeriodEnd(object: Record<string, unknown>) {
  const direct = timestamp(object.current_period_end);
  if (direct) return direct;
  const items = object.items && typeof object.items === "object" && "data" in object.items ? (object.items as { data?: Array<Record<string, unknown>> }).data : null;
  const ends = (items || []).map((item) => typeof item.current_period_end === "number" ? item.current_period_end : 0);
  return timestamp(Math.max(0, ...ends));
}
function subscriptionPrice(object: Record<string, unknown>) {
  const items = object.items && typeof object.items === "object" && "data" in object.items ? (object.items as { data?: Array<Record<string, unknown>> }).data : null;
  const price = items?.[0]?.price;
  return price && typeof price === "object" ? price as Record<string, unknown> : null;
}
function lifecycle(status: string | null) {
  if (status === "trialing") return "trial";
  if (status === "active") return "active";
  if (status === "canceled") return "canceled";
  if (status === "paused") return "suspended";
  return "past_due";
}

export function isStripeEvent(value: unknown): value is StripeEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<StripeEvent>;
  return typeof event.id === "string" && event.id.length > 0
    && typeof event.type === "string" && event.type.length > 0
    && typeof event.livemode === "boolean" && typeof event.created === "number"
    && Number.isSafeInteger(event.created) && event.created >= 0 && event.created <= 8640000000000
    && !!event.data && typeof event.data === "object" && !!event.data.object
    && typeof event.data.object === "object" && !Array.isArray(event.data.object);
}

export async function processVerifiedBillingEvent(event: StripeEvent, admin: SupabaseClient<Database>) {
  const object = event.data.object;
  let update: Database["public"]["Tables"]["bos_tenant_accounts"]["Update"] | null = null;
  let processingError: string | null = null;
  let companyId = text(metadata(object).company_id) || text(object.client_reference_id);
  try {
    if (event.type === "checkout.session.completed") {
      const subscriptionId = stripeId(object.subscription);
      const customerId = stripeId(object.customer);
      if (!companyId) throw new Error("Checkout session is missing its company reference.");
      update = { stripe_customer_id: customerId, billing_customer_ref: customerId, stripe_subscription_id: subscriptionId, subscription_ref: subscriptionId, last_webhook_event_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    } else if (event.type.startsWith("customer.subscription.")) {
      const customerId = stripeId(object.customer);
      if (!companyId && customerId) {
        const result = await admin.from("bos_tenant_accounts").select("company_id").eq("stripe_customer_id", customerId).maybeSingle();
        if (result.error) throw new Error(result.error.message);
        companyId = result.data?.company_id || null;
      }
      if (!companyId) throw new Error("Subscription event could not be matched to a B.O.S. company.");
      const status = text(object.status);
      const price = subscriptionPrice(object);
      const priceId = stripeId(price);
      const productId = stripeId(price?.product);
      const resolved = resolvePlanFromPriceId(priceId);
      const metadataPlan = text(metadata(object).plan_key);
      const planKey = metadataPlan && PLATFORM_PLAN_OPTIONS.includes(metadataPlan as PlatformPlan) ? metadataPlan as PlatformPlan : resolved?.plan.key;
      const plan = planKey ? getBillingPlan(planKey) : null;
      update = {
        stripe_customer_id: customerId, billing_customer_ref: customerId,
        stripe_subscription_id: object.id as string, subscription_ref: object.id as string,
        stripe_product_id: productId, stripe_price_id: priceId,
        billing_interval: resolved?.interval || text(metadata(object).billing_interval), subscription_status: status,
        lifecycle_status: lifecycle(status), current_period_end: subscriptionPeriodEnd(object),
        cancel_at_period_end: object.cancel_at_period_end === true,
        ...(plan ? { plan_key: plan.key, seat_limit: plan.seatLimit, orion_text_allowance: plan.orionTextAllowance, orion_voice_minutes: plan.orionVoiceMinutes, support_tier: plan.supportTier } : {}),
        last_webhook_event_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const customerId = stripeId(object.customer);
      if (!companyId && customerId) {
        const result = await admin.from("bos_tenant_accounts").select("company_id").eq("stripe_customer_id", customerId).maybeSingle();
        if (result.error) throw new Error(result.error.message);
        companyId = result.data?.company_id || null;
      }
      if (!companyId) throw new Error("Invoice event could not be matched to a B.O.S. company.");
      const paid = event.type === "invoice.paid";
      update = { payment_method_status: paid ? "current" : "action_required", ...(paid ? { last_payment_at: timestamp(object.status_transitions && typeof object.status_transitions === "object" ? (object.status_transitions as Record<string, unknown>).paid_at : event.created) } : { lifecycle_status: "past_due" }), last_webhook_event_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    }
    if (!update) companyId = null;
  } catch (error) {
    processingError = error instanceof Error ? error.message : "Webhook processing failed.";
  }
  if (companyId && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(companyId)) {
    companyId = null;
    update = null;
    processingError = "Billing event contains an invalid company reference.";
  }
  const applied = await admin.rpc("apply_billing_webhook_event", {
    p_event: event as unknown as Json, p_company_id: companyId,
    p_update: update as Json, p_processing_error: processingError,
  });
  if (applied.error) return { status: 500, body: { error: applied.error.message } };
  const result = applied.data;
  if (!result || typeof result !== "object" || Array.isArray(result)
      || !["processed", "ignored", "failed"].includes(String(result.status))
      || typeof result.duplicate !== "boolean") {
    return { status: 500, body: { error: "Billing event completion was not confirmed." } };
  }
  if (result.status === "failed") return { status: 500, body: { error: String(result.error || "Webhook processing failed.") } };
  return { status: 200, body: { received: true, duplicate: result.duplicate } };
}
