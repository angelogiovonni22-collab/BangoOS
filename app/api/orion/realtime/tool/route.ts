import { NextRequest, NextResponse } from "next/server";
import { createOrionCommandRouter, type OrionCommandPermission } from "@/lib/orion/commands";
import { getUniversalBosCommandByToolName } from "@/lib/orion/intelligence";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

function normalizeRole(role: string | null): OrionCommandPermission {
  const normalized = (role || "employee").trim().toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin" || normalized === "administrator") return "administrator";
  if (normalized === "operations_manager") return "operations_manager";
  if (normalized === "accountant") return "accountant";
  if (normalized === "project_manager") return "project_manager";
  if (normalized === "superintendent") return "superintendent";
  return "employee";
}

function requestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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

    const body = await req.json() as { toolName?: unknown; params?: unknown; confirmed?: unknown };
    if (typeof body.toolName !== "string" || !body.toolName.trim()) {
      return NextResponse.json({ ok: false, statusCategory: "command_validation_failed", userMessage: "Realtime BOS tool name is required." }, { status: 400 });
    }

    const command = getUniversalBosCommandByToolName(body.toolName.trim());
    if (!command || command.coverage.status === "unsupported") {
      return NextResponse.json({ ok: false, statusCategory: "command_validation_failed", userMessage: "That BOS action is not available." }, { status: 400 });
    }

    const params = body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? body.params as Record<string, unknown>
      : {};
    const validation = command.validate(params);
    if (!validation.ok) {
      return NextResponse.json({
        ok: false,
        commandId: command.id,
        statusCategory: "command_validation_failed",
        userMessage: validation.errors.join(" ") || "That BOS action needs more information.",
      }, { status: 400 });
    }

    if (command.confirmationLevel === "REQUIRED" && body.confirmed !== true) {
      return NextResponse.json({
        ok: false,
        commandId: command.id,
        statusCategory: "confirmation_required",
        confirmationRequired: true,
        userMessage: `Please confirm before I ${command.description.toLowerCase()}`,
      }, { status: 409 });
    }

    const correlationId = requestId("orion-realtime");
    const idempotencyKey = `${command.id}:${JSON.stringify(validation.normalizedParams)}:${correlationId}`;
    const router = createOrionCommandRouter({ supabase });
    const result = await router.executeCommand({
      commandId: command.id,
      params: validation.normalizedParams,
      confirmation: command.confirmationLevel === "REQUIRED"
        ? { confirmed: true, summary: `Confirmed in Orion Realtime conversation for ${command.id}.` }
        : undefined,
      companyContext: { companyId: workspace.context.companyId },
      userContext: {
        actorProfileId: workspace.context.userId,
        role: normalizeRole(workspace.context.role),
      },
      executionContext: { origin: "user" },
      correlationId,
      idempotencyKey,
    });

    return NextResponse.json({
      ok: result.success,
      commandId: command.id,
      statusCategory: result.status,
      userMessage: result.userMessage,
      href: result.href,
      confirmationRequired: false,
    }, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      statusCategory: "command_execution_failed",
      userMessage: error instanceof Error ? error.message : "Realtime BOS action failed.",
    }, { status: 500 });
  }
}
