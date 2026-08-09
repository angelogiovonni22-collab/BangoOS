import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createOrionCommandRouter, createOrionCommandRegistry, type OrionCommandPermission } from "@/lib/orion/commands";
import { getUniversalBosCommandByToolName } from "@/lib/orion/intelligence";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const CONFIRM_TOOL_NAME = "bos_confirm_pending_action";
const CONFIRMATION_TTL_MS = 120_000;

type ConfirmationPayload = {
  commandId: string;
  params: Record<string, unknown>;
  companyId: string;
  userId: string;
  expiresAt: number;
};

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

function isExplicitConfirmation(input: string) {
  const normalized = input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return /^(confirm|confirmed|yes|yes confirm|yes do it|yes go ahead|go ahead|do it|proceed|approve|that s correct|that is correct|looks good|send it|save it)$/.test(normalized);
}

function confirmationSecret() {
  return process.env.ORION_CONFIRMATION_SECRET?.trim() || process.env.OPENAI_API_KEY?.trim() || null;
}

function encodeConfirmationToken(payload: ConfirmationPayload) {
  const secret = confirmationSecret();
  if (!secret) return null;
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function decodeConfirmationToken(token: string): ConfirmationPayload | null {
  const secret = confirmationSecret();
  if (!secret) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ConfirmationPayload;
    if (!parsed || typeof parsed !== "object" || typeof parsed.commandId !== "string") return null;
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) return null;
    if (!parsed.params || typeof parsed.params !== "object" || Array.isArray(parsed.params)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function executeCanonicalCommand(args: {
  commandId: string;
  params: Record<string, unknown>;
  confirmed: boolean;
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
  companyId: string;
  userId: string;
  role: string | null;
}) {
  const command = createOrionCommandRegistry().getById(args.commandId);
  if (!command || command.coverage.status === "unsupported") {
    return { status: 400, body: { ok: false, statusCategory: "command_validation_failed", userMessage: "That BOS action is not available." } };
  }

  const validation = command.validate(args.params);
  if (!validation.ok) {
    return {
      status: 400,
      body: {
        ok: false,
        commandId: command.id,
        statusCategory: "command_validation_failed",
        userMessage: validation.errors.join(" ") || "That BOS action needs more information.",
      },
    };
  }

  const normalizedParams: Record<string, unknown> = validation.normalizedParams ?? {};

  if (command.confirmationLevel === "REQUIRED" && !args.confirmed) {
    const confirmationToken = encodeConfirmationToken({
      commandId: command.id,
      params: normalizedParams,
      companyId: args.companyId,
      userId: args.userId,
      expiresAt: Date.now() + CONFIRMATION_TTL_MS,
    });

    return {
      status: 409,
      body: {
        ok: false,
        commandId: command.id,
        statusCategory: "confirmation_required",
        confirmationRequired: true,
        confirmationToken,
        userMessage: `Please confirm before I ${command.description.toLowerCase()}`,
      },
    };
  }

  const correlationId = requestId("orion-realtime");
  const idempotencyKey = `${command.id}:${JSON.stringify(normalizedParams)}:${correlationId}`;
  const router = createOrionCommandRouter({ supabase: args.supabase });
  const result = await router.executeCommand({
    commandId: command.id,
    params: normalizedParams,
    confirmation: command.confirmationLevel === "REQUIRED"
      ? { confirmed: true, summary: `Confirmed in Orion Realtime conversation for ${command.id}.` }
      : undefined,
    companyContext: { companyId: args.companyId },
    userContext: { actorProfileId: args.userId, role: normalizeRole(args.role) },
    executionContext: { origin: "user" },
    correlationId,
    idempotencyKey,
  });

  return {
    status: result.success ? 200 : 400,
    body: {
      ok: result.success,
      commandId: command.id,
      statusCategory: result.status,
      userMessage: result.userMessage,
      href: result.href,
      confirmationRequired: false,
    },
  };
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

    const body = await req.json() as { toolName?: unknown; params?: unknown; confirmationTranscript?: unknown };
    if (typeof body.toolName !== "string" || !body.toolName.trim()) {
      return NextResponse.json({ ok: false, statusCategory: "command_validation_failed", userMessage: "Realtime BOS tool name is required." }, { status: 400 });
    }

    const params = body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? body.params as Record<string, unknown>
      : {};

    if (body.toolName.trim() === CONFIRM_TOOL_NAME) {
      const confirmationTranscript = typeof body.confirmationTranscript === "string" ? body.confirmationTranscript.trim() : "";
      if (!isExplicitConfirmation(confirmationTranscript)) {
        return NextResponse.json({
          ok: false,
          statusCategory: "confirmation_required",
          confirmationRequired: true,
          userMessage: "I still need a clear confirmation before I perform that BOS action.",
        }, { status: 409 });
      }

      const token = typeof params.confirmationToken === "string" ? params.confirmationToken : "";
      const pending = decodeConfirmationToken(token);
      if (!pending || pending.companyId !== workspace.context.companyId || pending.userId !== workspace.context.userId) {
        return NextResponse.json({
          ok: false,
          statusCategory: "confirmation_invalid",
          userMessage: "That confirmation expired or is no longer valid. Please ask me to perform the action again.",
        }, { status: 400 });
      }

      const executed = await executeCanonicalCommand({
        commandId: pending.commandId,
        params: pending.params,
        confirmed: true,
        supabase,
        companyId: workspace.context.companyId,
        userId: workspace.context.userId,
        role: workspace.context.role,
      });
      return NextResponse.json(executed.body, { status: executed.status });
    }

    const command = getUniversalBosCommandByToolName(body.toolName.trim());
    if (!command) {
      return NextResponse.json({ ok: false, statusCategory: "command_validation_failed", userMessage: "That BOS action is not available." }, { status: 400 });
    }

    const executed = await executeCanonicalCommand({
      commandId: command.id,
      params,
      confirmed: false,
      supabase,
      companyId: workspace.context.companyId,
      userId: workspace.context.userId,
      role: workspace.context.role,
    });
    return NextResponse.json(executed.body, { status: executed.status });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      statusCategory: "command_execution_failed",
      userMessage: error instanceof Error ? error.message : "Realtime BOS action failed.",
    }, { status: 500 });
  }
}
