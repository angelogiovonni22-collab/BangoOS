import type { OrionCommandDefinition } from "@/lib/orion/commands/types";
import {
  ORION_MAX_AUTONOMOUS_STEPS,
  autonomyModeForCommand,
  classifyOrionCommandRisk,
  type OrionAutonomyMode,
  type OrionAutonomyRisk,
} from "./policy";

export type OrionAutonomyPlanInputStep = {
  command: Pick<OrionCommandDefinition, "id" | "coverage" | "undoCapable" | "confirmationLevel">;
  params?: Record<string, unknown>;
};

export type OrionAutonomyPlanStep = {
  index: number;
  commandId: string;
  params: Record<string, unknown>;
  risk: OrionAutonomyRisk;
  mode: OrionAutonomyMode;
  canAutoExecute: boolean;
  stopReason: "confirmation_required" | "review_required" | "step_limit" | null;
};

export type OrionAutonomyPlan = {
  steps: OrionAutonomyPlanStep[];
  autonomousPrefixLength: number;
  requiresUserInteraction: boolean;
  nextBlockedStep: OrionAutonomyPlanStep | null;
};

export function buildOrionAutonomyPlan(input: OrionAutonomyPlanInputStep[]): OrionAutonomyPlan {
  const steps = input.map((item, zeroIndex): OrionAutonomyPlanStep => {
    const index = zeroIndex + 1;
    const risk = classifyOrionCommandRisk(item.command);
    const mode = autonomyModeForCommand(item.command);
    const overLimit = index > ORION_MAX_AUTONOMOUS_STEPS;
    const stopReason = overLimit
      ? "step_limit"
      : mode === "confirm"
        ? "confirmation_required"
        : mode === "review"
          ? "review_required"
          : null;

    return {
      index,
      commandId: item.command.id,
      params: item.params ?? {},
      risk,
      mode,
      canAutoExecute: !overLimit && mode === "auto",
      stopReason,
    };
  });

  let autonomousPrefixLength = 0;
  for (const step of steps) {
    if (!step.canAutoExecute) break;
    autonomousPrefixLength += 1;
  }

  const nextBlockedStep = steps[autonomousPrefixLength] ?? null;
  return {
    steps,
    autonomousPrefixLength,
    requiresUserInteraction: Boolean(nextBlockedStep),
    nextBlockedStep,
  };
}

export function canAdvanceOrionAutonomyPlan(args: {
  plan: OrionAutonomyPlan;
  completedSteps: number;
  lastResultOk: boolean;
  lastResultVerified?: boolean;
}) {
  if (args.completedSteps < 0 || args.completedSteps >= args.plan.steps.length) return false;
  if (!args.lastResultOk || args.lastResultVerified === false) return false;

  const nextStep = args.plan.steps[args.completedSteps];
  return Boolean(nextStep?.canAutoExecute);
}
