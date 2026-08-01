/**
 * POST /api/bango-intelligence/narrate
 *
 * Server-only route handler for Bango AI superintendent narration.
 *
 * Security model:
 * - Requires an authenticated Supabase session (cookie-based).
 * - Verifies the project belongs to the authenticated user's company.
 * - All AI grounding data is loaded server-side from Supabase.
 * - No briefing object is accepted from the browser.
 * - The OpenAI API key never reaches the browser.
 *
 * Flow:
 *   1. Parse and validate request body.
 *   2. Build authorized role-scoped reasoning context via shared core.
 *   3. Build superintendent prompt from normalized reasoning context.
 *   4. Call AI provider (OpenAI).
 *   5. Validate structured response.
 *   6. Return validated narration or deterministic fallback.
 *   7. Log audit result server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSuperintendentSystemPrompt } from "@/lib/bango-intelligence/prompts/superintendent-system-prompt";
import { buildSuperintendentUserPromptFromReasoningContext } from "@/lib/bango-intelligence/prompts/superintendent-briefing-prompt";
import { getSuperintendentProvider } from "@/lib/bango-intelligence/openai-provider";
import { validateNarratedBriefing } from "@/lib/bango-intelligence/response-validation";
import { logAuditResult } from "@/lib/bango-intelligence/audit-types";
import { BANGO_AI_CONFIG, isInputTooLarge } from "@/lib/bango-intelligence/cost-controls";
import { SUPPORTED_REQUEST_TYPES } from "@/lib/bango-intelligence/types";
import { buildBangoProviderRequest } from "@/lib/bango-intelligence/core";
import { SupabaseMemoryProvider } from "@/lib/bango-intelligence/memory/memory-index";
import { createClient } from "@/lib/supabase/server";
import type { BangoAINarrateRequest, BangoAIResponse } from "@/lib/bango-intelligence/types";
import type { ApprovalLevel } from "@/lib/bango-intelligence/core";

// ---------------------------------------------------------------------------
// Request body size limit
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 2_000;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const requestStart = Date.now();
  const provider = getSuperintendentProvider();

  // -- 1. Parse and validate body size -----------------------------------------

  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return jsonError("Request body too large.", 413);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const validation = validateRequestBody(body);
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const { projectId, requestType, locale } = validation.data;
  const supabase = await createClient();

  // -- 2. Build authorized request context ---------------------------------

  const prepared = await buildBangoProviderRequest({
    requestId,
    roleId: "superintendent",
    projectId,
    requestType,
    locale,
  }, {
    memoryProvider: supabase ? new SupabaseMemoryProvider(supabase) : undefined,
  });

  if (!prepared.ok) {
    return jsonError(prepared.error, prepared.status);
  }

  const { role, businessContext, reasoningContext } = prepared.data;
  const systemPrompt = getSuperintendentSystemPrompt();
  const userPrompt = buildSuperintendentUserPromptFromReasoningContext(reasoningContext);

  // -- 7. Check input size -------------------------------------------------

  const groundingText = userPrompt;
  if (isInputTooLarge(groundingText)) {
    logAuditResult({
      requestId,
      userId: businessContext.identity.userId,
      companyId: businessContext.identity.companyId,
      projectId: businessContext.scope.projectId,
      roleId: role.roleId,
      roleVersion: role.version,
      requestType,
      capabilitySet: [...businessContext.permissions.allowedCapabilities],
      approvalLevel: deriveStrictestApprovalLevel(businessContext.permissions.approvalRequirements),
      evidenceCount: reasoningContext.evidence.length,
      provider: provider.providerName,
      model: provider.modelName,
      timestamp: new Date().toISOString(),
      success: false,
      latencyMs: Date.now() - requestStart,
      fallbackUsed: true,
      tokensInput: null,
      tokensOutput: null,
      failureReason: "input_too_large",
    });

    return jsonFallback("Grounding context too large.");
  }

  // -- 8. Call AI provider -------------------------------------------------

  let providerOutput: Awaited<ReturnType<typeof provider.complete>> | null = null;
  let narration = null;
  let success = false;
  let failureReason: string | null = null;

  try {
    providerOutput = await provider.complete({
      systemPrompt,
      userPrompt,
      maxTokens: BANGO_AI_CONFIG.maxOutputTokens,
      temperature: BANGO_AI_CONFIG.temperature,
      locale,
      requestId,
    });

    // -- 9. Validate response ----------------------------------------------
    narration = validateNarratedBriefing(providerOutput.rawText);

    if (!narration) {
      failureReason = "validation_failed";
    } else {
      success = true;
    }
  } catch (err) {
    failureReason = err instanceof Error ? sanitizeErrorMessage(err.message) : "unknown_error";
  }

  // -- 10. Log audit -------------------------------------------------------

  logAuditResult({
    requestId,
    userId: businessContext.identity.userId,
    companyId: businessContext.identity.companyId,
    projectId: businessContext.scope.projectId,
    roleId: role.roleId,
    roleVersion: role.version,
    requestType,
    capabilitySet: [...businessContext.permissions.allowedCapabilities],
    approvalLevel: deriveStrictestApprovalLevel(businessContext.permissions.approvalRequirements),
    evidenceCount: reasoningContext.evidence.length,
    provider: provider.providerName,
    model: provider.modelName,
    timestamp: new Date().toISOString(),
    success,
    latencyMs: Date.now() - requestStart,
    fallbackUsed: !success,
    tokensInput: providerOutput?.tokensUsed ?? null,
    tokensOutput: null,
    failureReason,
  });

  // -- 11. Return result ---------------------------------------------------

  if (!narration) {
    return jsonFallback(failureReason ?? "narration_unavailable");
  }

  const response: BangoAIResponse = {
    ok: true,
    narration,
    generatedAt: new Date().toISOString(),
    model: providerOutput?.model ?? provider.modelName,
    isAiNarration: true,
  };

  return NextResponse.json(response);
}

// ---------------------------------------------------------------------------
// Request body validation
// ---------------------------------------------------------------------------

type BodyValidationResult =
  | { ok: true; data: BangoAINarrateRequest }
  | { ok: false; error: string };

function validateRequestBody(body: unknown): BodyValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.projectId !== "string" || obj.projectId.trim().length === 0) {
    return { ok: false, error: "projectId is required." };
  }

  if (typeof obj.requestType !== "string" || !SUPPORTED_REQUEST_TYPES.includes(obj.requestType as BangoAINarrateRequest["requestType"])) {
    return { ok: false, error: `requestType must be one of: ${SUPPORTED_REQUEST_TYPES.join(", ")}.` };
  }

  const locale = typeof obj.locale === "string" && obj.locale.trim().length > 0
    ? obj.locale.trim().slice(0, 10)
    : "en-US";

  return {
    ok: true,
    data: {
      projectId: obj.projectId.trim().slice(0, 100),
      requestType: obj.requestType as BangoAINarrateRequest["requestType"],
      locale,
    },
  };
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonError(error: string, status: number): NextResponse {
  const payload: BangoAIResponse = { ok: false, error, isAiNarration: false };
  return NextResponse.json(payload, { status });
}

function jsonFallback(reason: string): NextResponse {
  const payload: BangoAIResponse = {
    ok: true,
    narration: null,
    fallback: true,
    reason,
    isAiNarration: false,
  };
  return NextResponse.json(payload);
}

/** Strips sensitive implementation details from error messages before logging */
function sanitizeErrorMessage(message: string): string {
  return message.slice(0, 120).replace(/sk-[a-zA-Z0-9_-]+/g, "[REDACTED]");
}

function deriveStrictestApprovalLevel(
  approvals: Partial<Record<string, ApprovalLevel>>,
): ApprovalLevel {
  const rank: ApprovalLevel[] = [
    "none_required",
    "user_confirmation",
    "manager_approval",
    "owner_approval",
    "qualified_professional_approval",
    "prohibited",
  ];

  let maxLevel: ApprovalLevel = "none_required";
  for (const level of Object.values(approvals)) {
    if (!level) {
      continue;
    }

    if (rank.indexOf(level) > rank.indexOf(maxLevel)) {
      maxLevel = level;
    }
  }

  return maxLevel;
}
