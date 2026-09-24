import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { requireCompanyRole } from "@/lib/supabase/authorization";
import { estimateContractPublicUrl } from "@/lib/estimates/contract-email";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
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
    return NextResponse.json({ error: "You do not have permission to preview customer estimates." }, { status: 403 });
  }

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("id,status,version_number")
    .eq("company_id", workspace.context.companyId)
    .eq("id", estimateId)
    .maybeSingle();

  if (error || !estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  if (estimate.status === "archived" || estimate.status === "void") {
    return NextResponse.json({ error: "Archived or void estimates cannot be previewed as active customer documents." }, { status: 409 });
  }

  const rawToken = `${randomBytes(24).toString("hex")}.${randomBytes(24).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("estimate_public_tokens").insert({
    company_id: workspace.context.companyId,
    estimate_id: estimateId,
    token_hash: sha256(rawToken),
    expires_at: expiresAt,
    issued_by: workspace.context.userId,
    metadata: {
      purpose: "customer_preview",
      estimate_status: estimate.status,
      estimate_version: estimate.version_number,
    },
  });

  if (insertError) return NextResponse.json({ error: insertError.message || "Unable to create customer preview." }, { status: 500 });

  return NextResponse.json({
    url: estimateContractPublicUrl(rawToken),
    expiresAt,
    preview: true,
  });
}
