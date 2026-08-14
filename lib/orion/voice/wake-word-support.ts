import { resolveSpeechRecognitionCtor } from "./voice-support";

export function isWakeWordSupported(targetWindow?: Window | null) {
  if (!targetWindow) {
    return false;
  }

  return Boolean(resolveSpeechRecognitionCtor(targetWindow));
}
