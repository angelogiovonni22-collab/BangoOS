"use client";

import { useCallback, useMemo } from "react";
import { useOrionUnifiedVoice } from "./useOrionUnifiedVoice";

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

  return useMemo(() => ({
    phase: realtime.phase,
    mode: "hands_free" as const,
    settings: {
      ...realtime.settings,
      mode: "hands_free" as const,
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
    stopPressToTalk: () => undefined,
    toggleTapListening: realtime.micActive ? stop : start,
    setMode: () => undefined,
    setSpokenResponsesEnabled: realtime.setSpokenResponsesEnabled,
    setReturnToWakeAfterCommand: () => undefined,
    setVoiceId: () => undefined,
    setVoiceRate: () => undefined,
    setVoicePitch: () => undefined,
    setVoiceVolume: () => undefined,
    // Realtime already owns spoken responses. A second browser TTS request would
    // duplicate audio and add latency.
    requestSpokenResponse: () => undefined,
    previewVoice: () => undefined,
    cancelSpeech: () => undefined,
    acknowledgeConsent: () => undefined,
    startVoiceCommandMode: start,
    endVoiceCommandMode: stop,
    confirmPendingCommand: () => undefined,
    cancelPendingCommand: () => undefined,
    stopAllListening: stop,
    retryFromError: retry,
  }), [disable, enable, realtime, retry, start, stop]);
}
