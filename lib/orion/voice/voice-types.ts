export type OrionVoiceState =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "processing"
  | "clarification"
  | "confirmation_required"
  | "executing"
  | "success"
  | "error"
  | "unsupported";

export type OrionVoiceErrorCategory =
  | "microphone_permission_denied"
  | "microphone_unavailable"
  | "speech_recognition_unsupported"
  | "speech_recognition_error"
  | "no_speech"
  | "context_unavailable"
  | "intent_no_match"
  | "intent_ambiguous"
  | "permission_denied"
  | "confirmation_required"
  | "command_validation_failed"
  | "command_execution_failed"
  | "navigation_failed"
  | "network_error";

export type OrionVoiceCaptureMode = "push_to_talk" | "tap_to_listen";

export type OrionVoiceResultTone = "success" | "info" | "warning" | "error";

export type OrionVoiceCandidate = {
  entityType: string;
  entityId: string;
  label: string;
  subtitle?: string;
  score?: number;
};

export type OrionVoiceSupport = {
  recognitionSupported: boolean;
  synthesisSupported: boolean;
  message: string;
};

export type OrionVoiceConfirmationPhrase = "confirm" | "cancel" | null;

export type OrionVoiceSessionOptions = {
  lang?: string;
  muteStorageKey?: string;
  onPermissionDenied?: () => void;
  onFinalTranscript?: (transcript: string) => void;
  onErrorCategory?: (category: OrionVoiceErrorCategory, message: string) => void;
  silenceTimeoutMs?: number;
};

export type OrionVoiceSessionSnapshot = {
  state: OrionVoiceState;
  interimTranscript: string;
  finalTranscript: string;
  errorMessage: string | null;
  errorCategory: OrionVoiceErrorCategory | null;
  muted: boolean;
  support: OrionVoiceSupport;
};
