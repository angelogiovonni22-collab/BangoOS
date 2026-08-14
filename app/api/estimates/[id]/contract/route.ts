import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";
import { estimateContractPublicUrl, sendContractEmail } from "@/lib/estimates/contract-email";
import { renderBrandedEstimateEmail } from "@/lib/estimates/branded-estimate-email";
import { loadEstimateCompliance, recordEstimateComplianceEvaluation } from "@/lib/compliance/estimate-contract-compliance-service";
import { loadHomeSolicitationCompliance, recordHomeSolicitationEvaluation } from "@/lib/compliance/home-solicitation-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("id, title, estimate_number, customer_id, status, total_amount, customers(email, first_name, last_name, customer_type, state)")
    .eq("company_id", workspace.context.companyId).eq("id", estimateId).maybeSingle();
  if (error || !estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  const customer = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
  if (!customer?.email) return NextResponse.json({ error: "The linked customer needs an email address before sending a contract." }, { status: 400 });

  // Server-side compliance authorization happens before a public token is minted or an email is sent.
  // The same endpoint is used by the UI and automation, so there is no Orion bypass.
  if (Number(estimate.total_amount || 0) >= 25_000) {
    try {
      const compliance = await loadEstimateCompliance(supabase, workspace.context.companyId, estimateId);
      await recordEstimateComplianceEvaluation(
        supabase,
        workspace.context.companyId,
        estimateId,
        workspace.context.userId,
        compliance.evaluation,
        compliance.profile.id || null,
        { source: "send_gate" },
      );
      if (compliance.evaluation.status !== "COMPLIANT") {
        return NextResponse.json({
          error: "Contract compliance requires attention before this agreement can be sent.",
          code: "CONTRACT_COMPLIANCE_BLOCKED",
          compliance: compliance.evaluation,
        }, { status: 409 });
      }
    } catch (complianceError) {
      return NextResponse.json({
        error: complianceError instanceof Error ? complianceError.message : "Unable to verify contract compliance.",
        code: "CONTRACT_COMPLIANCE_UNAVAILABLE",
      }, { status: 409 });
    }
  }

  const isOhioResidentialCustomer = customer.customer_type === "residential" && ["OH", "OHIO"].includes((customer.state || "").trim().toUpperCase());
  if (isOhioResidentialCustomer) {
    try {
      const homeSolicitation = await loadHomeSolicitationCompliance(supabase, workspace.context.companyId, estimateId);
      await recordHomeSolicitationEvaluation(
        supabase,
        workspace.context.companyId,
        estimateId,
        workspace.context.userId,
        homeSolicitation.evaluation,
        { source: "send_gate" },
      );
      if (homeSolicitation.evaluation.status !== "COMPLIANT") {
        return NextResponse.json({
          error: "Home-solicitation review requires attention before this agreement can be sent.",
          code: "HOME_SOLICITATION_COMPLIANCE_BLOCKED",
          compliance: homeSolicitation.evaluation,
        }, { status: 409 });
      }
    } catch (complianceError) {
      return NextResponse.json({
        error: complianceError instanceof Error ? complianceError.message : "Unable to verify home-solicitation compliance.",
        code: "HOME_SOLICITATION_COMPLIANCE_UNAVAILABLE",
      }, { status: 409 });
    }
  }

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
  if (updateError) return NextResponse.json({ error: "Email was accepted, but B.O.S. could not update the estimate status. Do not resend.", url, expiresAt: result.expiresAt, delivery }, { status: 500 });
  return NextResponse.json({ url, expiresAt: result.expiresAt, delivery });
}
