import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { loadHomeSolicitationCompliance, recordHomeSolicitationOralDisclosure, recordHomeSolicitationSellerSignature, saveHomeSolicitationCompliance, type HomeSolicitationProfile } from "@/lib/compliance/home-solicitation-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });
  try { return NextResponse.json(await loadHomeSolicitationCompliance(supabase, workspace.context.companyId, estimateId)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load home-solicitation compliance." }, { status: 400 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });
  let profile: HomeSolicitationProfile;
  try { profile = (await request.json()) as HomeSolicitationProfile; }
  catch { return NextResponse.json({ error: "Invalid home-solicitation payload." }, { status: 400 }); }
  try { return NextResponse.json(await saveHomeSolicitationCompliance(supabase, workspace.context.companyId, estimateId, workspace.context.userId, profile)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save home-solicitation compliance." }, { status: 400 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: estimateId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json() as { action?: string; signerName?: string; consentAccepted?: boolean };
    if (body.action === "seller_signature") {
      if (body.consentAccepted !== true) return NextResponse.json({ error: "Explicit seller-signature consent is required." }, { status: 400 });
      return NextResponse.json(await recordHomeSolicitationSellerSignature(supabase, workspace.context.companyId, estimateId, workspace.context.userId, body.signerName?.trim() || ""));
    }
    if (body.action === "oral_disclosure") {
      if (body.consentAccepted !== true) return NextResponse.json({ error: "Confirm that the cancellation right was explained orally to the buyer during the assisted signing session." }, { status: 400 });
      return NextResponse.json(await recordHomeSolicitationOralDisclosure(supabase, workspace.context.companyId, estimateId, workspace.context.userId));
    }
    return NextResponse.json({ error: "Unsupported home-solicitation action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record home-solicitation action." }, { status: 400 });
  }
}
