export type OrionRealtimeVoiceControl = "mute_output" | "unmute_output" | "disable_voice" | null;

function normalizeVoiceControl(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(hey|okay)\s+orion\s+/, "")
    .replace(/^orion\s+/, "");
}

export function detectRealtimeVoiceControl(input: string): OrionRealtimeVoiceControl {
  const normalized = normalizeVoiceControl(input);
  const disablePhrases = new Set([
    "disable",
    "disable orion",
    "turn orion off",
    "turn off orion",
    "shut orion off",
    "shut off orion",
  ]);
  const mutePhrases = new Set([
    "disable voice",
    "mute voice",
    "mute your voice",
    "stop speaking",
    "turn voice off",
    "turn your voice off",
  ]);
  const unmutePhrases = new Set([
    "enable voice",
    "unmute voice",
    "unmute your voice",
    "start speaking",
    "turn voice on",
    "turn your voice on",
  ]);

  if (disablePhrases.has(normalized)) return "disable_voice";
  if (mutePhrases.has(normalized)) return "mute_output";
  if (unmutePhrases.has(normalized)) return "unmute_output";
  return null;
}
