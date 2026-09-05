import { getUniversalBosCommandByToolName } from "@/lib/orion/intelligence";
import { buildOrionAutonomyPlan } from "./planner";

export type OrionAutonomyPlanRequestStep = {
  toolName?: unknown;
  params?: unknown;
};

export type OrionAutonomyPlanRequestResult =
  | { ok: true; plan: ReturnType<typeof buildOrionAutonomyPlan> }
  | { ok: false; error: string };

function normalizeParams(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function buildOrionAutonomyPlanFromToolSteps(value: unknown): OrionAutonomyPlanRequestResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "At least one BOS tool step is required." };
  }
  if (value.length > 32) {
    return { ok: false, error: "An Orion autonomy plan may contain at most 32 proposed steps." };
  }

  const resolved = [] as Parameters<typeof buildOrionAutonomyPlan>[0];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index] as OrionAutonomyPlanRequestStep;
    const toolName = typeof raw?.toolName === "string" ? raw.toolName.trim() : "";
    if (!toolName) return { ok: false, error: `Step ${index + 1} is missing a BOS tool name.` };

    const command = getUniversalBosCommandByToolName(toolName);
    if (!command || command.coverage.status === "unsupported") {
      return { ok: false, error: `Step ${index + 1} uses an unavailable BOS tool.` };
    }

    resolved.push({ command, params: normalizeParams(raw.params) });
  }

  return { ok: true, plan: buildOrionAutonomyPlan(resolved) };
}
