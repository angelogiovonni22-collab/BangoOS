"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useGlobalOrionVoice } from "@/components/orion/voice";
import { OrionRealtimeClient, type OrionRealtimeConnectionState, type OrionRealtimeServerEvent, type OrionRealtimeToolExecutionResult } from "@/lib/orion/realtime";
import type { PersistentOrionVisualState } from "./types";

type OrionRealtimeRuntimeValue = {
  available: boolean;
  active: boolean;
  connectionState: OrionRealtimeConnectionState;
  visualState: PersistentOrionVisualState | null;
  statusMessage: string;
  userTranscript: string;
  assistantTranscript: string;
  lastToolResult: OrionRealtimeToolExecutionResult | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

const OrionRealtimeRuntimeContext = createContext<OrionRealtimeRuntimeValue | null>(null);

function realtimeVisualState(state: OrionRealtimeConnectionState, speaking: boolean, toolRunning: boolean): PersistentOrionVisualState | null {
  if (state === "requesting_microphone" || state === "connecting") return "thinking";
  if (state === "connected" && toolRunning) return "executing";
  if (state === "connected" && speaking) return "speaking";
  if (state === "connected") return "listening";
  if (state === "error") return "error";
  return null;
}

function readText(event: OrionRealtimeServerEvent, key: string) {
  const value = event[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isAssistantAudioStart(event: OrionRealtimeServerEvent) {
  return event.type === "output_audio_buffer.started" || event.type === "response.output_audio.delta";
}

function isAssistantAudioStop(event: OrionRealtimeServerEvent) {
  return event.type === "output_audio_buffer.stopped" || event.type === "response.output_audio.done" || event.type === "response.done";
}

function extractAssistantTranscript(event: OrionRealtimeServerEvent) {
  if (event.type !== "response.output_audio_transcript.done" && event.type !== "response.audio_transcript.done") return null;
  return readText(event, "transcript");
}

function extractUserTranscript(event: OrionRealtimeServerEvent) {
  if (event.type !== "conversation.item.input_audio_transcription.completed") return null;
  return readText(event, "transcript");
}

export function OrionRealtimeRuntimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const browserVoice = useGlobalOrionVoice();
  const clientRef = useRef<OrionRealtimeClient | null>(null);
  const browserVoiceWasEnabledRef = useRef(false);
  const fallbackAttemptedRef = useRef(false);
  const [connectionState, setConnectionState] = useState<OrionRealtimeConnectionState>("idle");
  const [statusMessage, setStatusMessage] = useState("Natural Realtime voice is ready.");
  const [userTranscript, setUserTranscript] = useState("");
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [lastToolResult, setLastToolResult] = useState<OrionRealtimeToolExecutionResult | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [toolRunning, setToolRunning] = useState(false);

  const restoreBrowserFallback = useCallback(() => {
    if (fallbackAttemptedRef.current) return;
    fallbackAttemptedRef.current = true;
    browserVoice.enableGlobalVoice();
    setStatusMessage("Realtime voice is unavailable. Browser voice fallback is active.");
  }, [browserVoice]);

  const handleEvent = useCallback((event: OrionRealtimeServerEvent) => {
    const userText = extractUserTranscript(event);
    if (userText) setUserTranscript(userText);

    const assistantText = extractAssistantTranscript(event);
    if (assistantText) setAssistantTranscript(assistantText);

    if (isAssistantAudioStart(event)) setSpeaking(true);
    if (isAssistantAudioStop(event)) setSpeaking(false);

    if (event.type === "response.function_call_arguments.done") setToolRunning(true);
    if (event.type === "response.done") setToolRunning(false);
  }, []);

  const handleToolResult = useCallback((result: OrionRealtimeToolExecutionResult) => {
    setToolRunning(false);
    setLastToolResult(result);
    setStatusMessage(result.userMessage);
    if (result.href) router.push(result.href);
  }, [router]);

  const stop = useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;
    if (client) await client.disconnect();
    setConnectionState("closed");
    setSpeaking(false);
    setToolRunning(false);
    setStatusMessage("Natural Realtime voice stopped.");

    if (browserVoiceWasEnabledRef.current) browserVoice.enableGlobalVoice();
    browserVoiceWasEnabledRef.current = false;
    fallbackAttemptedRef.current = false;
  }, [browserVoice]);

  const start = useCallback(async () => {
    if (clientRef.current || connectionState === "connecting" || connectionState === "requesting_microphone") return;

    fallbackAttemptedRef.current = false;
    browserVoiceWasEnabledRef.current = browserVoice.settings.enabled;
    browserVoice.stopAllListening();
    if (browserVoice.settings.enabled) browserVoice.disableGlobalVoice();

    setUserTranscript("");
    setAssistantTranscript("");
    setLastToolResult(null);
    setStatusMessage("Starting natural Realtime voice...");

    const client = new OrionRealtimeClient({
      onStateChange: (state) => {
        setConnectionState(state);
        if (state === "requesting_microphone") setStatusMessage("Starting microphone...");
        if (state === "connecting") setStatusMessage("Connecting Orion Realtime...");
        if (state === "connected") setStatusMessage("Orion Realtime is listening. Speak naturally.");
        if (state === "error") setStatusMessage("Realtime voice could not start.");
      },
      onEvent: handleEvent,
      onToolResult: handleToolResult,
      onError: (error) => setStatusMessage(error.message),
    });

    clientRef.current = client;
    try {
      await client.connect();
    } catch {
      clientRef.current = null;
      restoreBrowserFallback();
    }
  }, [browserVoice, connectionState, handleEvent, handleToolResult, restoreBrowserFallback]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && connectionState === "connected") {
        setStatusMessage("Orion Realtime is listening. Speak naturally.");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [connectionState]);

  useEffect(() => () => {
    const client = clientRef.current;
    clientRef.current = null;
    if (client) void client.disconnect();
  }, []);

  const active = connectionState === "requesting_microphone" || connectionState === "connecting" || connectionState === "connected" || connectionState === "closing";
  const value = useMemo<OrionRealtimeRuntimeValue>(() => ({
    available: typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof RTCPeerConnection !== "undefined",
    active,
    connectionState,
    visualState: realtimeVisualState(connectionState, speaking, toolRunning),
    statusMessage,
    userTranscript,
    assistantTranscript,
    lastToolResult,
    start,
    stop,
  }), [active, assistantTranscript, connectionState, lastToolResult, speaking, start, statusMessage, stop, toolRunning, userTranscript]);

  return <OrionRealtimeRuntimeContext.Provider value={value}>{children}</OrionRealtimeRuntimeContext.Provider>;
}

export function useOrionRealtimeRuntime() {
  const context = useContext(OrionRealtimeRuntimeContext);
  if (!context) throw new Error("useOrionRealtimeRuntime must be used within OrionRealtimeRuntimeProvider.");
  return context;
}
