import { randomUUID } from "node:crypto";
import { recordBosIntelligenceUsageEvent } from "@/lib/billing/intelligence-usage-events";
import { createOrionCommandRegistry } from "@/lib/orion/commands";
import type { OrionIntentInput, OrionIntentResult } from "@/lib/orion/intent-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import { beginEstimateVoiceWorkflowSession } from "@/lib/orion/workflows/estimate-voice-workflow";
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

function conversationSafetyFallback(): OrionIntelligenceIntentFallback {
  return {
    intent: passiveIntent("I heard you. What would you like to know?"),
    statusCategory: "workflow_complete",
  };
}

function projectIdFromRoute(input: OrionIntentInput) {
  if (input.route.projectId) return input.route.projectId;
  const match = input.route.pathname.match(/^\/projects\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function isActiveProjectReadRequest(input: string) {
  const normalized = input.toLowerCase().replace(/\s+/g, " ").trim();
  const referencesCurrentProject = /\b(this project|the project|this job|the job|this page|what i have open)\b/.test(normalized);
  const asksForOverview = /\b(summary|summar(?:y|ize)|summery|overview|tell me about|details?|status)\b/.test(normalized);
  return referencesCurrentProject && asksForOverview;
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

async function resolveNativeActiveProjectSummary(args: {
  input: OrionIntentInput;
  workspace: WorkspaceContext;
}): Promise<OrionIntelligenceIntentFallback | null> {
  const projectId = projectIdFromRoute(args.input);
  if (!projectId || !isActiveProjectReadRequest(args.input.input)) return null;

  try {
    const admin = createAdminClient();
    const { data: project, error } = await admin
      .from("projects")
      .select("id,name,project_number,project_type,status,description,address_line_1,city,state,postal_code,estimated_cost,contract_amount,estimated_start_date,estimated_end_date,actual_end_date")
      .eq("company_id", args.workspace.companyId)
      .eq("id", projectId)
      .maybeSingle();

    if (error || !project) return null;

    const location = [project.address_line_1, project.city, project.state, project.postal_code].filter(Boolean).join(", ");
    const facts = [
      project.status ? `Status: ${project.status}.` : null,
      project.project_type ? `Type: ${project.project_type}.` : null,
      project.description ? `Scope: ${project.description}.` : null,
      location ? `Jobsite: ${location}.` : null,
      money(project.contract_amount) ? `Contract amount: ${money(project.contract_amount)}.` : null,
      money(project.estimated_cost) ? `Estimated cost: ${money(project.estimated_cost)}.` : null,
      project.estimated_start_date ? `Estimated start: ${project.estimated_start_date}.` : null,
      project.estimated_end_date ? `Estimated completion: ${project.estimated_end_date}.` : null,
      project.actual_end_date ? `Actual completion: ${project.actual_end_date}.` : null,
    ].filter(Boolean);

    const number = project.project_number ? ` (${project.project_number})` : "";
    const message = facts.length
      ? `${project.name}${number}: ${facts.join(" ")}`
      : `${project.name}${number} is the project currently open in B.O.S.`;

    await recordBosIntelligenceUsageEvent({
      companyId: args.workspace.companyId,
      actorUserId: args.workspace.userId,
      product: "orion_text",
      outcome: "succeeded",
      operationKey: `orion-project-context-${randomUUID()}`,
      internalNonBillable: true,
      sourceType: "project",
      sourceId: project.id,
      metadata: {
        executionMode: "bos_native_project_context",
        activeProjectContextLoaded: true,
        providerCostStatus: "not_applicable",
      },
    });

    return {
      intent: passiveIntent(message),
      statusCategory: "workflow_complete",
    };
  } catch {
    return null;
  }
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
  const nativeProjectSummary = await resolveNativeActiveProjectSummary(args);
  if (nativeProjectSummary) return nativeProjectSummary;

  if (!isOrionOpenAIEnabled()) {
    return args.conversationOnly ? conversationSafetyFallback() : null;
  }

  let result;
  try {
    result = await resolveOrionWithOpenAI({
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
  } catch (error) {
    if (args.conversationOnly) {
      return conversationSafetyFallback();
    }
    throw error;
  }

  if (!result.handled || !result.route) {
    return args.conversationOnly ? conversationSafetyFallback() : null;
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
    return conversationSafetyFallback();
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
      beginEstimateVoiceWorkflowSession(args.workspace);
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
