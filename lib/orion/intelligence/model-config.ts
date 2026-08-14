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

const LEGACY_MODEL_ALIASES: Record<string, string> = {
  "gpt-5.6-sol": DEFAULT_REASONING_MODEL,
  "gpt-5.6-terra": DEFAULT_FAST_MODEL,
  "gpt-realtime-2.1": DEFAULT_REALTIME_MODEL,
};

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeModel(value: string | null, fallback: string) {
  if (!value) return fallback;
  return LEGACY_MODEL_ALIASES[value] || value;
}

export function getOrionModelConfig(): OrionModelConfig {
  return {
    reasoningModel: normalizeModel(readEnv("ORION_REASONING_MODEL"), DEFAULT_REASONING_MODEL),
    fastModel: normalizeModel(readEnv("ORION_FAST_MODEL"), DEFAULT_FAST_MODEL),
    realtimeModel: normalizeModel(readEnv("ORION_REALTIME_MODEL"), DEFAULT_REALTIME_MODEL),
    webSearchEnabled: readEnv("ORION_WEB_SEARCH_ENABLED") !== "0",
  };
}

export function selectOrionReasoningModel(tier: OrionReasoningTier, config = getOrionModelConfig()) {
  if (tier === "fast") {
    return config.fastModel;
  }

  return config.reasoningModel;
}
