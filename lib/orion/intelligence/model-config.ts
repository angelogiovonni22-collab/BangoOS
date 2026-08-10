export type OrionReasoningTier = "fast" | "balanced" | "deep";

export type OrionModelConfig = {
  reasoningModel: string;
  fastModel: string;
  realtimeModel: string;
  webSearchEnabled: boolean;
};

// Keep defaults pinned to public OpenAI API model identifiers. Environment
// variables can still override these values for controlled rollouts.
const DEFAULT_REASONING_MODEL = "gpt-5.1";
const DEFAULT_FAST_MODEL = "gpt-5-mini";
const DEFAULT_REALTIME_MODEL = "gpt-realtime";

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getOrionModelConfig(): OrionModelConfig {
  return {
    reasoningModel: readEnv("ORION_REASONING_MODEL") || DEFAULT_REASONING_MODEL,
    fastModel: readEnv("ORION_FAST_MODEL") || DEFAULT_FAST_MODEL,
    realtimeModel: readEnv("ORION_REALTIME_MODEL") || DEFAULT_REALTIME_MODEL,
    webSearchEnabled: readEnv("ORION_WEB_SEARCH_ENABLED") !== "0",
  };
}

export function selectOrionReasoningModel(tier: OrionReasoningTier, config = getOrionModelConfig()) {
  if (tier === "fast") {
    return config.fastModel;
  }

  return config.reasoningModel;
}
