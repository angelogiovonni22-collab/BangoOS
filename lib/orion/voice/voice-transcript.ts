import type { OrionVoiceCandidate, OrionVoiceConfirmationPhrase } from "./voice-types";

const CONFIRM_PHRASES = ["confirm", "yes continue", "yes, continue", "approve"];
const CANCEL_PHRASES = ["cancel", "no stop", "no, stop"];

function normalize(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function sanitizeTranscript(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export function parseVoiceConfirmationPhrase(input: string): OrionVoiceConfirmationPhrase {
  const normalized = normalize(input);

  if (!normalized) {
    return null;
  }

  if (CONFIRM_PHRASES.some((phrase) => normalized === normalize(phrase))) {
    return "confirm";
  }

  if (CANCEL_PHRASES.some((phrase) => normalized === normalize(phrase))) {
    return "cancel";
  }

  return null;
}

export function isCancelPhrase(input: string) {
  return parseVoiceConfirmationPhrase(input) === "cancel";
}

export function resolveSpokenCandidate(transcript: string, candidates: OrionVoiceCandidate[]) {
  const normalized = normalize(transcript);
  if (!normalized || candidates.length === 0) {
    return null;
  }

  const numericMatch = normalized.match(/\b([1-9][0-9]*)\b/);
  if (numericMatch) {
    const index = Number(numericMatch[1]) - 1;
    if (index >= 0 && index < candidates.length) {
      return candidates[index] || null;
    }
  }

  for (const candidate of candidates) {
    const label = normalize(candidate.label);
    if (label && (normalized.includes(label) || label.includes(normalized))) {
      return candidate;
    }
  }

  return null;
}
