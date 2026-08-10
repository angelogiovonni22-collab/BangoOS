import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionIntentInput, OrionIntentResult } from "@/lib/orion/intent-engine";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import { isOrionOpenAIEnabled, resolveOrionWithOpenAI } from "./openai-intelligence";
import { resolveBosActionFromIntelligenceRoute } from "./orion-tool-router";

export type OrionIntelligenceIntentFallback = {
  intent: OrionIntentResult;
  statusCategory: string;
};

function passiveIntent(message: string): OrionIntentResult {
  return {
    resolvedIntent: null,
    resolvedEntity: null,
    confidence: 1,
    candidates: [],
    suggestedCommand: null,
    commandPreview: null,
    requiresClarification: false,
    message,
  };
}

function commandIntentKind(commandId: string): OrionIntentResult["resolvedIntent"] {
  if (commandId.endsWith(".create")) return "create";
  if (commandId.endsWith(".open")) return "open";
  if (commandId.includes("assign")) return "assign";
  if (commandId.includes("send")) return "send";
  if (commandId.includes("complete")) return "complete";
  if (commandId.includes("archive")) return "archive";
  if (commandId.includes("payment")) return "record_payment";
  if (commandId.includes("deposit")) return "record_deposit";
  if (commandId.includes("update")) return "update";
  return "view";
}

function entityTypeForIntent(entityType: string): OrionIntentResult["suggestedCommand"] extends { entityType: infer T } ? T : never {
  const supported = new Set([
    "workflow", "customer", "project", "estimate", "invoice", "employee", "crew", "task",
    "inspection", "permit", "communication", "document", "timeline", "dashboard", "settings", "operations",
  ]);

  return (supported.has(entityType) ? entityType : null) as OrionIntentResult["suggestedCommand"] extends { entityType: infer T } ? T : never;
}

export async function resolveOrionIntelligenceIntentFallback(args: {
  input: OrionIntentInput;
  workspace: WorkspaceContext;
  conversationOnly?: boolean;
}): Promise<OrionIntelligenceIntentFallback | null> {
  if (!isOrionOpenAIEnabled()) {
    return null;
  }

  const result = await resolveOrionWithOpenAI({
    input: args.input.input,
    tier: "balanced",
    conversationOnly: args.conversationOnly,
    context: {
      pathname: args.input.route.pathname,
      companyId: args.workspace.companyId,
      userId: args.workspace.userId,
      projectId: args.input.route.projectId,
      customerId: args.input.route.customerId,
      estimateId: args.input.route.estimateId,
      invoiceId: args.input.route.invoiceId,
    },
  });

  if (!result.handled || !result.route) {
    return null;
  }

  if (result.route.kind === "conversation") {
    return {
      intent: passiveIntent(result.route.answer),
      statusCategory: "workflow_complete",
    };
  }

  if (result.route.kind === "clarify") {
    return {
      intent: passiveIntent(result.route.question),
      statusCategory: "workflow_collecting",
    };
  }

  if (result.route.kind === "web_search") {
    return {
      intent: passiveIntent(`I can search for ${result.route.query}, but I did not receive a completed web answer.`),
      statusCategory: "workflow_complete",
    };
  }

  if (args.conversationOnly) {
    return {
      intent: passiveIntent("I heard you. What would you like to know?"),
      statusCategory: "workflow_complete",
    };
  }

  const action = resolveBosActionFromIntelligenceRoute(result.route);
  if (!action) {
    return {
      intent: passiveIntent("That BOS action is not currently available."),
      statusCategory: "workflow_complete",
    };
  }

  const command = createOrionCommandRegistry().getById(action.commandId);
  if (!command || command.coverage.status === "unsupported") {
    return {
      intent: passiveIntent("That BOS action is not currently available."),
      statusCategory: "workflow_complete",
    };
  }

  const validation = command.validate(action.params);
  if (!validation.ok) {
    if (command.id === "estimate.create") {
      return {
        intent: passiveIntent("Okay, starting a new estimate. What would you like to add first: the customer, project, estimate name, scope of work, or pricing?"),
        statusCategory: "workflow_collecting",
      };
    }

    const detail = validation.errors.filter(Boolean).join(" ");
    return {
      intent: passiveIntent(detail
        ? `I can do that, but I need a little more information first. ${detail}`
        : "I can do that, but I need a little more information first."),
      statusCategory: "workflow_collecting",
    };
  }

  const normalizedParams = validation.normalizedParams || action.params;
  const entityType = entityTypeForIntent(command.entityType);

  return {
    intent: {
      resolvedIntent: commandIntentKind(command.id),
      resolvedEntity: null,
      confidence: 0.99,
      candidates: [],
      suggestedCommand: {
        commandId: command.id,
        params: normalizedParams,
        entityType,
        entityId: null,
      },
      commandPreview: {
        commandId: command.id,
        target: command.name,
        permission: command.requiredPermissions,
        confirmationLevel: command.confirmationLevel,
        expectedOutcome: command.description,
        eventsThatWillPublish: command.eventContract?.expectedEvents || [],
      },
      requiresClarification: false,
      message: `I can handle that with ${command.name}.`,
    },
    statusCategory: "intelligence_bos_command",
  };
}
