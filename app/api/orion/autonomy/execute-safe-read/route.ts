import { NextRequest, NextResponse } from "next/server";
import { executeOrionSafeReadPrefix } from "@/lib/orion/autonomy/safe-read-executor";
import type { OrionAutonomyPlanRequestStep } from "@/lib/orion/autonomy/plan-request";
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

    const body = await req.json() as { steps?: unknown; executionId?: unknown };
    if (!Array.isArray(body.steps)) {
      return NextResponse.json({ ok: false, error: "A BOS step list is required." }, { status: 400 });
    }

    const executionId = typeof body.executionId === "string" && body.executionId.trim()
      ? body.executionId.trim()
      : undefined;

    const result = await executeOrionSafeReadPrefix({
      steps: body.steps as OrionAutonomyPlanRequestStep[],
      supabase,
      companyId: workspace.context.companyId,
      userId: workspace.context.userId,
      role: workspace.context.role,
      executionId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Orion safe-read sequence failed." },
      { status: 500 },
    );
  }
}
