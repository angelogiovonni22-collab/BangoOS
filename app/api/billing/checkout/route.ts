import { NextRequest, NextResponse } from "next/server";
import { requireBillingAdministrator } from "@/lib/billing/authorization";
import { getStripePriceId, type BillingInterval } from "@/lib/billing/plans";
import { stripePost, type StripeObject } from "@/lib/billing/stripe-rest";
import { PLATFORM_PLAN_OPTIONS, type PlatformPlan } from "@/lib/platform-admin/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CheckoutSession = StripeObject & { url?: string | null };
type StripeCustomer = StripeObject;

function appOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "B.O.S. is unavailable." }, { status: 503 });
    const workspace = await requireBillingAdministrator(supabase);
    const body = await request.json() as { planKey?: PlatformPlan; interval?: BillingInterval };
    if (!body.planKey || !PLATFORM_PLAN_OPTIONS.includes(body.planKey)) return NextResponse.json({ error: "Choose a valid B.O.S. plan." }, { status: 400 });
    if (body.interval !== "month" && body.interval !== "year") return NextResponse.json({ error: "Choose monthly or annual billing." }, { status: 400 });
    if (body.planKey === "enterprise") return NextResponse.json({ error: "Enterprise plans require a B.O.S. platform review before checkout." }, { status: 400 });
    const priceId = getStripePriceId(body.planKey, body.interval);
    if (!priceId) return NextResponse.json({ error: "This Sandbox plan price has not been configured yet." }, { status: 503 });

    const admin = createAdminClient();
    const [{ data: account, error: accountError }, { data: company, error: companyError }, { data: { user } }] = await Promise.all([
      admin.from("bos_tenant_accounts").select("stripe_customer_id, stripe_subscription_id").eq("company_id", workspace.companyId).single(),
      admin.from("companies").select("name").eq("id", workspace.companyId).single(),
      supabase.auth.getUser(),
    ]);
    if (accountError || companyError || !account || !company) throw new Error(accountError?.message || companyError?.message || "Billing account not found.");
    if (account.stripe_subscription_id) return NextResponse.json({ error: "This company already has a Stripe subscription. Use Manage billing to change it." }, { status: 409 });

    let customerId = account.stripe_customer_id;
    if (!customerId) {
      const customer = await stripePost<StripeCustomer>("/customers", {
        name: company.name,
        email: user?.email,
        "metadata[company_id]": workspace.companyId,
        "metadata[source]": "bango_operating_system",
      });
      customerId = customer.id;
      const { error } = await admin.from("bos_tenant_accounts").update({ stripe_customer_id: customerId, billing_customer_ref: customerId, updated_at: new Date().toISOString() }).eq("company_id", workspace.companyId);
      if (error) throw error;
    }

    const origin = appOrigin(request);
    const session = await stripePost<CheckoutSession>("/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      success_url: `${origin}/settings/billing?checkout=success`,
      cancel_url: `${origin}/settings/billing?checkout=canceled`,
      client_reference_id: workspace.companyId,
      allow_promotion_codes: true,
      "metadata[company_id]": workspace.companyId,
      "metadata[plan_key]": body.planKey,
      "metadata[billing_interval]": body.interval,
      "subscription_data[metadata][company_id]": workspace.companyId,
      "subscription_data[metadata][plan_key]": body.planKey,
      "subscription_data[metadata][billing_interval]": body.interval,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start B.O.S. checkout.";
    const status = message.includes("Only a company") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

