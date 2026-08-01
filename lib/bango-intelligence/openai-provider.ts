/**
 * OpenAI provider — implements the AIProvider interface using the
 * official OpenAI SDK (v7+). Server-only. Never imported in client components.
 *
 * Uses the Chat Completions API with JSON mode for deterministic structured output.
 */

import OpenAI from "openai";
import type { AIProvider, AIProviderInput, AIProviderOutput } from "./types";
import { BANGO_AI_CONFIG } from "./cost-controls";

function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set.");
  }

  return new OpenAI({
    apiKey,
    timeout: BANGO_AI_CONFIG.timeoutMs,
    maxRetries: BANGO_AI_CONFIG.maxRetries,
  });
}

export class OpenAIProvider implements AIProvider {
  readonly providerName = "openai";
  readonly modelName: string;

  constructor(modelName: string = BANGO_AI_CONFIG.model) {
    this.modelName = modelName;
  }

  async complete(input: AIProviderInput): Promise<AIProviderOutput> {
    const client = createOpenAIClient();
    const start = Date.now();

    const completion = await client.chat.completions.create({
      model: this.modelName,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
    });

    const latencyMs = Date.now() - start;
    const choice = completion.choices[0];
    const rawText = choice?.message?.content ?? "";
    const tokensInput = completion.usage?.prompt_tokens ?? null;
    const tokensOutput = completion.usage?.completion_tokens ?? null;
    const tokensUsed = tokensInput !== null && tokensOutput !== null ? tokensInput + tokensOutput : null;

    return {
      rawText,
      tokensUsed,
      model: completion.model ?? this.modelName,
      latencyMs,
    };
  }
}

/** Returns the singleton provider for the superintendent role */
export function getSuperintendentProvider(): AIProvider {
  return new OpenAIProvider(BANGO_AI_CONFIG.model);
}
