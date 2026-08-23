import { NextRequest, NextResponse } from "next/server";
import { getBillingPlan, resolvePlanFromPriceId } from "@/lib/billing/plans";
import { verifyStripeSignature } from "@/lib/billing/stripe-rest";
import { PLATFORM_PLAN_OPTIONS, type PlatformPlan } from "@/lib/platform-admin/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type StripeEvent = { id: string; type: string; livemode: boolean; created: number; data: { object: Record<string, unknown> } };

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

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !secret || !(await verifyStripeSignature(payload, signature, secret))) return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });

  let event: StripeEvent;
  try { event = JSON.parse(payload) as StripeEvent; } catch { return NextResponse.json({ error: "Invalid Stripe payload." }, { status: 400 }); }
  const admin = createAdminClient();
  const received = await admin.from("bos_billing_webhook_events").insert({ stripe_event_id: event.id, event_type: event.type, livemode: event.livemode, event_created_at: timestamp(event.created) });
  if (received.error?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (received.error) return NextResponse.json({ error: received.error.message }, { status: 500 });

  const object = event.data.object;
  let companyId = text(metadata(object).company_id) || text(object.client_reference_id);
  try {
    if (event.type === "checkout.session.completed") {
      const subscriptionId = stripeId(object.subscription);
      const customerId = stripeId(object.customer);
      if (!companyId) throw new Error("Checkout session is missing its company reference.");
      const { error } = await admin.from("bos_tenant_accounts").update({ stripe_customer_id: customerId, billing_customer_ref: customerId, stripe_subscription_id: subscriptionId, subscription_ref: subscriptionId, last_webhook_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("company_id", companyId);
      if (error) throw error;
    } else if (event.type.startsWith("customer.subscription.")) {
      const customerId = stripeId(object.customer);
      if (!companyId && customerId) {
        const result = await admin.from("bos_tenant_accounts").select("company_id").eq("stripe_customer_id", customerId).maybeSingle();
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
      const update = {
        stripe_customer_id: customerId, billing_customer_ref: customerId,
        stripe_subscription_id: object.id as string, subscription_ref: object.id as string,
        stripe_product_id: productId, stripe_price_id: priceId,
        billing_interval: resolved?.interval || text(metadata(object).billing_interval), subscription_status: status,
        lifecycle_status: lifecycle(status), current_period_end: subscriptionPeriodEnd(object),
        cancel_at_period_end: object.cancel_at_period_end === true,
        ...(plan ? { plan_key: plan.key, seat_limit: plan.seatLimit, orion_text_allowance: plan.orionTextAllowance, orion_voice_minutes: plan.orionVoiceMinutes, support_tier: plan.supportTier } : {}),
        last_webhook_event_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      const { error } = await admin.from("bos_tenant_accounts").update(update).eq("company_id", companyId);
      if (error) throw error;
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const customerId = stripeId(object.customer);
      if (!companyId && customerId) {
        const result = await admin.from("bos_tenant_accounts").select("company_id").eq("stripe_customer_id", customerId).maybeSingle();
        companyId = result.data?.company_id || null;
      }
      if (!companyId) throw new Error("Invoice event could not be matched to a B.O.S. company.");
      const paid = event.type === "invoice.paid";
      const { error } = await admin.from("bos_tenant_accounts").update({ payment_method_status: paid ? "current" : "action_required", ...(paid ? { last_payment_at: timestamp(object.status_transitions && typeof object.status_transitions === "object" ? (object.status_transitions as Record<string, unknown>).paid_at : event.created) } : { lifecycle_status: "past_due" }), last_webhook_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("company_id", companyId);
      if (error) throw error;
    }
    await admin.from("bos_billing_webhook_events").update({ company_id: companyId, processing_status: companyId ? "processed" : "ignored", processed_at: new Date().toISOString() }).eq("stripe_event_id", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    await admin.from("bos_billing_webhook_events").update({ company_id: companyId, processing_status: "failed", error_message: message.slice(0, 1000), processed_at: new Date().toISOString() }).eq("stripe_event_id", event.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

