import { NextRequest, NextResponse } from "next/server";
import {
  isOrionOpenAIEnabled,
  resolveBosActionFromIntelligenceRoute,
  resolveOrionWithOpenAI,
} from "@/lib/orion/intelligence";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!isOrionOpenAIEnabled()) {
      return NextResponse.json({
        ok: false,
        error: "Orion general intelligence is not configured yet.",
        statusCategory: "intelligence_unavailable",
      }, { status: 503 });
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is unavailable." }, { status: 503 });
    }

    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json({
        ok: false,
        error: workspace.errorMessage || "Workspace context is unavailable.",
        statusCategory: workspace.errorCode === "unauthenticated" ? "authentication_required" : "permission_denied",
      }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
    }

    const body = await req.json() as {
      input?: unknown;
      context?: {
        pathname?: unknown;
        projectId?: unknown;
        customerId?: unknown;
        estimateId?: unknown;
        invoiceId?: unknown;
      };
      tier?: unknown;
    };

    if (typeof body.input !== "string" || !body.input.trim()) {
      return NextResponse.json({ ok: false, error: "input is required." }, { status: 400 });
    }

    const stringOrNull = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
    const tier = body.tier === "fast" || body.tier === "deep" ? body.tier : "balanced";

    const result = await resolveOrionWithOpenAI({
      input: body.input.trim(),
      tier,
      context: {
        pathname: stringOrNull(body.context?.pathname) || "/dashboard",
        companyId: workspace.context.companyId,
        userId: workspace.context.userId,
        projectId: stringOrNull(body.context?.projectId),
        customerId: stringOrNull(body.context?.customerId),
        estimateId: stringOrNull(body.context?.estimateId),
        invoiceId: stringOrNull(body.context?.invoiceId),
      },
    });

    if (!result.handled || !result.route) {
      return NextResponse.json({
        ok: false,
        error: "Orion could not resolve that request.",
        statusCategory: "intelligence_no_match",
      }, { status: 422 });
    }

    if (result.route.kind === "bos_command") {
      const action = resolveBosActionFromIntelligenceRoute(result.route);
      if (!action) {
        return NextResponse.json({
          ok: false,
          error: "Orion selected a BOS action that is not currently executable.",
          statusCategory: "command_validation_failed",
        }, { status: 422 });
      }

      return NextResponse.json({
        ok: true,
        kind: "bos_command",
        command: action,
        responseId: result.responseId,
        model: result.model,
      });
    }

    return NextResponse.json({
      ok: true,
      kind: result.route.kind,
      route: result.route,
      responseId: result.responseId,
      model: result.model,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Orion intelligence request failed.",
      statusCategory: "intelligence_error",
    }, { status: 500 });
  }
}
