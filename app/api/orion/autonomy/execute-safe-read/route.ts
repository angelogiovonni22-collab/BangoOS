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

    const sequenceStartedAt = Date.now();
    const result = await executeOrionSafeReadPrefix({
      steps: body.steps as OrionAutonomyPlanRequestStep[],
      supabase,
      companyId: workspace.context.companyId,
      userId: workspace.context.userId,
      role: workspace.context.role,
      executionId,
    });

    const durationMs = Math.max(0, Date.now() - sequenceStartedAt);
    const retries = result.executed.reduce((total, step) => total + Math.max(0, step.attempts - 1), 0);
    const slowestStepMs = result.executed.reduce((max, step) => Math.max(max, step.durationMs), 0);
    const response = NextResponse.json({
      ...result,
      telemetry: {
        durationMs,
        executedSteps: result.executed.length,
        retries,
        slowestStepMs,
      },
    }, { status: result.ok ? 200 : 400 });
    response.headers.set("Server-Timing", `orion-safe-read;dur=${durationMs}`);
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Orion safe-read sequence failed." },
      { status: 500 },
    );
  }
}
