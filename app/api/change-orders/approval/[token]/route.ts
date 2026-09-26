import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashChangeOrderApprovalToken } from "@/lib/change-orders/customer-approval";

async function loadApprovalContext(token: string) {
  const admin = createAdminClient();
  const tokenHash = hashChangeOrderApprovalToken(token);
  const { data: tokenRow, error: tokenError } = await admin
    .from("change_order_customer_tokens" as never)
    .select("id,company_id,change_order_id,expires_at,used_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle() as {
      data: { id: string; company_id: string; change_order_id: string; expires_at: string; used_at: string | null; revoked_at: string | null } | null;
      error: { message?: string } | null;
    };

  if (tokenError || !tokenRow) throw new Error("This approval link is invalid.");
  if (tokenRow.revoked_at) throw new Error("This approval link has been revoked.");
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) throw new Error("This approval link has expired.");

  return { admin, tokenRow };
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const { admin, tokenRow } = await loadApprovalContext(token);
    const [{ data: changeOrder, error: changeOrderError }, { data: lineItems, error: itemsError }, { data: company, error: companyError }, { data: priorDecision }] = await Promise.all([
      admin
        .from("change_orders")
        .select("id,change_order_number,title,description,reason,status,total_amount,subtotal,tax_amount,schedule_impact_days,requested_date,effective_date,customer_id,project_id,customers(first_name,last_name,email),projects(name,project_number)")
        .eq("company_id", tokenRow.company_id)
        .eq("id", tokenRow.change_order_id)
        .single(),
      admin
        .from("change_order_line_items")
        .select("id,description,quantity,unit,unit_price,price_amount,sort_order")
        .eq("company_id", tokenRow.company_id)
        .eq("change_order_id", tokenRow.change_order_id)
        .order("sort_order"),
      admin
        .from("companies")
        .select("name,display_name,legal_name")
        .eq("id", tokenRow.company_id)
        .single(),
      admin
        .from("change_order_customer_approvals" as never)
        .select("decision,typed_name,created_at")
        .eq("token_id", tokenRow.id)
        .maybeSingle() as Promise<{ data: { decision: string; typed_name: string; created_at: string } | null; error: unknown }>,
    ]);

    if (changeOrderError || !changeOrder) throw new Error("Change order not found.");
    if (itemsError) throw new Error(itemsError.message || "Unable to load change-order items.");
    if (companyError || !company) throw new Error("Company information is unavailable.");

    const customer = Array.isArray(changeOrder.customers) ? changeOrder.customers[0] : changeOrder.customers;
    const project = Array.isArray(changeOrder.projects) ? changeOrder.projects[0] : changeOrder.projects;

    return NextResponse.json({
      company: { name: company.display_name || company.legal_name || company.name },
      changeOrder: {
        ...changeOrder,
        customers: undefined,
        projects: undefined,
        customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer",
        customerEmail: customer?.email || null,
        projectName: project?.name || "Project",
        projectNumber: project?.project_number || null,
      },
      items: lineItems || [],
      expiresAt: tokenRow.expires_at,
      decision: priorDecision || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open change order." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const body = await request.json() as { decision?: "approved" | "rejected"; typedName?: string; consentAccepted?: boolean };
    if (!["approved", "rejected"].includes(body.decision || "")) return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
    if (!body.typedName?.trim()) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    if (body.consentAccepted !== true) return NextResponse.json({ error: "Consent is required to record your decision." }, { status: 400 });

    const { admin, tokenRow } = await loadApprovalContext(token);

    const { data: existing } = await admin
      .from("change_order_customer_approvals" as never)
      .select("decision,typed_name,created_at")
      .eq("token_id", tokenRow.id)
      .maybeSingle() as { data: { decision: string; typed_name: string; created_at: string } | null };

    if (existing) return NextResponse.json({ decision: existing.decision, alreadyRecorded: true });

    const decidedAt = new Date().toISOString();
    const { error: approvalError } = await admin
      .from("change_order_customer_approvals" as never)
      .insert({
        company_id: tokenRow.company_id,
        change_order_id: tokenRow.change_order_id,
        token_id: tokenRow.id,
        decision: body.decision,
        typed_name: body.typedName.trim(),
        consent_accepted: true,
        ip_address: request.headers.get("x-forwarded-for"),
        user_agent: request.headers.get("user-agent"),
      } as never);

    if (approvalError) throw new Error(approvalError.message || "Unable to record customer decision.");

    const approved = body.decision === "approved";
    const { error: updateError } = await admin
      .from("change_orders")
      .update(approved
        ? { status: "approved", approved_at: decidedAt, approved_by: null, rejected_at: null, rejected_by: null }
        : { status: "rejected", rejected_at: decidedAt, rejected_by: null, approved_at: null, approved_by: null })
      .eq("company_id", tokenRow.company_id)
      .eq("id", tokenRow.change_order_id);

    if (updateError) throw new Error(updateError.message || "Unable to update change-order status.");

    await admin
      .from("change_order_customer_tokens" as never)
      .update({ used_at: decidedAt } as never)
      .eq("id", tokenRow.id);

    await admin.from("change_order_activity").insert({
      company_id: tokenRow.company_id,
      change_order_id: tokenRow.change_order_id,
      activity_type: approved ? "approved" : "rejected",
      description: approved
        ? `Customer approved the change order as ${body.typedName.trim()}.`
        : `Customer rejected the change order as ${body.typedName.trim()}.`,
      metadata: { customer_decision: body.decision, typed_name: body.typedName.trim(), token_id: tokenRow.id },
      created_by: null,
    });

    return NextResponse.json({ decision: body.decision, recordedAt: decidedAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record customer decision." }, { status: 400 });
  }
}
