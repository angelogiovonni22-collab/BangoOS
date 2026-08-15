import { NextRequest, NextResponse } from "next/server";
import { resolveOrionEntity, type OrionResolvableEntityType } from "@/lib/orion/realtime/entity-resolution";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, statusCategory: "workspace_unavailable", userMessage: "BOS workspace is unavailable." }, { status: 503 });
    }

    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json({
        ok: false,
        statusCategory: workspace.errorCode === "unauthenticated" ? "authentication_required" : "permission_denied",
        userMessage: workspace.errorMessage || "BOS workspace is unavailable.",
      }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
    }

    const body = await req.json() as { entityType?: unknown; phrase?: unknown };
    const entityType = typeof body.entityType === "string" ? body.entityType.trim() as OrionResolvableEntityType : null;
    const phrase = typeof body.phrase === "string" ? body.phrase.trim() : "";
    if (!entityType || !["customer", "project", "estimate", "invoice"].includes(entityType) || !phrase) {
      return NextResponse.json({ ok: false, statusCategory: "command_validation_failed", userMessage: "Entity type and spoken name are required." }, { status: 400 });
    }

    const resolution = await resolveOrionEntity({
      supabase,
      companyId: workspace.context.companyId,
      entityType,
      phrase,
    });

    return NextResponse.json({
      ok: true,
      statusCategory: resolution.status,
      userMessage: resolution.resolved
        ? `Resolved ${entityType} ${resolution.resolved.label}.`
        : resolution.candidates.length
          ? `I found ${resolution.candidates.length} possible ${entityType} matches.`
          : `I couldn't find a matching ${entityType}.`,
      details: {
        entityType,
        phrase,
        resolved: resolution.resolved,
        candidates: resolution.candidates,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      statusCategory: "entity_resolution_failed",
      userMessage: error instanceof Error ? error.message : "Orion could not resolve that BOS record.",
    }, { status: 500 });
  }
}
