import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { loadEstimateCompliance, saveEstimateCompliance, type EstimateComplianceProfile } from "@/lib/compliance/estimate-contract-compliance-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  try {
    const result = await loadEstimateCompliance(supabase, workspace.context.companyId, estimateId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load compliance details." }, { status: 400 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  let profile: EstimateComplianceProfile;
  try {
    profile = (await request.json()) as EstimateComplianceProfile;
  } catch {
    return NextResponse.json({ error: "Invalid compliance payload." }, { status: 400 });
  }

  try {
    const result = await saveEstimateCompliance(supabase, workspace.context.companyId, estimateId, workspace.context.userId, profile);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save compliance details." }, { status: 400 });
  }
}
