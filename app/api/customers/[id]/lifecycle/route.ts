import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { hasBosPermission } from "@/lib/access-control/permissions";

async function getContext(id: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");

  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
  if (!hasBosPermission(workspace.context.role, "customers.manage")) {
    throw new Error("Customer management access denied.");
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id,status")
    .eq("company_id", workspace.context.companyId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load customer.");
  if (!customer) throw new Error("Customer not found.");

  return { supabase, workspace: workspace.context, customer };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as { action?: "archive" | "restore" };
    if (body.action !== "archive" && body.action !== "restore") {
      return NextResponse.json({ error: "Invalid customer lifecycle action." }, { status: 400 });
    }

    const { supabase, workspace } = await getContext(id);
    const nextStatus = body.action === "archive" ? "archived" : "active";
    const { error } = await supabase
      .from("customers")
      .update({ status: nextStatus })
      .eq("company_id", workspace.companyId)
      .eq("id", id);

    if (error) throw new Error(error.message || `Unable to ${body.action} customer.`);
    return NextResponse.json({ updated: true, status: nextStatus });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update customer." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, workspace } = await getContext(id);

    const linkedChecks = await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("company_id", workspace.companyId).eq("customer_id", id),
      supabase.from("estimates").select("id", { count: "exact", head: true }).eq("company_id", workspace.companyId).eq("customer_id", id),
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("company_id", workspace.companyId).eq("customer_id", id),
    ]);

    const labels = ["projects", "estimates", "invoices"];
    const blockers = linkedChecks
      .map((result, index) => ({ label: labels[index], count: result.count || 0, error: result.error }))
      .filter((item) => item.count > 0);

    const checkError = linkedChecks.find((result) => result.error)?.error;
    if (checkError) throw new Error(checkError.message || "Unable to verify customer history.");

    if (blockers.length) {
      return NextResponse.json({
        error: `This customer has linked ${blockers.map((item) => item.label).join(", ")} and cannot be permanently deleted. Archive the customer instead.`,
        blocked: true,
        blockers,
      }, { status: 409 });
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("company_id", workspace.companyId)
      .eq("id", id);

    if (error) {
      return NextResponse.json({
        error: "This customer still has linked business history and cannot be permanently deleted. Archive the customer instead.",
        blocked: true,
      }, { status: 409 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete customer." }, { status: 400 });
  }
}
