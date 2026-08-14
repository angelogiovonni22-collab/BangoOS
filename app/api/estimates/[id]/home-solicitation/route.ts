import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { loadHomeSolicitationCompliance, saveHomeSolicitationCompliance, type HomeSolicitationProfile } from "@/lib/compliance/home-solicitation-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  try {
    return NextResponse.json(await loadHomeSolicitationCompliance(supabase, workspace.context.companyId, estimateId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load home-solicitation compliance." }, { status: 400 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  let profile: HomeSolicitationProfile;
  try {
    profile = (await request.json()) as HomeSolicitationProfile;
  } catch {
    return NextResponse.json({ error: "Invalid home-solicitation payload." }, { status: 400 });
  }

  try {
    return NextResponse.json(await saveHomeSolicitationCompliance(supabase, workspace.context.companyId, estimateId, workspace.context.userId, profile));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save home-solicitation compliance." }, { status: 400 });
  }
}
