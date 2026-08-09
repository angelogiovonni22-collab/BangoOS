import { NextRequest, NextResponse } from "next/server";
import { createOrionCommandRouter, type OrionCommandPermission } from "@/lib/orion/commands";
import { createOrionCommandRegistry } from "@/lib/orion/commands";
import { getCustomerRelatedRecords, getOrionCommandCenterCatalog, parseRouteContext } from "@/lib/orion/command-center";
import { resolveOrionIntelligenceIntentFallback } from "@/lib/orion/intelligence";
import { resolveOrionIntent, type OrionIntentInput } from "@/lib/orion/intent-engine";
import { resolveOperationalVoiceIntent } from "@/lib/orion/voice/operational-voice-intent";
import { resolveEstimateVoiceWorkflowTurn } from "@/lib/orion/workflows/estimate-voice-workflow";
import { resolveVoiceWorkflowTurn } from "@/lib/orion/workflows/voice-workflow-assistant";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const REQUEST_CONTEXT_TTL_MS = 30_000;

type CachedRequestContext = {
  userId: string;
  companyId: string;
  role: string | null;
  cachedAtMs: number;
  expiresAtMs: number;
};

const requestContextCache = new Map<string, CachedRequestContext>();

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function logApiTiming(stage: string, startedAt: number, details?: Record<string, unknown>) {
  if (IS_PRODUCTION || typeof console === "undefined") {
    return;
  }

  const elapsedMs = Number((nowMs() - startedAt).toFixed(1));
  if (details) {
    console.info(`[orion-timing] ${stage}`, { elapsedMs, ...details });
    return;
  }

  console.info(`[orion-timing] ${stage}`, { elapsedMs });
}

function contextCacheKey(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const authHeader = req.headers.get("authorization") || "";
  const companyHint = req.headers.get("x-orion-company-id") || "";
  const hint = req.headers.get("x-orion-context-hint") || "";
  return `${cookie}|${authHeader}|${companyHint}|${hint}`;
}

function clearExpiredContextCache(now: number) {
  for (const [key, entry] of requestContextCache.entries()) {
    if (entry.expiresAtMs <= now) {
      requestContextCache.delete(key);
    }
  }
}

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

async function resolveRequestContext(req: NextRequest) {
  const lookupStartedAt = nowMs();
  if (!IS_PRODUCTION && typeof console !== "undefined") console.info("[orion-timing] context.lookup.start");
  const supabase = await createClient();

  if (!supabase) {
    logApiTiming("context.lookup.end", lookupStartedAt, { cacheHit: false, status: 503 });
    return { ok: false as const, status: 503, error: "Supabase is unavailable." };
  }

  const now = nowMs();
  clearExpiredContextCache(now);
  const cacheKey = contextCacheKey(req);
  const cached = requestContextCache.get(cacheKey);

  if (cached && cached.expiresAtMs > now) {
    logApiTiming("context.lookup.end", lookupStartedAt, { cacheHit: true, companyId: cached.companyId });
    return {
      ok: true as const,
      supabase,
      workspace: {
        userId: cached.userId,
        companyId: cached.companyId,
        role: cached.role,
        companyName: null,
        companySlug: null,
        membershipId: null,
        membershipStatus: null,
      },
    };
  }

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) {
    const statusCategory = workspace.errorCode === "unauthenticated"
      ? "authentication_required"
      : workspace.errorCode === "company_missing" || workspace.errorCode === "profile_missing"
        ? "no_workspace"
        : "permission_denied";

    logApiTiming("context.lookup.end", lookupStartedAt, {
      cacheHit: false,
      status: workspace.errorCode === "unauthenticated" ? 401 : 403,
    });

    return {
      ok: false as const,
      status: workspace.errorCode === "unauthenticated" ? 401 : 403,
      error: workspace.errorMessage || "Workspace context is unavailable.",
      statusCategory,
    };
  }

  requestContextCache.set(cacheKey, {
    userId: workspace.context.userId,
    companyId: workspace.context.companyId,
    role: workspace.context.role,
    cachedAtMs: now,
    expiresAtMs: now + REQUEST_CONTEXT_TTL_MS,
  });

  logApiTiming("context.lookup.end", lookupStartedAt, { cacheHit: false, companyId: workspace.context.companyId });
  return { ok: true as const, supabase, workspace: workspace.context };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const context = await resolveRequestContext(req);
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error, statusCategory: context.statusCategory }, { status: context.status });
    }

    const requestedUrl = new URL(req.url);
    if (requestedUrl.searchParams.get("mode") === "related" && requestedUrl.searchParams.get("entityType") === "customer") {
      const customerId = requestedUrl.searchParams.get("customerId");
      if (!customerId) return NextResponse.json({ ok: false, error: "customerId is required for customer related records." }, { status: 400 });

      try {
        const related = await getCustomerRelatedRecords({
          supabase: context.supabase,
          companyId: context.workspace.companyId,
          customerId,
        });
        return NextResponse.json({ ok: true, related });
      } catch (error) {
        return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load related records." }, { status: 400 });
      }
    }

    const targetUrl = requestedUrl.searchParams.get("url");
    let route = parseRouteContext(requestedUrl);
    if (targetUrl) {
      try {
        route = parseRouteContext(new URL(targetUrl));
      } catch {
        route = parseRouteContext(requestedUrl);
      }
    }

    const catalog = await getOrionCommandCenterCatalog(context.supabase, context.workspace, route);
    return NextResponse.json({ ok: true, catalog });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load command center catalog.", statusCategory: "error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const context = await resolveRequestContext(req);
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error, statusCategory: context.statusCategory }, { status: context.status });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid command payload." }, { status: 400 });

    const payload = body as {
      mode?: unknown;
      intent?: unknown;
      commandId?: unknown;
      params?: unknown;
      confirmation?: unknown;
      correlationId?: unknown;
      idempotencyKey?: unknown;
    };

    if (payload.mode === "intent") {
      const intentStartedAt = nowMs();
      if (!IS_PRODUCTION && typeof console !== "undefined") console.info("[orion-timing] intent.request.start");
      const intentPayload = payload.intent as Partial<OrionIntentInput> | undefined;
      if (!intentPayload || typeof intentPayload.input !== "string") {
        return NextResponse.json({ ok: false, error: "intent.input is required." }, { status: 400 });
      }

      const isVoiceTurn = req.headers.get("x-orion-voice-turn") === "1";
      const fallbackRoute = parseRouteContext(new URL(req.url));
      const route = intentPayload.route || fallbackRoute;
      const normalizedIntentInput: OrionIntentInput = {
        input: intentPayload.input,
        route,
        selectedCandidateId: typeof intentPayload.selectedCandidateId === "string" ? intentPayload.selectedCandidateId : null,
        pinnedCommandIds: Array.isArray(intentPayload.pinnedCommandIds)
          ? intentPayload.pinnedCommandIds.filter((entry): entry is string => typeof entry === "string")
          : [],
        recentCommandIds: Array.isArray(intentPayload.recentCommandIds)
          ? intentPayload.recentCommandIds.filter((entry): entry is string => typeof entry === "string")
          : [],
      };

      if (isVoiceTurn) {
        const operationalHandled = await resolveOperationalVoiceIntent({
          supabase: context.supabase,
          workspace: context.workspace,
          input: normalizedIntentInput,
        });
        if (operationalHandled.handled && operationalHandled.intent) {
          logApiTiming("intent.request.end", intentStartedAt, {
            hasSuggestion: Boolean(operationalHandled.intent.suggestedCommand),
            requiresClarification: operationalHandled.intent.requiresClarification,
            workflowStatus: operationalHandled.statusCategory,
            operationalVoice: true,
          });
          return NextResponse.json({ ok: true, intent: operationalHandled.intent, statusCategory: operationalHandled.statusCategory });
        }

        const estimateHandled = await resolveEstimateVoiceWorkflowTurn({
          supabase: context.supabase,
          workspace: context.workspace,
          input: normalizedIntentInput,
        });
        if (estimateHandled.handled && estimateHandled.intent) {
          logApiTiming("intent.request.end", intentStartedAt, {
            hasSuggestion: Boolean(estimateHandled.intent.suggestedCommand),
            requiresClarification: estimateHandled.intent.requiresClarification,
            workflowStatus: estimateHandled.statusCategory,
            estimateVoice: true,
          });
          return NextResponse.json({ ok: true, intent: estimateHandled.intent, statusCategory: estimateHandled.statusCategory });
        }

        const workflowHandled = await resolveVoiceWorkflowTurn({
          supabase: context.supabase,
          workspace: context.workspace,
          input: normalizedIntentInput,
        });
        if (workflowHandled.handled && workflowHandled.intent) {
          logApiTiming("intent.request.end", intentStartedAt, {
            hasSuggestion: Boolean(workflowHandled.intent.suggestedCommand),
            requiresClarification: workflowHandled.intent.requiresClarification,
            workflowStatus: workflowHandled.statusCategory,
          });
          return NextResponse.json({ ok: true, intent: workflowHandled.intent, statusCategory: workflowHandled.statusCategory });
        }
      }

      const result = await resolveOrionIntent({
        supabase: context.supabase,
        workspace: context.workspace,
        input: normalizedIntentInput,
      });

      if (!result.suggestedCommand && !result.requiresClarification) {
        try {
          const intelligenceFallback = await resolveOrionIntelligenceIntentFallback({
            input: normalizedIntentInput,
            workspace: context.workspace,
          });
          if (intelligenceFallback) {
            logApiTiming("intent.request.end", intentStartedAt, {
              hasSuggestion: Boolean(intelligenceFallback.intent.suggestedCommand),
              requiresClarification: intelligenceFallback.intent.requiresClarification,
              workflowStatus: intelligenceFallback.statusCategory,
              intelligenceFallback: true,
            });
            return NextResponse.json({ ok: true, intent: intelligenceFallback.intent, statusCategory: intelligenceFallback.statusCategory });
          }
        } catch (error) {
          if (!IS_PRODUCTION && typeof console !== "undefined") console.warn("[orion-intelligence] fallback failed", error);
          // Preserve deterministic Orion behavior if the optional intelligence layer is unavailable.
        }
      }

      logApiTiming("intent.request.end", intentStartedAt, {
        hasSuggestion: Boolean(result.suggestedCommand),
        requiresClarification: result.requiresClarification,
      });
      return NextResponse.json({ ok: true, intent: result });
    }

    if (typeof payload.commandId !== "string" || !payload.commandId.trim()) {
      return NextResponse.json({ ok: false, error: "commandId is required.", statusCategory: "command_validation_failed" }, { status: 400 });
    }

    const commandId = payload.commandId.trim();
    const commandRegistry = createOrionCommandRegistry();
    const command = commandRegistry.getById(commandId);
    if (!command) {
      return NextResponse.json({ ok: false, error: `Unsupported command ID: ${commandId}.`, statusCategory: "command_validation_failed" }, { status: 400 });
    }

    const inputParams = payload.params && typeof payload.params === "object" ? payload.params : {};
    const validationStartedAt = nowMs();
    if (!IS_PRODUCTION && typeof console !== "undefined") console.info("[orion-timing] command.validation.start", { commandId });
    const validation = command.validate(inputParams);
    logApiTiming("command.validation.end", validationStartedAt, { ok: validation.ok, commandId });
    if (!validation.ok) {
      return NextResponse.json({
        ok: false,
        error: validation.errors.join(" ") || "Command parameters are invalid.",
        statusCategory: "command_validation_failed",
        validationErrors: validation.errors,
      }, { status: 400 });
    }

    const router = createOrionCommandRouter({ supabase: context.supabase });
    const executionStartedAt = nowMs();
    if (!IS_PRODUCTION && typeof console !== "undefined") console.info("[orion-timing] command.execute.start", { commandId });
    const result = await router.executeCommand({
      commandId,
      params: validation.normalizedParams,
      confirmation: typeof payload.confirmation === "boolean"
        ? payload.confirmation
        : payload.confirmation && typeof payload.confirmation === "object"
          ? payload.confirmation as { confirmed: boolean; summary?: string }
          : undefined,
      companyContext: { companyId: context.workspace.companyId },
      userContext: { actorProfileId: context.workspace.userId, role: normalizeRole(context.workspace.role) },
      executionContext: { origin: "user" },
      correlationId: typeof payload.correlationId === "string" ? payload.correlationId : undefined,
      idempotencyKey: typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : undefined,
    });
    logApiTiming("command.execute.end", executionStartedAt, { commandId, status: result.status, success: result.success });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Command execution request failed.", statusCategory: "command_execution_failed" }, { status: 500 });
  }
}
