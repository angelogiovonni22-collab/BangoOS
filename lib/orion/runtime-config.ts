export const ORION_VOICE_FREEZE_MESSAGE = "Voice temporarily disabled for stabilization.";

export function isOrionVoiceAutomationEnabled() {
  return process.env.NEXT_PUBLIC_ORION_VOICE_AUTOMATION === "1";
}
