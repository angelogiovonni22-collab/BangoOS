import OpenAI from "openai";
import { buildOrionSystemPolicy, type OrionIntelligenceRoute } from "./orion-tool-router";
import { buildUniversalBosToolCatalog } from "./universal-command-catalog";
import { getOrionModelConfig, selectOrionReasoningModel, type OrionReasoningTier } from "./model-config";

export type OrionIntelligenceContext = {
  pathname: string;
  companyId: string;
  userId: string;
  projectId?: string | null;
  customerId?: string | null;
  estimateId?: string | null;
  invoiceId?: string | null;
};

export type OrionOpenAIResult = {
  handled: boolean;
  route: OrionIntelligenceRoute | null;
  responseId: string | null;
  model: string | null;
};

function openAIKey() {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

export function isOrionOpenAIEnabled() {
  return Boolean(openAIKey()) && process.env.ORION_OPENAI_ENABLED !== "0";
}

function contextPrompt(context: OrionIntelligenceContext) {
  const known = [
    `route=${context.pathname}`,
    `companyId=${context.companyId}`,
    `userId=${context.userId}`,
    context.projectId ? `projectId=${context.projectId}` : null,
    context.customerId ? `customerId=${context.customerId}` : null,
    context.estimateId ? `estimateId=${context.estimateId}` : null,
    context.invoiceId ? `invoiceId=${context.invoiceId}` : null,
  ].filter(Boolean);

  return `Current BOS context: ${known.join(", ")}. Use this context when it removes the need for a follow-up question.`;
}

function parseToolArguments(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const wrapper = parsed as { params?: unknown };
    if (!wrapper.params || typeof wrapper.params !== "object" || Array.isArray(wrapper.params)) {
      return {};
    }

    return wrapper.params as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function resolveOrionWithOpenAI(args: {
  input: string;
  context: OrionIntelligenceContext;
  tier?: OrionReasoningTier;
}): Promise<OrionOpenAIResult> {
  const key = openAIKey();
  if (!key || process.env.ORION_OPENAI_ENABLED === "0") {
    return { handled: false, route: null, responseId: null, model: null };
  }

  const config = getOrionModelConfig();
  const model = selectOrionReasoningModel(args.tier || "balanced", config);
  const client = new OpenAI({ apiKey: key });
  const bosTools = buildUniversalBosToolCatalog().map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: false,
  }));

  const tools: Array<Record<string, unknown>> = [...bosTools];
  if (config.webSearchEnabled) {
    tools.push({ type: "web_search" });
  }

  const response = await client.responses.create({
    model,
    reasoning: { effort: args.tier === "deep" ? "medium" : "low" },
    instructions: `${buildOrionSystemPolicy()}\n${contextPrompt(args.context)}`,
    input: args.input,
    tools: tools as never,
    tool_choice: "auto",
    store: false,
  });

  const functionCall = response.output.find((item) => item.type === "function_call");
  if (functionCall && functionCall.type === "function_call") {
    return {
      handled: true,
      route: {
        kind: "bos_command",
        toolName: functionCall.name,
        params: parseToolArguments(functionCall.arguments),
      },
      responseId: response.id,
      model,
    };
  }

  const answer = response.output_text?.trim();
  if (answer) {
    return {
      handled: true,
      route: { kind: "conversation", answer },
      responseId: response.id,
      model,
    };
  }

  return {
    handled: false,
    route: null,
    responseId: response.id,
    model,
  };
}
