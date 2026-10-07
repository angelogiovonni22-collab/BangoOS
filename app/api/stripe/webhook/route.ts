import { NextRequest, NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/billing/stripe-rest";
import { isStripeEvent, processVerifiedBillingEvent } from "@/lib/billing/webhook-processing";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !secret || !(await verifyStripeSignature(payload, signature, secret))) return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  let event: unknown;
  try { event = JSON.parse(payload); } catch { return NextResponse.json({ error: "Invalid Stripe payload." }, { status: 400 }); }
  if (!isStripeEvent(event)) return NextResponse.json({ error: "Invalid Stripe payload." }, { status: 400 });
  try {
    const result = await processVerifiedBillingEvent(event, createAdminClient());
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Billing event processing is temporarily unavailable." }, { status: 500 });
  }
}
