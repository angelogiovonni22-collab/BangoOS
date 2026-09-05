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
import { verifyOrionAutonomousReadResult } from "./read-result-verifier";
import { buildOrionReadEvidence, type OrionReadEvidence } from "./read-evidence";

export type OrionSafeReadExecutionStep = {
  index: number;
  commandId: string;
  success: boolean;
  status: string;
  userMessage: string;
  href: string | null;
  verified: boolean;
  attempts: number;
  durationMs: number;
  referencesResolved: number;
  evidence: OrionReadEvidence | null;
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
  stopReason: "plan_boundary" | "write_boundary" | "time_budget_exceeded" | "authorization_failed" | "validation_failed" | "execution_failed" | null;
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

function hasOrionStepReference(value: unknown, depth = 0): boolean {
  if (depth > 20) return true;
  if (typeof value === "string") return value.startsWith("$step.");
  if (Array.isArray(value)) return value.some((item) => hasOrionStepReference(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => hasOrionStepReference(item, depth + 1));
  }
  return false;
}

const MAX_PARALLEL_SAFE_READS = 4;
const MAX_SAFE_READ_ATTEMPTS = 2;
const MAX_SAFE_READ_SEQUENCE_MS = 12_000;

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
  const sequenceStartedAt = Date.now();

  type StepAttempt =
    | {
        ok: true;
        executedStep: OrionSafeReadExecutionStep;
        output: OrionStepReferenceOutput;
      }
    | {
        ok: false;
        executedStep: OrionSafeReadExecutionStep | null;
        stoppedAt: number;
        stopReason: Exclude<OrionSafeReadExecutionResult["stopReason"], null>;
        nextBlockedStep: OrionAutonomyPlanStep | null;
        error: string;
      };

  const executeReadStep = async (
    zeroIndex: number,
    availableOutputs: OrionStepReferenceOutput[],
  ): Promise<StepAttempt> => {
    const stepIndex = zeroIndex + 1;
    const stepStartedAt = Date.now();
    const planStep = planned.plan.steps[zeroIndex];
    const command = registry.getById(planStep.commandId);
    if (!command) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "validation_failed",
        nextBlockedStep: planned.plan.nextBlockedStep,
        error: "Planned BOS command is unavailable.",
      };
    }

    if (classifyOrionCommandRisk(command) !== "read") {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "write_boundary",
        nextBlockedStep: planStep,
        error: "Autonomous safe-read execution stopped at a protected command boundary.",
      };
    }

    const authorization = await authorizeOrionCommand({
      supabase: args.supabase,
      companyId: args.companyId,
      userId: args.userId,
      command,
      legacyRoleAllowed: (membershipRole) => command.requiredPermissions.includes(normalizeRole(membershipRole)),
    });
    if (!authorization.allowed) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "authorization_failed",
        nextBlockedStep: planStep,
        error: authorization.reason,
      };
    }

    const referenceResolution = resolveOrionStepReferences({
      params: asParams(args.steps[zeroIndex]?.params),
      outputs: availableOutputs,
      currentStepIndex: stepIndex,
    });
    if (!referenceResolution.ok) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "validation_failed",
        nextBlockedStep: planStep,
        error: referenceResolution.error,
      };
    }

    const fastParams = await normalizeRealtimeFastCommandParams({
      supabase: args.supabase,
      companyId: args.companyId,
      commandId: command.id,
      params: asParams(referenceResolution.value),
    });
    if (fastParams.error) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "validation_failed",
        nextBlockedStep: planStep,
        error: fastParams.error,
      };
    }

    const validation = command.validate(fastParams.params);
    if (!validation.ok) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "validation_failed",
        nextBlockedStep: planStep,
        error: validation.errors.join(" ") || "BOS command validation failed.",
      };
    }

    const stepExecutionId = `${args.executionId || "orion-safe-read"}-${stepIndex}`;
    const { correlationId, idempotencyKey } = createOrionExecutionEnvelope(command.id, "orion-autonomy", stepExecutionId);
    let result: Awaited<ReturnType<typeof router.executeCommand>> | null = null;
    let verification: ReturnType<typeof verifyOrionAutonomousReadResult> | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= MAX_SAFE_READ_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      result = await router.executeCommand({
        commandId: command.id,
        params: validation.normalizedParams ?? {},
        companyContext: { companyId: args.companyId },
        userContext: { actorProfileId: args.userId, role: normalizeRole(authorization.role) },
        executionContext: { origin: "user" },
        correlationId,
        idempotencyKey,
      });
      verification = verifyOrionAutonomousReadResult({ command, result });
      if (verification.ok) break;
      const canRetry = !result.success && result.retryable && attempt < MAX_SAFE_READ_ATTEMPTS;
      if (!canRetry) break;
    }

    if (!result || !verification) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "execution_failed",
        nextBlockedStep: planned.plan.nextBlockedStep,
        error: "Orion could not obtain a safe read result.",
      };
    }

    const verified = verification.ok;
    const executedStep: OrionSafeReadExecutionStep = {
      index: stepIndex,
      commandId: command.id,
      success: result.success,
      status: result.status,
      userMessage: result.userMessage,
      href: result.href,
      verified,
      attempts,
      durationMs: Math.max(0, Date.now() - stepStartedAt),
      referencesResolved: referenceResolution.referencesResolved,
      evidence: verified ? buildOrionReadEvidence(result) : null,
    };

    if (!verified) {
      return {
        ok: false,
        executedStep,
        stoppedAt: stepIndex,
        stopReason: "execution_failed",
        nextBlockedStep: planned.plan.nextBlockedStep,
        error: verification.reason,
      };
    }

    return {
      ok: true,
      executedStep,
      output: {
        index: stepIndex,
        commandId: command.id,
        entityId: result.entityId,
        href: result.href,
        createdEntityIds: result.createdEntityIds,
        updatedEntityIds: result.updatedEntityIds,
        details: result.details,
      },
    };
  };

  let zeroIndex = 0;
  while (zeroIndex < planned.plan.autonomousPrefixLength) {
    if (Date.now() - sequenceStartedAt >= MAX_SAFE_READ_SEQUENCE_MS) {
      return {
        ok: true,
        executed,
        stoppedAt: zeroIndex + 1,
        stopReason: "time_budget_exceeded",
        nextBlockedStep: planned.plan.steps[zeroIndex] ?? null,
        nextBlockedAction: null,
      };
    }

    const currentParams = asParams(args.steps[zeroIndex]?.params);
    const canParallelize = !hasOrionStepReference(currentParams);
    let batchEnd = zeroIndex + 1;

    if (canParallelize) {
      while (
        batchEnd < planned.plan.autonomousPrefixLength
        && batchEnd - zeroIndex < MAX_PARALLEL_SAFE_READS
        && !hasOrionStepReference(asParams(args.steps[batchEnd]?.params))
      ) {
        const candidate = registry.getById(planned.plan.steps[batchEnd].commandId);
        if (!candidate || classifyOrionCommandRisk(candidate) !== "read") break;
        batchEnd += 1;
      }
    }

    const indexes = Array.from({ length: batchEnd - zeroIndex }, (_, offset) => zeroIndex + offset);
    const availableOutputs = [...outputs];
    const attempts = await Promise.all(indexes.map((index) => executeReadStep(index, availableOutputs)));

    for (const attempt of attempts) {
      if (attempt.executedStep) executed.push(attempt.executedStep);
      if (!attempt.ok) {
        executed.sort((a, b) => a.index - b.index);
        return emptyResult({
          ok: false,
          executed,
          stoppedAt: attempt.stoppedAt,
          stopReason: attempt.stopReason,
          nextBlockedStep: attempt.nextBlockedStep,
          error: attempt.error,
        });
      }
      outputs.push(attempt.output);
    }

    executed.sort((a, b) => a.index - b.index);
    outputs.sort((a, b) => a.index - b.index);
    zeroIndex = batchEnd;
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
