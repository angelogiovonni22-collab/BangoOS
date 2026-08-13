export const ORION_VOICE_ACCENTS = ["american", "australian", "british", "irish", "neutral"] as const;
export const ORION_VOICE_TONES = ["warm", "calm", "confident", "conversational", "professional", "energetic"] as const;
export type OrionVoiceAccent = (typeof ORION_VOICE_ACCENTS)[number];
export type OrionVoiceTone = (typeof ORION_VOICE_TONES)[number];
export type OrionVoiceStyleProfile = { accent: OrionVoiceAccent; tone: OrionVoiceTone };
export type OrionVoiceProfileCommand = { type: "preview"; profile: Partial<OrionVoiceStyleProfile> } | { type: "save" } | { type: "reset" } | null;
export const DEFAULT_ORION_VOICE_STYLE: OrionVoiceStyleProfile = { accent: "american", tone: "conversational" };

export function isOrionVoiceStyleProfile(value: unknown): value is OrionVoiceStyleProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<OrionVoiceStyleProfile>;
  return ORION_VOICE_ACCENTS.includes(profile.accent as OrionVoiceAccent) && ORION_VOICE_TONES.includes(profile.tone as OrionVoiceTone);
}

export function detectRealtimeVoiceProfileCommand(input: string): OrionVoiceProfileCommand {
  const normalized = input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(save|keep|remember) (this|that) voice\b/.test(normalized) || /\bsave (this|that) accent\b/.test(normalized)) return { type: "save" };
  if (/\b(reset|clear) (my |the )?(saved )?voice( style| preference)?\b/.test(normalized)) return { type: "reset" };
  const accent = ORION_VOICE_ACCENTS.find((value) => normalized.includes(`${value} accent`));
  const tone = ORION_VOICE_TONES.find((value) => normalized.includes(`${value} tone`) || normalized.includes(`sound ${value}`));
  if (/\b(speak|talk|sound|try|use|switch)\b/.test(normalized) && (accent || tone)) return { type: "preview", profile: { accent, tone } };
  return null;
}

export function voiceStyleInstruction(profile: OrionVoiceStyleProfile) {
  return `Voice preference: speak with a ${profile.accent} English accent and a ${profile.tone} tone. Keep pronunciation clear and do not imitate a specific person.`;
}
