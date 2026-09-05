import { NextRequest, NextResponse } from "next/server";
import { executeOrionSafeReadPrefix } from "@/lib/orion/autonomy/safe-read-executor";
import type { OrionAutonomyPlanRequestStep } from "@/lib/orion/autonomy/plan-request";
import { decodeOrionSafeReadContinuation, encodeOrionSafeReadContinuation } from "@/lib/orion/autonomy/continuation-token";
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

    const body = await req.json() as { steps?: unknown; executionId?: unknown; continuationToken?: unknown };
    const rawContinuationToken = typeof body.continuationToken === "string" ? body.continuationToken.trim() : "";
    const continuation = rawContinuationToken ? decodeOrionSafeReadContinuation(rawContinuationToken) : null;
    if (rawContinuationToken && !continuation) {
      return NextResponse.json({ ok: false, error: "Orion continuation token is invalid or expired." }, { status: 400 });
    }
    if (continuation && (continuation.companyId !== workspace.context.companyId || continuation.userId !== workspace.context.userId)) {
      return NextResponse.json({ ok: false, error: "Orion continuation token does not belong to this workspace session." }, { status: 403 });
    }
    if (!continuation && !Array.isArray(body.steps)) {
      return NextResponse.json({ ok: false, error: "A BOS step list or continuation token is required." }, { status: 400 });
    }

    const steps = continuation?.steps ?? body.steps as OrionAutonomyPlanRequestStep[];
    const executionId = continuation?.executionId ?? (typeof body.executionId === "string" && body.executionId.trim()
      ? body.executionId.trim()
      : undefined);

    const sequenceStartedAt = Date.now();
    const result = await executeOrionSafeReadPrefix({
      steps,
      supabase,
      companyId: workspace.context.companyId,
      userId: workspace.context.userId,
      role: workspace.context.role,
      executionId,
      resume: continuation ? { nextZeroIndex: continuation.nextZeroIndex, outputs: continuation.outputs } : null,
    });

    const durationMs = Math.max(0, Date.now() - sequenceStartedAt);
    const retries = result.executed.reduce((total, step) => total + Math.max(0, step.attempts - 1), 0);
    const slowestStepMs = result.executed.reduce((max, step) => Math.max(max, step.durationMs), 0);
    const continuationToken = result.stopReason === "time_budget_exceeded" && result.continuation && executionId
      ? encodeOrionSafeReadContinuation({
          companyId: workspace.context.companyId,
          userId: workspace.context.userId,
          executionId,
          steps,
          outputs: result.continuation.outputs,
          nextZeroIndex: result.continuation.nextZeroIndex,
        })
      : null;
    const { continuation: _continuation, ...publicResult } = result;
    const response = NextResponse.json({
      ...publicResult,
      continuationToken,
      continuationAvailable: Boolean(continuationToken),
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
