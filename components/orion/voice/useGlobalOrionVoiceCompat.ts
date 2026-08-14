"use client";

import { useCallback, useMemo } from "react";
import { useOrionUnifiedVoice } from "./useOrionUnifiedVoice";

type LegacyCompatibleCaptureMode = "push_to_talk" | "tap_to_listen" | "hands_free";

/**
 * Compatibility facade for older Orion UI surfaces that still consume the
 * GlobalOrionVoiceProvider-shaped API. The facade deliberately does not expose
 * Realtime transcripts as legacy final transcripts; doing so would cause those
 * surfaces to run the old intent router a second time after Realtime has already
 * handled the user's turn.
 */
export function useGlobalOrionVoice() {
  const realtime = useOrionUnifiedVoice();

  const start = useCallback(() => {
    void realtime.start();
  }, [realtime]);

  const stop = useCallback(() => {
    void realtime.stop();
  }, [realtime]);

  const retry = useCallback(() => {
    void realtime.retry();
  }, [realtime]);

  const enable = useCallback(() => {
    realtime.enableVoice();
  }, [realtime]);

  const disable = useCallback(() => {
    void realtime.disableVoice();
  }, [realtime]);

  const noop = useCallback((...args: unknown[]) => {
    void args;
  }, []);

  const compatibleMode = "hands_free" as LegacyCompatibleCaptureMode;

  return useMemo(() => ({
    phase: realtime.phase,
    mode: compatibleMode,
    settings: {
      ...realtime.settings,
      mode: compatibleMode,
      spokenResponsesEnabled: realtime.settings.spokenResponsesEnabled,
      returnToWakeAfterCommand: false,
    },
    supportMessage: realtime.supportMessage,
    micActive: realtime.micActive,
    wakeListening: false,
    commandSessionActive: realtime.micActive,
    // Realtime is the sole owner of voice-turn execution. Never feed its final
    // transcript into the legacy command-center transcript effect.
    interimTranscript: "",
    finalTranscript: "",
    resultMessage: null,
    statusMessage: realtime.statusMessage,
    errorCategory: realtime.realtimeState === "error" ? "speech_recognition_error" as const : null,
    intentResult: null,
    pendingConfirmation: null,
    canUseHandsFree: true,
    reactivationRequired: false,
    consentRequired: false,
    speaking: realtime.speaking,
    voiceLevel: realtime.voiceLevel,
    availableVoices: [],
    enableGlobalVoice: enable,
    disableGlobalVoice: disable,
    startPressToTalk: start,
    stopPressToTalk: noop,
    toggleTapListening: realtime.micActive ? stop : start,
    setMode: noop,
    setSpokenResponsesEnabled: realtime.setSpokenResponsesEnabled,
    setReturnToWakeAfterCommand: noop,
    setVoiceId: noop,
    setVoiceRate: noop,
    setVoicePitch: noop,
    setVoiceVolume: noop,
    // Realtime already owns spoken responses. A second browser TTS request would
    // duplicate audio and add latency.
    requestSpokenResponse: noop,
    previewVoice: noop,
    cancelSpeech: noop,
    acknowledgeConsent: noop,
    startVoiceCommandMode: start,
    endVoiceCommandMode: stop,
    confirmPendingCommand: noop,
    cancelPendingCommand: noop,
    stopAllListening: stop,
    retryFromError: retry,
  }), [compatibleMode, disable, enable, noop, realtime, retry, start, stop]);
}
