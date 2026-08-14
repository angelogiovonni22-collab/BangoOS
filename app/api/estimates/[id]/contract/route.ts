import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";
import { estimateContractPublicUrl, sendContractEmail } from "@/lib/estimates/contract-email";
import { renderBrandedEstimateEmail } from "@/lib/estimates/branded-estimate-email";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "BOS database is unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("id, title, estimate_number, customer_id, status, total_amount, customers(email, first_name, last_name)")
    .eq("company_id", workspace.context.companyId).eq("id", estimateId).maybeSingle();
  if (error || !estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  const customer = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
  if (!customer?.email) return NextResponse.json({ error: "The linked customer needs an email address before sending a contract." }, { status: 400 });

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("name, display_name, legal_name, logo_url")
    .eq("id", workspace.context.companyId)
    .single();
  if (companyError || !company) {
    return NextResponse.json({ error: "Company email branding is unavailable." }, { status: 500 });
  }
  const companyName = company.display_name || company.legal_name || company.name;

  const result = await createEstimateWorkflowService(supabase).generatePublicToken({
    companyId: workspace.context.companyId, estimateId, actorProfileId: workspace.context.userId, ttlHours: 24 * 14,
    metadata: { purpose: "contract_signature" },
  });
  const url = estimateContractPublicUrl(result.token);
  const termsUrl = new URL("/legal/electronic-signature-and-platform-terms", url).toString();
  const delivery = await sendContractEmail({
    to: customer.email.trim(),
    subject: `${companyName} | ${estimate.estimate_number || "Estimate"} ready for review`,
    html: renderBrandedEstimateEmail({
      companyName,
      companyLogoUrl: company.logo_url,
      customerFirstName: customer.first_name,
      estimateTitle: estimate.title,
      estimateNumber: estimate.estimate_number,
      totalAmount: Number(estimate.total_amount || 0),
      reviewUrl: url,
      termsUrl,
      expiresAt: result.expiresAt,
    }),
    idempotencyKey: `estimate-contract/${workspace.context.companyId}/${estimateId}/${result.token.slice(0, 16)}`,
  });
  if (!delivery.delivered) {
    const configurationErrors: Record<string, string> = {
      resend_api_key_missing: "RESEND_API_KEY is missing from this deployment.",
      contract_email_sender_missing: "BOS_CONTRACT_EMAIL_FROM is missing from this deployment.",
    };
    return NextResponse.json({ error: configurationErrors[delivery.reason || ""] || `Email provider rejected the message: ${delivery.reason || "unknown error"}`, url, expiresAt: result.expiresAt, delivery }, { status: 503 });
  }
  const { error: updateError } = await supabase.from("estimates").update({ status: "sent", updated_by: workspace.context.userId }).eq("company_id", workspace.context.companyId).eq("id", estimateId);
  if (updateError) return NextResponse.json({ error: "Email was accepted, but BOS could not update the estimate status. Do not resend.", url, expiresAt: result.expiresAt, delivery }, { status: 500 });
  return NextResponse.json({ url, expiresAt: result.expiresAt, delivery });
}
