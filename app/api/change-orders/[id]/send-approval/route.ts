import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { requireCompanyRole } from "@/lib/supabase/authorization";
import { sendContractEmail } from "@/lib/estimates/contract-email";
import {
  changeOrderApprovalPublicUrl,
  createChangeOrderApprovalToken,
  renderChangeOrderApprovalEmail,
} from "@/lib/change-orders/customer-approval";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: changeOrderId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  try {
    await requireCompanyRole(
      supabase,
      ["owner", "administrator", "operations_manager", "project_manager", "estimator", "office_manager"],
      workspace.context.companyId,
    );
  } catch {
    return NextResponse.json({ error: "You do not have permission to send change orders to customers." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: changeOrder, error: changeOrderError } = await admin
    .from("change_orders")
    .select("id,company_id,customer_id,project_id,change_order_number,title,status,total_amount,customers(email,first_name,last_name)")
    .eq("company_id", workspace.context.companyId)
    .eq("id", changeOrderId)
    .maybeSingle();

  if (changeOrderError || !changeOrder) return NextResponse.json({ error: "Change order not found." }, { status: 404 });
  if (["void", "invoiced"].includes(changeOrder.status)) return NextResponse.json({ error: "Void or invoiced change orders cannot be sent for customer approval." }, { status: 409 });

  const customer = Array.isArray(changeOrder.customers) ? changeOrder.customers[0] : changeOrder.customers;
  if (!customer?.email?.trim()) return NextResponse.json({ error: "Add the customer's email address before sending this change order." }, { status: 400 });

  const { data: lineItems, error: lineItemsError } = await admin
    .from("change_order_line_items")
    .select("id,description,quantity,unit_price,price_amount")
    .eq("company_id", workspace.context.companyId)
    .eq("change_order_id", changeOrderId)
    .order("sort_order");

  if (lineItemsError) return NextResponse.json({ error: lineItemsError.message }, { status: 500 });
  if (!lineItems?.length) return NextResponse.json({ error: "Add at least one line item before sending this change order." }, { status: 400 });

  const customerTotal = Number(changeOrder.total_amount || 0);
  if (customerTotal <= 0) {
    return NextResponse.json({ error: "Customer total is $0.00. Enter a Customer Price for the line items before sending for approval." }, { status: 400 });
  }

  const hasZeroPricedWork = lineItems.some((item) => Number(item.quantity || 0) > 0 && Number(item.unit_price || 0) <= 0);
  if (hasZeroPricedWork) {
    return NextResponse.json({ error: "One or more line items has a $0 Customer Price. Set the customer-facing price before sending." }, { status: 400 });
  }

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("name,display_name,legal_name")
    .eq("id", workspace.context.companyId)
    .single();
  if (companyError || !company) return NextResponse.json({ error: "Company email branding is unavailable." }, { status: 500 });

  const companyName = company.display_name || company.legal_name || company.name;
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { token, tokenHash } = createChangeOrderApprovalToken();

  const { data: tokenRow, error: tokenError } = await admin
    .from("change_order_customer_tokens" as never)
    .insert({
      company_id: workspace.context.companyId,
      change_order_id: changeOrderId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      issued_by: workspace.context.userId,
    } as never)
    .select("id")
    .single() as { data: { id: string } | null; error: { message?: string } | null };

  if (tokenError || !tokenRow?.id) return NextResponse.json({ error: tokenError?.message || "Unable to create a secure approval link." }, { status: 500 });

  const url = changeOrderApprovalPublicUrl(token);
  const delivery = await sendContractEmail({
    to: customer.email.trim(),
    subject: `${companyName} | ${changeOrder.change_order_number} ready for approval`,
    html: renderChangeOrderApprovalEmail({
      companyName,
      customerFirstName: customer.first_name,
      changeOrderNumber: changeOrder.change_order_number,
      title: changeOrder.title,
      totalAmount: customerTotal,
      reviewUrl: url,
      expiresAt,
    }),
    idempotencyKey: `change-order/${workspace.context.companyId}/${changeOrderId}/token-${tokenRow.id}`,
  });

  if (!delivery.delivered) {
    return NextResponse.json({
      error: delivery.reason === "resend_api_key_missing"
        ? "RESEND_API_KEY is missing from this deployment."
        : delivery.reason === "contract_email_sender_missing"
          ? "BOS_CONTRACT_EMAIL_FROM is missing from this deployment."
          : `Email provider rejected the message: ${delivery.reason || "unknown error"}`,
      url,
    }, { status: 503 });
  }

  const submittedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("change_orders")
    .update({
      status: "pending_approval",
      submitted_at: submittedAt,
      approved_at: null,
      approved_by: null,
      rejected_at: null,
      rejected_by: null,
      updated_by: workspace.context.userId,
    })
    .eq("company_id", workspace.context.companyId)
    .eq("id", changeOrderId);

  if (updateError) return NextResponse.json({ error: "Email was sent, but B.O.S. could not update the change-order status.", url }, { status: 500 });

  await admin.from("change_order_activity").insert({
    company_id: workspace.context.companyId,
    change_order_id: changeOrderId,
    activity_type: "submitted",
    description: `Change order sent to ${customer.email.trim()} for customer approval.`,
    metadata: { approval_token_id: tokenRow.id, expires_at: expiresAt, delivery_provider_id: delivery.providerId },
    created_by: workspace.context.userId,
  });

  return NextResponse.json({ sent: true, url, expiresAt, delivery });
}
