export const ORION_VOICE_FREEZE_MESSAGE = "Orion Voice is temporarily paused by system configuration.";

/**
 * Orion voice is operational by default. Set NEXT_PUBLIC_ORION_VOICE_AUTOMATION=0
 * to immediately disable microphone automation without changing application code.
 */
export function isOrionVoiceAutomationEnabled() {
  return process.env.NEXT_PUBLIC_ORION_VOICE_AUTOMATION !== "0";
}
