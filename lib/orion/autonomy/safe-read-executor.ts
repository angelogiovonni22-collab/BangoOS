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
import { resolveOrionStepReferences, type OrionStepReferenceOutput } from "./step-references";

export type OrionSafeReadExecutionStep = {
  index: number;
  commandId: string;
  success: boolean;
  status: string;
  userMessage: string;
  href: string | null;
  verified: boolean;
  referencesResolved: number;
};

export type OrionProtectedBoundaryHandoff = {
  stepIndex: number;
  toolName: string;
  commandId: string;
  params: Record<string, unknown>;
  risk: OrionAutonomyPlanStep["risk"];
  mode: OrionAutonomyPlanStep["mode"];
  stopReason: OrionAutonomyPlanStep["stopReason"];
  confirmationRequired: boolean;
  reviewRequired: boolean;
  referencesResolved: number;
};

export type OrionSafeReadExecutionResult = {
  ok: boolean;
  executed: OrionSafeReadExecutionStep[];
  stoppedAt: number | null;
  stopReason: "plan_boundary" | "write_boundary" | "authorization_failed" | "validation_failed" | "execution_failed" | null;
  nextBlockedStep: OrionAutonomyPlanStep | null;
  nextBlockedAction: OrionProtectedBoundaryHandoff | null;
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

function emptyResult(args: {
  ok: boolean;
  executed: OrionSafeReadExecutionStep[];
  stoppedAt: number | null;
  stopReason: OrionSafeReadExecutionResult["stopReason"];
  nextBlockedStep: OrionAutonomyPlanStep | null;
  error?: string;
}): OrionSafeReadExecutionResult {
  return { ...args, nextBlockedAction: null };
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
    return emptyResult({ ok: false, executed: [], stoppedAt: 0, stopReason: "validation_failed", nextBlockedStep: null, error: planned.error });
  }

  const registry = createOrionCommandRegistry();
  const router = createOrionCommandRouter({ supabase: args.supabase });
  const executed: OrionSafeReadExecutionStep[] = [];
  const outputs: OrionStepReferenceOutput[] = [];

  for (let zeroIndex = 0; zeroIndex < planned.plan.autonomousPrefixLength; zeroIndex += 1) {
    const stepIndex = zeroIndex + 1;
    const planStep = planned.plan.steps[zeroIndex];
    const command = registry.getById(planStep.commandId);
    if (!command) {
      return emptyResult({ ok: false, executed, stoppedAt: stepIndex, stopReason: "validation_failed", nextBlockedStep: planned.plan.nextBlockedStep, error: "Planned BOS command is unavailable." });
    }

    if (classifyOrionCommandRisk(command) !== "read") {
      return emptyResult({ ok: true, executed, stoppedAt: stepIndex, stopReason: "write_boundary", nextBlockedStep: planStep });
    }

    const authorization = await authorizeOrionCommand({
      supabase: args.supabase,
      companyId: args.companyId,
      userId: args.userId,
      command,
      legacyRoleAllowed: (membershipRole) => command.requiredPermissions.includes(normalizeRole(membershipRole)),
    });
    if (!authorization.allowed) {
      return emptyResult({ ok: false, executed, stoppedAt: stepIndex, stopReason: "authorization_failed", nextBlockedStep: planStep, error: authorization.reason });
    }

    const referenceResolution = resolveOrionStepReferences({
      params: asParams(args.steps[zeroIndex]?.params),
      outputs,
      currentStepIndex: stepIndex,
    });
    if (!referenceResolution.ok) {
      return emptyResult({
        ok: false,
        executed,
        stoppedAt: stepIndex,
        stopReason: "validation_failed",
        nextBlockedStep: planStep,
        error: referenceResolution.error,
      });
    }

    const fastParams = await normalizeRealtimeFastCommandParams({
      supabase: args.supabase,
      companyId: args.companyId,
      commandId: command.id,
      params: asParams(referenceResolution.value),
    });
    if (fastParams.error) {
      return emptyResult({ ok: false, executed, stoppedAt: stepIndex, stopReason: "validation_failed", nextBlockedStep: planStep, error: fastParams.error });
    }

    const validation = command.validate(fastParams.params);
    if (!validation.ok) {
      return emptyResult({ ok: false, executed, stoppedAt: stepIndex, stopReason: "validation_failed", nextBlockedStep: planStep, error: validation.errors.join(" ") || "BOS command validation failed." });
    }

    const stepExecutionId = `${args.executionId || "orion-safe-read"}-${stepIndex}`;
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
      index: stepIndex,
      commandId: command.id,
      success: result.success,
      status: result.status,
      userMessage: result.userMessage,
      href: result.href,
      verified,
      referencesResolved: referenceResolution.referencesResolved,
    });

    if (!verified) {
      return emptyResult({ ok: false, executed, stoppedAt: stepIndex, stopReason: "execution_failed", nextBlockedStep: planned.plan.nextBlockedStep, error: result.userMessage });
    }

    outputs.push({
      index: stepIndex,
      commandId: command.id,
      entityId: result.entityId,
      href: result.href,
      createdEntityIds: result.createdEntityIds,
      updatedEntityIds: result.updatedEntityIds,
      details: result.details,
    });
  }

  const nextBlockedStep = planned.plan.nextBlockedStep;
  if (!nextBlockedStep) {
    return {
      ok: true,
      executed,
      stoppedAt: null,
      stopReason: null,
      nextBlockedStep: null,
      nextBlockedAction: null,
    };
  }

  const blockedIndex = planned.plan.autonomousPrefixLength + 1;
  if (nextBlockedStep.stopReason === "step_limit") {
    return {
      ok: true,
      executed,
      stoppedAt: blockedIndex,
      stopReason: "plan_boundary",
      nextBlockedStep,
      nextBlockedAction: null,
    };
  }

  const rawBlockedStep = args.steps[blockedIndex - 1];
  const toolName = typeof rawBlockedStep?.toolName === "string" ? rawBlockedStep.toolName.trim() : "";
  const blockedCommand = registry.getById(nextBlockedStep.commandId);
  if (!toolName || !blockedCommand) {
    return emptyResult({
      ok: false,
      executed,
      stoppedAt: blockedIndex,
      stopReason: "validation_failed",
      nextBlockedStep,
      error: "The protected BOS boundary could not be resolved safely.",
    });
  }

  const blockedAuthorization = await authorizeOrionCommand({
    supabase: args.supabase,
    companyId: args.companyId,
    userId: args.userId,
    command: blockedCommand,
    legacyRoleAllowed: (membershipRole) => blockedCommand.requiredPermissions.includes(normalizeRole(membershipRole)),
  });
  if (!blockedAuthorization.allowed) {
    return emptyResult({
      ok: false,
      executed,
      stoppedAt: blockedIndex,
      stopReason: "authorization_failed",
      nextBlockedStep,
      error: blockedAuthorization.reason,
    });
  }

  const blockedReferenceResolution = resolveOrionStepReferences({
    params: asParams(rawBlockedStep.params),
    outputs,
    currentStepIndex: blockedIndex,
  });
  if (!blockedReferenceResolution.ok) {
    return emptyResult({
      ok: false,
      executed,
      stoppedAt: blockedIndex,
      stopReason: "validation_failed",
      nextBlockedStep,
      error: blockedReferenceResolution.error,
    });
  }

  const nextBlockedAction: OrionProtectedBoundaryHandoff = {
    stepIndex: blockedIndex,
    toolName,
    commandId: blockedCommand.id,
    params: asParams(blockedReferenceResolution.value),
    risk: nextBlockedStep.risk,
    mode: nextBlockedStep.mode,
    stopReason: nextBlockedStep.stopReason,
    confirmationRequired: nextBlockedStep.mode === "confirm",
    reviewRequired: nextBlockedStep.mode === "review",
    referencesResolved: blockedReferenceResolution.referencesResolved,
  };

  return {
    ok: true,
    executed,
    stoppedAt: blockedIndex,
    stopReason: "plan_boundary",
    nextBlockedStep,
    nextBlockedAction,
  };
}
