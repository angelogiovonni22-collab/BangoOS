import { NextRequest, NextResponse } from "next/server";
import { requireBillingAdministrator } from "@/lib/billing/authorization";
import { stripePost, type StripeObject } from "@/lib/billing/stripe-rest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PortalSession = StripeObject & { url?: string | null };

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "B.O.S. is unavailable." }, { status: 503 });
    const workspace = await requireBillingAdministrator(supabase);
    const admin = createAdminClient();
    const { data: account, error } = await admin.from("bos_tenant_accounts").select("stripe_customer_id").eq("company_id", workspace.companyId).single();
    if (error) throw error;
    if (!account?.stripe_customer_id) return NextResponse.json({ error: "No Stripe billing profile exists for this company yet." }, { status: 404 });
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
    const session = await stripePost<PortalSession>("/billing_portal/sessions", { customer: account.stripe_customer_id, return_url: `${origin}/settings/billing` });
    if (!session.url) throw new Error("Stripe did not return a billing portal URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open the billing portal.";
    const status = message.includes("Only a company") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

