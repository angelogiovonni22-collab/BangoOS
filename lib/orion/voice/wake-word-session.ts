import { detectWakeWord } from "./wake-word-normalizer";
import type { OrionWakeWordDetection, OrionWakeWordPolicy } from "./wake-word-types";

export function evaluateWakeWordTranscript(transcript: string, policy: OrionWakeWordPolicy): OrionWakeWordDetection {
  return detectWakeWord(transcript, policy);
}
