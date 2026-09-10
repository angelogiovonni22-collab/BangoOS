import { randomUUID } from "node:crypto";
import { recordBosInternalIntelligenceUsageEvent } from "@/lib/billing/intelligence-usage-events";
import { resolveOrionIntent as resolveOrionIntentRaw } from "./service";

function shouldDeferActiveProjectReadToServerContext(input: Parameters<typeof resolveOrionIntentRaw>[0]["input"]) {
  const projectId = input.route.projectId || input.route.pathname.match(/^\/projects\/([^/?#]+)/)?.[1] || null;
  if (!projectId) return false;

  const normalized = input.input.toLowerCase().replace(/\s+/g, " ").trim();
  const referencesCurrentProject = /\b(this project|the project|this job|the job|this page|what i have open)\b/.test(normalized);
  const asksForOverview = /\b(summary|summar(?:y|ize)|summery|overview|tell me about|details?|status)\b/.test(normalized);
  return referencesCurrentProject && asksForOverview;
}

/**
 * Meter deterministic Orion intent resolution without double-counting provider-backed fallbacks.
 * When generic resolution asks which project but the route already identifies the active project,
 * defer that turn to the server-side active-project context fallback instead of clarifying again.
 */
export async function resolveOrionIntent(
  ...args: Parameters<typeof resolveOrionIntentRaw>
): ReturnType<typeof resolveOrionIntentRaw> {
  const [params] = args;
  const result = await resolveOrionIntentRaw(...args);

  if (!result.suggestedCommand && result.requiresClarification && shouldDeferActiveProjectReadToServerContext(params.input)) {
    return {
      ...result,
      requiresClarification: false,
      message: "",
    };
  }

  if (result.suggestedCommand || result.requiresClarification) {
    await recordBosInternalIntelligenceUsageEvent(params.supabase, {
      companyId: params.workspace.companyId,
      product: "orion_text",
      operationKey: `orion-deterministic-${randomUUID()}`,
      sourceType: params.input.route.projectId ? "project" : "orion_command_center",
      sourceId: params.input.route.projectId || null,
      metadata: {
        executionMode: "bos_deterministic",
        commandId: result.suggestedCommand?.commandId || null,
        requiresClarification: Boolean(result.requiresClarification),
        providerCostStatus: "not_applicable",
      },
    });
  }

  return result;
}
