"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OrionRealtimeClient } from "@/lib/orion/realtime/client";
import type { OrionRealtimeConnectionState, OrionRealtimeServerEvent } from "@/lib/orion/realtime/types";
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
  const router = useRouter();
  const clientRef = useRef<OrionRealtimeClient | null>(null);
  const fallbackStartedRef = useRef(false);
  const [engine, setEngine] = useState<OrionVoiceEngine>("browser");
  const [realtimeState, setRealtimeState] = useState<OrionRealtimeConnectionState>("idle");
  const [realtimePhase, setRealtimePhase] = useState("idle");
  const [realtimeStatus, setRealtimeStatus] = useState("Realtime voice is ready.");
  const [realtimeFinalTranscript, setRealtimeFinalTranscript] = useState("");
  const [realtimeInterimTranscript] = useState("");
  const [realtimeSpeaking, setRealtimeSpeaking] = useState(false);

  const fallbackToBrowser = useCallback((reason?: string) => {
    fallbackStartedRef.current = true;
    setEngine("browser");
    setRealtimePhase("fallback");
    setRealtimeStatus(reason || "Realtime voice is unavailable. Using browser voice fallback.");
    browser.startBrowserFallback();
  }, [browser]);

  const stop = useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      await client.disconnect();
    }
    setRealtimeSpeaking(false);
    setRealtimeState("closed");
    setRealtimePhase("idle");
    setRealtimeStatus("Realtime conversation ended.");
    setEngine("browser");
  }, []);

  const start = useCallback(async () => {
    if (realtimeState === "requesting_microphone" || realtimeState === "connecting" || realtimeState === "connected") {
      return;
    }

    fallbackStartedRef.current = false;
    browser.stopAllListening();
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
        } else if (event.type === "response.output_audio.delta") {
          setRealtimeSpeaking(true);
          setRealtimePhase("speaking");
          setRealtimeStatus("Orion is speaking.");
        } else if (event.type === "response.output_audio.done" || event.type === "response.done") {
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
        if (!fallbackStartedRef.current) {
          fallbackToBrowser(`${error.message} Using browser voice fallback.`);
        }
      },
    });

    clientRef.current = client;
    try {
      await client.connect();
    } catch (error) {
      if (clientRef.current === client) {
        clientRef.current = null;
      }
      if (!fallbackStartedRef.current) {
        const message = error instanceof Error ? error.message : "Realtime voice is unavailable.";
        fallbackToBrowser(`${message} Using browser voice fallback.`);
      }
    }
  }, [browser, fallbackToBrowser, realtimeState, router]);

  const retry = useCallback(async () => {
    await stop();
    await start();
  }, [start, stop]);

  const disableVoice = useCallback(async () => {
    await stop();
    browser.disableGlobalVoice();
  }, [browser, stop]);

  useEffect(() => () => {
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      void client.disconnect();
    }
  }, []);

  return useMemo(() => {
    const realtimeActive = engine === "realtime";
    return {
      engine,
      realtimeState,
      phase: realtimeActive ? realtimePhase : browser.phase,
      statusMessage: realtimeActive ? realtimeStatus : browser.statusMessage,
      supportMessage: realtimeActive ? "OpenAI Realtime voice with controlled BOS tools." : browser.supportMessage,
      micActive: realtimeActive ? realtimeState === "connected" : browser.micActive,
      speaking: realtimeActive ? realtimeSpeaking : browser.speaking,
      interimTranscript: realtimeActive ? realtimeInterimTranscript : browser.interimTranscript,
      finalTranscript: realtimeActive ? realtimeFinalTranscript : browser.finalTranscript,
      voiceLevel: realtimeActive ? 0 : browser.voiceLevel,
      mode: browser.mode,
      settings: browser.settings,
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
    realtimeFinalTranscript,
    realtimeInterimTranscript,
    realtimePhase,
    realtimeSpeaking,
    realtimeState,
    realtimeStatus,
    retry,
    start,
    stop,
  ]);
}
