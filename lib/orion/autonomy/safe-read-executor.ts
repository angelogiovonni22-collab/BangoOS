import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  createOrionCommandRegistry,
  createOrionCommandRouter,
  type OrionCommandPermission,
} from "@/lib/orion/commands";
import { authorizeOrionCommand } from "@/lib/orion/commands/authorization";
import { createOrionExecutionEnvelope } from "@/lib/orion/commands/execution-envelope";
import { classifyOrionCommandRisk } from "./policy";
import type { OrionAutonomyPlanStep } from "./planner";
import { buildOrionAutonomyPlanFromToolSteps, type OrionAutonomyPlanRequestStep } from "./plan-request";
import { normalizeRealtimeFastCommandParams } from "@/lib/orion/realtime/fast-command-params";

export type OrionSafeReadExecutionStep = {
  index: number;
  commandId: string;
  success: boolean;
  status: string;
  userMessage: string;
  href: string | null;
  verified: boolean;
};

export type OrionSafeReadExecutionResult = {
  ok: boolean;
  executed: OrionSafeReadExecutionStep[];
  stoppedAt: number | null;
  stopReason: "plan_boundary" | "write_boundary" | "authorization_failed" | "validation_failed" | "execution_failed" | null;
  nextBlockedStep: OrionAutonomyPlanStep | null;
  error?: string;
};

function normalizeRole(role: string | null): OrionCommandPermission {
  const normalized = (role || "employee").trim().toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin" || normalized === "administrator") return "administrator";
  if (normalized === "operations_manager") return "operations_manager";
  if (normalized === "project_manager") return "project_manager";
  if (normalized === "estimator") return "estimator";
  if (normalized === "superintendent") return "superintendent";
  if (normalized === "office_manager") return "office_manager";
  if (normalized === "accountant") return "accountant";
  if (normalized === "foreman") return "foreman";
  return "employee";
}

function asParams(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function executeOrionSafeReadPrefix(args: {
  steps: OrionAutonomyPlanRequestStep[];
  supabase: SupabaseClient<Database>;
  companyId: string;
  userId: string;
  role: string | null;
  executionId?: string;
}): Promise<OrionSafeReadExecutionResult> {
  const planned = buildOrionAutonomyPlanFromToolSteps(args.steps);
  if (!planned.ok) {
    return { ok: false, executed: [], stoppedAt: 0, stopReason: "validation_failed", nextBlockedStep: null, error: planned.error };
  }

  const registry = createOrionCommandRegistry();
  const router = createOrionCommandRouter({ supabase: args.supabase });
  const executed: OrionSafeReadExecutionStep[] = [];

  for (let zeroIndex = 0; zeroIndex < planned.plan.autonomousPrefixLength; zeroIndex += 1) {
    const planStep = planned.plan.steps[zeroIndex];
    const command = registry.getById(planStep.commandId);
    if (!command) {
      return { ok: false, executed, stoppedAt: zeroIndex + 1, stopReason: "validation_failed", nextBlockedStep: planned.plan.nextBlockedStep, error: "Planned BOS command is unavailable." };
    }

    if (classifyOrionCommandRisk(command) !== "read") {
      return { ok: true, executed, stoppedAt: zeroIndex + 1, stopReason: "write_boundary", nextBlockedStep: planStep };
    }

    const authorization = await authorizeOrionCommand({
      supabase: args.supabase,
      companyId: args.companyId,
      userId: args.userId,
      command,
      legacyRoleAllowed: (membershipRole) => command.requiredPermissions.includes(normalizeRole(membershipRole)),
    });
    if (!authorization.allowed) {
      return { ok: false, executed, stoppedAt: zeroIndex + 1, stopReason: "authorization_failed", nextBlockedStep: planStep, error: authorization.reason };
    }

    const fastParams = await normalizeRealtimeFastCommandParams({
      supabase: args.supabase,
      companyId: args.companyId,
      commandId: command.id,
      params: asParams(args.steps[zeroIndex]?.params),
    });
    if (fastParams.error) {
      return { ok: false, executed, stoppedAt: zeroIndex + 1, stopReason: "validation_failed", nextBlockedStep: planStep, error: fastParams.error };
    }

    const validation = command.validate(fastParams.params);
    if (!validation.ok) {
      return { ok: false, executed, stoppedAt: zeroIndex + 1, stopReason: "validation_failed", nextBlockedStep: planStep, error: validation.errors.join(" ") || "BOS command validation failed." };
    }

    const stepExecutionId = `${args.executionId || "orion-safe-read"}-${zeroIndex + 1}`;
    const { correlationId, idempotencyKey } = createOrionExecutionEnvelope(command.id, "orion-autonomy", stepExecutionId);
    const result = await router.executeCommand({
      commandId: command.id,
      params: validation.normalizedParams ?? {},
      companyContext: { companyId: args.companyId },
      userContext: { actorProfileId: args.userId, role: normalizeRole(authorization.role) },
      executionContext: { origin: "user" },
      correlationId,
      idempotencyKey,
    });

    const verified = result.success && result.status === "completed";
    executed.push({
      index: zeroIndex + 1,
      commandId: command.id,
      success: result.success,
      status: result.status,
      userMessage: result.userMessage,
      href: result.href,
      verified,
    });

    if (!verified) {
      return { ok: false, executed, stoppedAt: zeroIndex + 1, stopReason: "execution_failed", nextBlockedStep: planned.plan.nextBlockedStep, error: result.userMessage };
    }
  }

  return {
    ok: true,
    executed,
    stoppedAt: planned.plan.nextBlockedStep ? planned.plan.autonomousPrefixLength + 1 : null,
    stopReason: planned.plan.nextBlockedStep ? "plan_boundary" : null,
    nextBlockedStep: planned.plan.nextBlockedStep,
  };
}
