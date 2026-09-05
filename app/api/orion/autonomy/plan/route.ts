import { NextRequest, NextResponse } from "next/server";
import { buildOrionAutonomyPlanFromToolSteps } from "@/lib/orion/autonomy/plan-request";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "BOS workspace is unavailable." }, { status: 503 });
    }

    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json(
        { ok: false, error: workspace.errorMessage || "BOS workspace is unavailable." },
        { status: workspace.errorCode === "unauthenticated" ? 401 : 403 },
      );
    }

    const body = await req.json() as { steps?: unknown };
    const result = buildOrionAutonomyPlanFromToolSteps(body.steps);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      companyId: workspace.context.companyId,
      plan: result.plan,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Orion autonomy planning failed." },
      { status: 500 },
    );
  }
}
