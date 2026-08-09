import { NextRequest, NextResponse } from "next/server";
import { isOrionOpenAIEnabled, resolveOrionWithOpenAI } from "@/lib/orion/intelligence";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!isOrionOpenAIEnabled()) {
      return NextResponse.json({
        ok: false,
        statusCategory: "intelligence_unavailable",
        userMessage: "Orion web research is not configured yet.",
      }, { status: 503 });
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({
        ok: false,
        statusCategory: "workspace_unavailable",
        userMessage: "BOS workspace is unavailable.",
      }, { status: 503 });
    }

    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json({
        ok: false,
        statusCategory: workspace.errorCode === "unauthenticated" ? "authentication_required" : "permission_denied",
        userMessage: workspace.errorMessage || "BOS workspace is unavailable.",
      }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
    }

    const body = await req.json() as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({
        ok: false,
        statusCategory: "command_validation_failed",
        userMessage: "A research question is required.",
      }, { status: 400 });
    }

    const result = await resolveOrionWithOpenAI({
      input: query,
      tier: "balanced",
      context: {
        pathname: "/dashboard",
        companyId: workspace.context.companyId,
        userId: workspace.context.userId,
      },
    });

    if (!result.handled || !result.route) {
      return NextResponse.json({
        ok: false,
        statusCategory: "intelligence_no_match",
        userMessage: "I couldn't complete that research request.",
      }, { status: 422 });
    }

    if (result.route.kind === "bos_command") {
      return NextResponse.json({
        ok: false,
        statusCategory: "research_requires_bos_tool",
        userMessage: "That request is a BOS operation. Use the matching BOS tool instead.",
      }, { status: 409 });
    }

    if (result.route.kind === "clarify") {
      return NextResponse.json({
        ok: true,
        statusCategory: "clarification_required",
        userMessage: result.route.question,
        responseId: result.responseId,
        model: result.model,
      });
    }

    if (result.route.kind !== "conversation") {
      return NextResponse.json({
        ok: false,
        statusCategory: "intelligence_no_match",
        userMessage: "I couldn't complete that research request.",
      }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      statusCategory: "completed",
      userMessage: result.route.answer,
      responseId: result.responseId,
      model: result.model,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      statusCategory: "intelligence_error",
      userMessage: error instanceof Error ? error.message : "Orion research failed.",
    }, { status: 500 });
  }
}
