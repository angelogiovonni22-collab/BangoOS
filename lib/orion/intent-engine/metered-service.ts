import { randomUUID } from "node:crypto";
import { recordBosIntelligenceUsageEvent } from "@/lib/billing/intelligence-usage-events";
import { resolveOrionIntent as resolveOrionIntentRaw } from "./service";

/**
 * Meter deterministic Orion intent resolution without double-counting provider-backed fallbacks.
 * If the deterministic engine produces no actionable/clarifying result, the command-center route
 * may continue into OpenAI, whose provider telemetry is recorded separately.
 */
export async function resolveOrionIntent(
  ...args: Parameters<typeof resolveOrionIntentRaw>
): ReturnType<typeof resolveOrionIntentRaw> {
  const [params] = args;
  const result = await resolveOrionIntentRaw(...args);

  if (result.suggestedCommand || result.requiresClarification) {
    await recordBosIntelligenceUsageEvent({
      companyId: params.workspace.companyId,
      actorUserId: params.workspace.userId,
      product: "orion_text",
      outcome: "succeeded",
      operationKey: `orion-deterministic-${randomUUID()}`,
      internalNonBillable: true,
      sourceType: "orion_command_center",
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
