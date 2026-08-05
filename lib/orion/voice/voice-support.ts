import type { OrionVoiceSupport } from "./voice-types";

type SpeechRecognitionResultAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionResultAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

export type BrowserSpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognitionLike;

type BrowserWindowLike = Window & {
  webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  SpeechRecognition?: BrowserSpeechRecognitionCtor;
};

export type SpeechRecognitionResultEvent = SpeechRecognitionEventLike;
export type SpeechRecognitionErrorEvent = SpeechRecognitionErrorEventLike;

export function resolveSpeechRecognitionCtor(targetWindow?: Window | null): BrowserSpeechRecognitionCtor | null {
  if (!targetWindow) {
    return null;
  }

  const browserWindow = targetWindow as BrowserWindowLike;
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null;
}

export function detectOrionVoiceSupport(targetWindow?: Window | null): OrionVoiceSupport {
  const recognitionSupported = Boolean(resolveSpeechRecognitionCtor(targetWindow));
  const synthesisSupported = Boolean(targetWindow && "speechSynthesis" in targetWindow && typeof targetWindow.speechSynthesis?.speak === "function");

  if (!recognitionSupported) {
    return {
      recognitionSupported: false,
      synthesisSupported,
      message: "Voice control is not supported in this browser. You can still type your request.",
    };
  }

  return {
    recognitionSupported: true,
    synthesisSupported,
    message: synthesisSupported
      ? "Voice control is available. Press and hold to speak."
      : "Voice control is available. Spoken responses are not supported in this browser.",
  };
}
