"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OrionRealtimeClient } from "@/lib/orion/realtime/client";
import type { OrionRealtimeConnectionState, OrionRealtimeServerEvent } from "@/lib/orion/realtime/types";
import { isOrionVoiceAutomationEnabled, ORION_VOICE_FREEZE_MESSAGE } from "@/lib/orion/runtime-config";
import { useGlobalOrionVoice } from "./GlobalOrionVoiceProvider";

export type OrionVoiceEngine = "realtime" | "browser";

export type OrionUnifiedVoiceController = {
  engine: OrionVoiceEngine;
  realtimeState: OrionRealtimeConnectionState;
  phase: string;
  statusMessage: string;
  supportMessage: string;
  micActive: boolean;
  speaking: boolean;
  interimTranscript: string;
  finalTranscript: string;
  voiceLevel: number;
  mode: ReturnType<typeof useGlobalOrionVoice>["mode"];
  settings: ReturnType<typeof useGlobalOrionVoice>["settings"];
  start: () => Promise<void>;
  stop: () => Promise<void>;
  retry: () => Promise<void>;
  setSpokenResponsesEnabled: (enabled: boolean) => void;
  enableVoice: () => void;
  disableVoice: () => Promise<void>;
};

function eventTranscript(event: OrionRealtimeServerEvent) {
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    return typeof event.transcript === "string" ? event.transcript.trim() : "";
  }
  return "";
}

function eventAssistantTranscript(event: OrionRealtimeServerEvent) {
  if (event.type === "response.output_audio_transcript.done") {
    return typeof event.transcript === "string" ? event.transcript.trim() : "";
  }
  return "";
}

export function useOrionUnifiedVoice(): OrionUnifiedVoiceController {
  const browser = useGlobalOrionVoice();
  const browserRef = useRef(browser);
  const router = useRouter();
  const clientRef = useRef<OrionRealtimeClient | null>(null);
  const fallbackStartedRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const browserWasEnabledRef = useRef(false);
  const voiceAutomationEnabled = isOrionVoiceAutomationEnabled();
  const [engine, setEngine] = useState<OrionVoiceEngine>("browser");
  const [realtimeState, setRealtimeState] = useState<OrionRealtimeConnectionState>("idle");
  const [realtimePhase, setRealtimePhase] = useState("idle");
  const [realtimeStatus, setRealtimeStatus] = useState("Realtime voice is ready.");
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [realtimeFinalTranscript, setRealtimeFinalTranscript] = useState("");
  const [realtimeInterimTranscript] = useState("");
  const [realtimeSpeaking, setRealtimeSpeaking] = useState(false);

  useEffect(() => {
    browserRef.current = browser;
  }, [browser]);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const beginBrowserCapture = useCallback(() => {
    const current = browserRef.current;
    if (current.mode === "push_to_talk") {
      current.startPressToTalk();
    } else {
      current.toggleTapListening();
    }
  }, []);

  const startCurrentBrowserCapture = useCallback(() => {
    const current = browserRef.current;
    if (!current.settings.enabled) {
      current.enableGlobalVoice();
      fallbackTimerRef.current = window.setTimeout(beginBrowserCapture, 100);
      return;
    }

    if (current.mode === "hands_free") {
      current.setMode("tap_to_listen");
      fallbackTimerRef.current = window.setTimeout(beginBrowserCapture, 100);
      return;
    }

    beginBrowserCapture();
  }, [beginBrowserCapture]);

  const fallbackToBrowser = useCallback((reason?: string) => {
    if (fallbackStartedRef.current) return;
    fallbackStartedRef.current = true;
    clearFallbackTimer();
    clientRef.current = null;
    setEngine("browser");
    setRealtimeSpeaking(false);
    setRealtimePhase("fallback");
    const notice = reason || "Realtime voice is unavailable. Using browser voice fallback.";
    setRealtimeStatus(notice);
    setFallbackNotice(notice);
    fallbackTimerRef.current = window.setTimeout(startCurrentBrowserCapture, 75);
  }, [clearFallbackTimer, startCurrentBrowserCapture]);

  const stop = useCallback(async () => {
    clearFallbackTimer();
    fallbackStartedRef.current = true;
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      await client.disconnect();
    }
    setRealtimeSpeaking(false);
    setRealtimeState("closed");
    setRealtimePhase("idle");
    setRealtimeStatus("Realtime conversation ended.");
    setFallbackNotice(null);
    setEngine("browser");

    if (browserWasEnabledRef.current && !browserRef.current.settings.enabled) {
      browserRef.current.enableGlobalVoice();
    }
    browserWasEnabledRef.current = false;
  }, [clearFallbackTimer]);

  const start = useCallback(async () => {
    if (!voiceAutomationEnabled) {
      browser.stopAllListening();
      setEngine("browser");
      setRealtimeState("closed");
      setRealtimePhase("disabled");
      setRealtimeStatus(ORION_VOICE_FREEZE_MESSAGE);
      setFallbackNotice(ORION_VOICE_FREEZE_MESSAGE);
      return;
    }

    if (realtimeState === "requesting_microphone" || realtimeState === "connecting" || realtimeState === "connected") {
      return;
    }

    clearFallbackTimer();
    fallbackStartedRef.current = false;
    setFallbackNotice(null);
    browserWasEnabledRef.current = browser.settings.enabled;
    browser.stopAllListening();
    if (browser.settings.enabled) {
      browser.disableGlobalVoice();
    }
    setEngine("realtime");
    setRealtimePhase("starting");
    setRealtimeStatus("Starting Orion Realtime voice...");
    setRealtimeFinalTranscript("");

    const client = new OrionRealtimeClient({
      onStateChange: (state) => {
        setRealtimeState(state);
        if (state === "requesting_microphone") {
          setRealtimePhase("starting");
          setRealtimeStatus("Starting microphone...");
        } else if (state === "connecting") {
          setRealtimePhase("starting");
          setRealtimeStatus("Connecting Orion Realtime...");
        } else if (state === "connected") {
          setRealtimePhase("listening");
          setRealtimeStatus("Orion Realtime is listening.");
        } else if (state === "error") {
          setRealtimePhase("error");
        }
      },
      onEvent: (event) => {
        const userTranscript = eventTranscript(event);
        if (userTranscript) {
          setRealtimeFinalTranscript(userTranscript);
          setRealtimePhase("understanding");
          setRealtimeStatus("Understanding...");
        }

        const assistantTranscript = eventAssistantTranscript(event);
        if (assistantTranscript) {
          setRealtimeStatus(assistantTranscript);
        }

        if (event.type === "response.created") {
          setRealtimePhase("understanding");
          setRealtimeStatus("Orion is thinking...");
        } else if (event.type === "response.output_audio.delta" || event.type === "output_audio_buffer.started") {
          setRealtimeSpeaking(true);
          setRealtimePhase("speaking");
          setRealtimeStatus("Orion is speaking.");
        } else if (event.type === "response.output_audio.done" || event.type === "output_audio_buffer.stopped" || event.type === "response.done") {
          setRealtimeSpeaking(false);
          setRealtimePhase("listening");
          setRealtimeStatus("Orion Realtime is listening.");
        }
      },
      onToolResult: (result) => {
        setRealtimePhase(result.confirmationRequired ? "confirmation_required" : result.ok ? "success" : "error");
        setRealtimeStatus(result.userMessage);
        if (result.ok && result.href && result.href.startsWith("/")) {
          router.push(result.href);
        }
      },
      onError: (error) => {
        fallbackToBrowser(`${error.message} Using browser voice fallback.`);
      },
    });

    clientRef.current = client;
    try {
      await client.connect();
    } catch (error) {
      if (clientRef.current === client) {
        clientRef.current = null;
      }
      const message = error instanceof Error ? error.message : "Realtime voice is unavailable.";
      fallbackToBrowser(`${message} Using browser voice fallback.`);
    }
  }, [browser, clearFallbackTimer, fallbackToBrowser, realtimeState, router, voiceAutomationEnabled]);

  const retry = useCallback(async () => {
    await stop();
    await start();
  }, [start, stop]);

  const disableVoice = useCallback(async () => {
    browserWasEnabledRef.current = false;
    await stop();
    browserRef.current.stopAllListening();
    browserRef.current.disableGlobalVoice();
  }, [stop]);

  useEffect(() => {
    if (engine !== "realtime" || realtimeState !== "closed" || !clientRef.current || fallbackStartedRef.current) return;
    fallbackToBrowser("Realtime connection ended unexpectedly. Using browser voice fallback.");
  }, [engine, fallbackToBrowser, realtimeState]);

  useEffect(() => {
    const handleOffline = () => {
      if (engine === "realtime") {
        setRealtimeStatus("Network connection lost. Orion will fall back if the Realtime session closes.");
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && engine === "realtime" && realtimeState === "connected") {
        setRealtimeStatus("Orion Realtime is listening.");
      }
    };

    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [engine, realtimeState]);

  useEffect(() => {
    if (voiceAutomationEnabled) return;
    clearFallbackTimer();
    browser.stopAllListening();
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      void client.disconnect();
    }
  }, [browser, clearFallbackTimer, voiceAutomationEnabled]);

  useEffect(() => () => {
    clearFallbackTimer();
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      void client.disconnect();
    }
  }, [clearFallbackTimer]);

  return useMemo(() => {
    const effectiveEngine: OrionVoiceEngine = voiceAutomationEnabled ? engine : "browser";
    const realtimeActive = effectiveEngine === "realtime";
    const effectiveSettings = realtimeActive
      ? { ...browser.settings, enabled: true }
      : browser.settings;

    return {
      engine: effectiveEngine,
      realtimeState,
      phase: voiceAutomationEnabled ? (realtimeActive ? realtimePhase : browser.phase) : "disabled",
      statusMessage: voiceAutomationEnabled
        ? (realtimeActive ? realtimeStatus : fallbackNotice || browser.statusMessage)
        : ORION_VOICE_FREEZE_MESSAGE,
      supportMessage: realtimeActive ? "OpenAI Realtime voice with controlled BOS tools." : browser.supportMessage,
      micActive: voiceAutomationEnabled && (realtimeActive ? realtimeState === "connected" : browser.micActive),
      speaking: voiceAutomationEnabled && (realtimeActive ? realtimeSpeaking : browser.speaking),
      interimTranscript: realtimeActive ? realtimeInterimTranscript : browser.interimTranscript,
      finalTranscript: realtimeActive ? realtimeFinalTranscript : browser.finalTranscript,
      voiceLevel: voiceAutomationEnabled && !realtimeActive ? browser.voiceLevel : 0,
      mode: browser.mode,
      settings: voiceAutomationEnabled ? effectiveSettings : { ...effectiveSettings, enabled: false },
      start,
      stop,
      retry,
      setSpokenResponsesEnabled: browser.setSpokenResponsesEnabled,
      enableVoice: browser.enableGlobalVoice,
      disableVoice,
    };
  }, [
    browser,
    disableVoice,
    engine,
    fallbackNotice,
    realtimeFinalTranscript,
    realtimeInterimTranscript,
    realtimePhase,
    realtimeSpeaking,
    realtimeState,
    realtimeStatus,
    retry,
    start,
    stop,
    voiceAutomationEnabled,
  ]);
}
