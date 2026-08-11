import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";
import { sendContractEmail } from "@/lib/estimates/contract-email";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "BOS database is unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("id, title, estimate_number, customer_id, status, customers(email, first_name, last_name)")
    .eq("company_id", workspace.context.companyId).eq("id", estimateId).maybeSingle();
  if (error || !estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  const customer = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
  if (!customer?.email) return NextResponse.json({ error: "The linked customer needs an email address before sending a contract." }, { status: 400 });

  const result = await createEstimateWorkflowService(supabase).generatePublicToken({
    companyId: workspace.context.companyId, estimateId, actorProfileId: workspace.context.userId, ttlHours: 24 * 14,
    metadata: { purpose: "contract_signature" },
  });
  const url = new URL(`/contracts/estimate/${encodeURIComponent(result.token)}`, request.url).toString();
  const delivery = await sendContractEmail({
    to: customer.email,
    subject: `Review and sign ${estimate.estimate_number || "your estimate"}`,
    html: `<p>Hello ${customer.first_name || "there"},</p><p>Your contract for <strong>${estimate.title}</strong> is ready to review and sign.</p><p><a href="${url}">Open and sign contract</a></p><p>This secure link expires ${new Date(result.expiresAt).toLocaleString()}.</p>`,
  });
  await supabase.from("estimates").update({ status: "sent", updated_by: workspace.context.userId }).eq("company_id", workspace.context.companyId).eq("id", estimateId);
  return NextResponse.json({ url, expiresAt: result.expiresAt, delivery });
}
