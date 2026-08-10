export type OrionReasoningTier = "fast" | "balanced" | "deep";

export type OrionModelConfig = {
  reasoningModel: string;
  fastModel: string;
  realtimeModel: string;
  webSearchEnabled: boolean;
};

const DEFAULT_REASONING_MODEL = "gpt-5.6-sol";
const DEFAULT_FAST_MODEL = "gpt-5.6-terra";
const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";

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
