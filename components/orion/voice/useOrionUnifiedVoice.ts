"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { resolveKnownOrionOperatorHref } from "@/lib/orion/operator/routes";
import { OrionRealtimeClient } from "@/lib/orion/realtime/client";
import type { OrionRealtimeConnectionState, OrionRealtimeServerEvent } from "@/lib/orion/realtime/types";
import { isOrionVoiceAutomationEnabled, ORION_VOICE_FREEZE_MESSAGE } from "@/lib/orion/runtime-config";
import { detectRealtimeVoiceControl } from "@/lib/orion/voice/realtime-voice-controls";
import { useGlobalOrionVoice } from "./GlobalOrionVoiceProvider";

// `browser` remains in the public union temporarily for source compatibility with
// older UI components. Orion v2 never selects it as an execution engine.
export type OrionVoiceEngine = "realtime" | "browser";
export const ORION_REALTIME_VOICES = ["marin", "cedar", "coral", "shimmer", "sage", "alloy", "ash", "ballad", "echo", "verse"] as const;
export type OrionRealtimeVoice = (typeof ORION_REALTIME_VOICES)[number];

const REALTIME_VOICE_STORAGE_KEY = "bangoos:orion-realtime-voice:v1";
const ORION_V2_ENABLED_STORAGE_KEY = "bangoos:orion-v2-enabled:v1";
const ORION_REALTIME_SPOKEN_RESPONSES_STORAGE_KEY = "bangoos:orion-realtime-spoken-responses:v1";
const ORION_REALTIME_OWNER_STORAGE_KEY = "bangoos:orion-realtime-owner:v1";
const ORION_REALTIME_OWNER_CHANNEL = "bangoos:orion-realtime-owner";
const DEFAULT_REALTIME_VOICE: OrionRealtimeVoice = "marin";

type OrionRealtimeBrowserWindow = Window & {
  __bangoOrionRealtimeClient?: OrionRealtimeClient;
};

export type OrionUnifiedVoiceController = {
  engine: OrionVoiceEngine;
  realtimeState: OrionRealtimeConnectionState;
  realtimeVoice: OrionRealtimeVoice;
  availableRealtimeVoices: readonly OrionRealtimeVoice[];
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
  setRealtimeVoice: (voice: OrionRealtimeVoice) => void;
  setSpokenResponsesEnabled: (enabled: boolean) => void;
  enableVoice: () => void;
  disableVoice: () => Promise<void>;
};

function isRealtimeVoice(value: unknown): value is OrionRealtimeVoice {
  return typeof value === "string" && (ORION_REALTIME_VOICES as readonly string[]).includes(value);
}

function readStoredBoolean(key: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function readStoredBooleanWithDefault(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === "1";
  } catch {
    return fallback;
  }
}

function storeBoolean(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Local persistence is optional.
  }
}

function createOwnerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `orion-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readRealtimeOwner() {
  try {
    return window.localStorage.getItem(ORION_REALTIME_OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function claimRealtimeOwnership(ownerId: string, channel: BroadcastChannel | null) {
  try {
    window.localStorage.setItem(ORION_REALTIME_OWNER_STORAGE_KEY, ownerId);
  } catch {
    // BroadcastChannel and the in-tab singleton still provide ownership guards.
  }
  channel?.postMessage({ type: "claim", ownerId });
}

function releaseRealtimeOwnership(ownerId: string) {
  try {
    if (window.localStorage.getItem(ORION_REALTIME_OWNER_STORAGE_KEY) === ownerId) {
      window.localStorage.removeItem(ORION_REALTIME_OWNER_STORAGE_KEY);
    }
  } catch {
    // Ownership cleanup is best effort when storage is unavailable.
  }
}

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

async function waitForMountedRoute(href: string) {
  if (typeof window === "undefined") return;
  const target = new URL(href, window.location.origin);
  const deadline = performance.now() + 1_500;

  while (performance.now() < deadline) {
    if (window.location.pathname === target.pathname && window.location.search === target.search) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      return;
    }
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
}

function useOrionUnifiedVoiceController(): OrionUnifiedVoiceController {
  const legacyVoice = useGlobalOrionVoice();
  const legacyVoiceRef = useRef(legacyVoice);
  const router = useRouter();
  const clientRef = useRef<OrionRealtimeClient | null>(null);
  const ownerIdRef = useRef(createOwnerId());
  const ownerChannelRef = useRef<BroadcastChannel | null>(null);
  const ownershipBlockedRef = useRef(false);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const manualStopRef = useRef(false);
  const voiceAutomationEnabled = isOrionVoiceAutomationEnabled();

  const [enabled, setEnabled] = useState(() => readStoredBoolean(ORION_V2_ENABLED_STORAGE_KEY));
  const [spokenResponsesEnabled, setSpokenResponsesEnabledState] = useState(() => readStoredBooleanWithDefault(ORION_REALTIME_SPOKEN_RESPONSES_STORAGE_KEY, true));
  const spokenResponsesEnabledRef = useRef(spokenResponsesEnabled);
  const [realtimeState, setRealtimeState] = useState<OrionRealtimeConnectionState>("idle");
  const [realtimeVoice, setRealtimeVoiceState] = useState<OrionRealtimeVoice>(DEFAULT_REALTIME_VOICE);
  const [realtimePhase, setRealtimePhase] = useState("idle");
  const [realtimeStatus, setRealtimeStatus] = useState("Orion v2 is ready.");
  const [realtimeFinalTranscript, setRealtimeFinalTranscript] = useState("");
  const [realtimeInterimTranscript] = useState("");
  const [realtimeSpeaking, setRealtimeSpeaking] = useState(false);

  useEffect(() => {
    legacyVoiceRef.current = legacyVoice;
  }, [legacyVoice]);

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(ORION_REALTIME_OWNER_CHANNEL) : null;
    ownerChannelRef.current = channel;

    const yieldToOwner = (nextOwnerId: string | null) => {
      if (!nextOwnerId || nextOwnerId === ownerId) return;
      ownershipBlockedRef.current = true;
      const client = clientRef.current;
      clientRef.current = null;
      const browserWindow = window as OrionRealtimeBrowserWindow;
      if (browserWindow.__bangoOrionRealtimeClient === client) {
        delete browserWindow.__bangoOrionRealtimeClient;
      }
      if (client) void client.disconnect();
      setRealtimeSpeaking(false);
      setRealtimeState("closed");
      setRealtimePhase("idle");
      setRealtimeStatus("Orion is active in another BOS tab. Start Orion here to move the conversation to this tab.");
    };

    channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
      const data = event.data as { type?: unknown; ownerId?: unknown } | null;
      if (data?.type === "claim" && typeof data.ownerId === "string") yieldToOwner(data.ownerId);
    });
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ORION_REALTIME_OWNER_STORAGE_KEY) yieldToOwner(event.newValue);
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
      ownerChannelRef.current = null;
      releaseRealtimeOwnership(ownerId);
    };
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(REALTIME_VOICE_STORAGE_KEY);
    if (isRealtimeVoice(stored) && stored !== realtimeVoice) {
      queueMicrotask(() => setRealtimeVoiceState(stored));
    }
  }, [realtimeVoice]);

  const setRealtimeVoice = useCallback((voice: OrionRealtimeVoice) => {
    if (!isRealtimeVoice(voice)) return;
    setRealtimeVoiceState(voice);
    try {
      window.localStorage.setItem(REALTIME_VOICE_STORAGE_KEY, voice);
    } catch {
      // Voice preference persistence is optional.
    }
  }, []);

  const shutDownLegacyVoice = useCallback(() => {
    const current = legacyVoiceRef.current;
    current.stopAllListening();
    if (current.settings.enabled) {
      current.disableGlobalVoice();
    }
  }, []);

  const disconnectRealtime = useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      await client.disconnect();
    }
    const browserWindow = window as OrionRealtimeBrowserWindow;
    if (browserWindow.__bangoOrionRealtimeClient === client) {
      delete browserWindow.__bangoOrionRealtimeClient;
    }
    releaseRealtimeOwnership(ownerIdRef.current);
    setRealtimeSpeaking(false);
    setRealtimeState("closed");
  }, []);

  const start = useCallback(async () => {
    if (!voiceAutomationEnabled) {
      shutDownLegacyVoice();
      setRealtimeState("closed");
      setRealtimePhase("disabled");
      setRealtimeStatus(ORION_VOICE_FREEZE_MESSAGE);
      return;
    }

    if (connectPromiseRef.current) {
      return connectPromiseRef.current;
    }

    if (realtimeState === "requesting_microphone" || realtimeState === "connecting" || realtimeState === "connected") {
      return;
    }

    manualStopRef.current = false;
    ownershipBlockedRef.current = false;
    claimRealtimeOwnership(ownerIdRef.current, ownerChannelRef.current);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 75));
    const currentOwner = readRealtimeOwner();
    if (currentOwner && currentOwner !== ownerIdRef.current) {
      ownershipBlockedRef.current = true;
      setRealtimeState("closed");
      setRealtimePhase("idle");
      setRealtimeStatus("Orion is active in another BOS tab. Start Orion here to move the conversation to this tab.");
      return;
    }
    setEnabled(true);
    storeBoolean(ORION_V2_ENABLED_STORAGE_KEY, true);
    shutDownLegacyVoice();
    setRealtimePhase("starting");
    setRealtimeStatus("Starting Orion v2...");
    setRealtimeFinalTranscript("");

    const browserWindow = window as OrionRealtimeBrowserWindow;
    const previousClient = browserWindow.__bangoOrionRealtimeClient;
    if (previousClient) {
      await previousClient.disconnect();
      if (clientRef.current === previousClient) clientRef.current = null;
    }

    const client = new OrionRealtimeClient({
      onStateChange: (state) => {
        setRealtimeState(state);
        if (state === "requesting_microphone") {
          setRealtimePhase("starting");
          setRealtimeStatus("Starting microphone...");
        } else if (state === "connecting") {
          setRealtimePhase("starting");
          setRealtimeStatus("Connecting Orion intelligence...");
        } else if (state === "connected") {
          setRealtimePhase("listening");
          setRealtimeStatus("Orion is listening.");
        } else if (state === "error") {
          setRealtimePhase("error");
        }
      },
      onEvent: (event) => {
        const userTranscript = eventTranscript(event);
        if (userTranscript) {
          setRealtimeFinalTranscript(userTranscript);
          const voiceControl = detectRealtimeVoiceControl(userTranscript);
          if (voiceControl === "mute_output") {
            client.setOutputMuted(true);
            spokenResponsesEnabledRef.current = false;
            setSpokenResponsesEnabledState(false);
            storeBoolean(ORION_REALTIME_SPOKEN_RESPONSES_STORAGE_KEY, false);
            setRealtimePhase("listening");
            setRealtimeStatus("Orion voice output is disabled. Say “Orion, enable voice” to turn it back on.");
          } else if (voiceControl === "unmute_output") {
            client.setOutputMuted(false);
            spokenResponsesEnabledRef.current = true;
            setSpokenResponsesEnabledState(true);
            storeBoolean(ORION_REALTIME_SPOKEN_RESPONSES_STORAGE_KEY, true);
            setRealtimePhase("listening");
            setRealtimeStatus("Orion voice output is enabled.");
          } else {
            setRealtimePhase("understanding");
            setRealtimeStatus("Understanding...");
          }
        }

        const assistantTranscript = eventAssistantTranscript(event);
        if (assistantTranscript) {
          setRealtimeStatus(assistantTranscript);
        }

        if (event.type === "response.created") {
          setRealtimePhase("understanding");
          setRealtimeStatus("Orion is thinking...");
        } else if ((event.type === "response.output_audio.delta" || event.type === "output_audio_buffer.started") && spokenResponsesEnabledRef.current) {
          setRealtimeSpeaking(true);
          setRealtimePhase("speaking");
          setRealtimeStatus("Orion is speaking.");
        } else if (event.type === "response.output_audio.done" || event.type === "output_audio_buffer.stopped" || event.type === "response.done") {
          setRealtimeSpeaking(false);
          setRealtimePhase("listening");
          setRealtimeStatus("Orion is listening.");
        }
      },
      onToolResult: async (result) => {
        setRealtimePhase(result.confirmationRequired ? "confirmation_required" : result.ok ? "success" : "error");
        setRealtimeStatus(result.userMessage);
        const safeHref = result.href ? resolveKnownOrionOperatorHref(result.href) : null;
        if (result.ok && result.href && !safeHref) {
          setRealtimePhase("error");
          setRealtimeStatus("Orion blocked an invalid BOS route before navigation.");
          return;
        }
        if (result.ok && safeHref) {
          router.push(safeHref);
          await waitForMountedRoute(safeHref);
        }
      },
      onError: (error) => {
        // Orion v2 deliberately does not hand a failed Realtime turn to the old
        // deterministic browser engine. That prevents duplicate processing and
        // unrelated legacy navigation such as accidental Customers routing.
        setRealtimeSpeaking(false);
        setRealtimeState("error");
        setRealtimePhase("error");
        setRealtimeStatus(error.message || "Orion Realtime voice failed. Retry to reconnect.");
      },
    });

    clientRef.current = client;
    client.setOutputMuted(!spokenResponsesEnabled);
    browserWindow.__bangoOrionRealtimeClient = client;
    const connectPromise = (async () => {
      try {
        await client.connect({ voice: realtimeVoice });
      } catch (error) {
        if (clientRef.current === client) {
          clientRef.current = null;
        }
        const message = error instanceof Error ? error.message : "Unable to connect Orion v2.";
        setRealtimeState("error");
        setRealtimePhase("error");
        setRealtimeStatus(message);
      } finally {
        connectPromiseRef.current = null;
      }
    })();

    connectPromiseRef.current = connectPromise;
    return connectPromise;
  }, [realtimeState, realtimeVoice, router, shutDownLegacyVoice, spokenResponsesEnabled, voiceAutomationEnabled]);

  const stop = useCallback(async () => {
    manualStopRef.current = true;
    await disconnectRealtime();
    setRealtimePhase("idle");
    setRealtimeStatus("Realtime conversation ended. Tap Start to talk again.");
  }, [disconnectRealtime]);

  const retry = useCallback(async () => {
    manualStopRef.current = false;
    await disconnectRealtime();
    setRealtimeState("idle");
    await start();
  }, [disconnectRealtime, start]);

  const enableVoice = useCallback(() => {
    manualStopRef.current = false;
    setEnabled(true);
    storeBoolean(ORION_V2_ENABLED_STORAGE_KEY, true);
    void start();
  }, [start]);

  const disableVoice = useCallback(async () => {
    manualStopRef.current = true;
    setEnabled(false);
    storeBoolean(ORION_V2_ENABLED_STORAGE_KEY, false);
    await disconnectRealtime();
    shutDownLegacyVoice();
    setRealtimePhase("disabled");
    setRealtimeStatus("Orion voice is disabled.");
  }, [disconnectRealtime, shutDownLegacyVoice]);

  const setSpokenResponsesEnabled = useCallback((spokenEnabled: boolean) => {
    spokenResponsesEnabledRef.current = spokenEnabled;
    setSpokenResponsesEnabledState(spokenEnabled);
    storeBoolean(ORION_REALTIME_SPOKEN_RESPONSES_STORAGE_KEY, spokenEnabled);
    clientRef.current?.setOutputMuted(!spokenEnabled);
    setRealtimeStatus(spokenEnabled
      ? "Orion voice output is enabled."
      : "Orion voice output is disabled. Say “Orion, enable voice” to turn it back on.");
  }, []);

  // Legacy global voice may have been enabled by an older saved preference. It is
  // never allowed to own the microphone while Orion v2 is active.
  useEffect(() => {
    if (enabled) {
      shutDownLegacyVoice();
    }
  }, [enabled, shutDownLegacyVoice]);

  // Persist the Realtime conversation across page navigation. The lifecycle hook
  // schedules the user-equivalent start action after commit rather than mutating
  // React state synchronously inside the effect body.
  useEffect(() => {
    if (!voiceAutomationEnabled || !enabled || manualStopRef.current || ownershipBlockedRef.current || autoStartAttemptedRef.current) return;
    if (realtimeState !== "idle" && realtimeState !== "closed") return;
    autoStartAttemptedRef.current = true;
    queueMicrotask(() => {
      void start();
    });
  }, [enabled, realtimeState, start, voiceAutomationEnabled]);

  // The emergency kill switch tears down external microphone/WebRTC resources but
  // does not erase the user's saved v2 preference. State projection below already
  // reports Orion as disabled while the gate is off.
  useEffect(() => {
    if (voiceAutomationEnabled) return;
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      void client.disconnect();
    }
    shutDownLegacyVoice();
  }, [shutDownLegacyVoice, voiceAutomationEnabled]);

  useEffect(() => () => {
    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      void client.disconnect();
    }
    const browserWindow = window as OrionRealtimeBrowserWindow;
    if (browserWindow.__bangoOrionRealtimeClient === client) {
      delete browserWindow.__bangoOrionRealtimeClient;
    }
  }, []);

  return useMemo(() => {
    const effectiveSettings = {
      ...legacyVoice.settings,
      enabled: voiceAutomationEnabled && enabled,
      spokenResponsesEnabled: voiceAutomationEnabled && enabled && spokenResponsesEnabled,
    };

    return {
      engine: "realtime" as const,
      realtimeState,
      realtimeVoice,
      availableRealtimeVoices: ORION_REALTIME_VOICES,
      phase: voiceAutomationEnabled ? realtimePhase : "disabled",
      statusMessage: voiceAutomationEnabled ? realtimeStatus : ORION_VOICE_FREEZE_MESSAGE,
      supportMessage: "Orion v2 uses one persistent OpenAI Realtime conversation with controlled BOS tools. Legacy browser intent routing is disabled.",
      micActive: voiceAutomationEnabled && realtimeState === "connected",
      speaking: voiceAutomationEnabled && realtimeSpeaking,
      interimTranscript: realtimeInterimTranscript,
      finalTranscript: realtimeFinalTranscript,
      voiceLevel: 0,
      mode: "hands_free" as const,
      settings: voiceAutomationEnabled ? effectiveSettings : { ...effectiveSettings, enabled: false },
      start,
      stop,
      retry,
      setRealtimeVoice,
      setSpokenResponsesEnabled,
      enableVoice,
      disableVoice,
    };
  }, [
    disableVoice,
    enableVoice,
    enabled,
    legacyVoice.settings,
    realtimeFinalTranscript,
    realtimeInterimTranscript,
    realtimePhase,
    realtimeSpeaking,
    realtimeState,
    realtimeStatus,
    realtimeVoice,
    retry,
    setRealtimeVoice,
    setSpokenResponsesEnabled,
    spokenResponsesEnabled,
    start,
    stop,
    voiceAutomationEnabled,
  ]);
}

const OrionUnifiedVoiceContext = createContext<OrionUnifiedVoiceController | null>(null);

export function OrionUnifiedVoiceProvider({ children }: { children: ReactNode }) {
  const controller = useOrionUnifiedVoiceController();
  return createElement(OrionUnifiedVoiceContext.Provider, { value: controller }, children);
}

export function useOrionUnifiedVoice() {
  const controller = useContext(OrionUnifiedVoiceContext);
  if (!controller) {
    throw new Error("useOrionUnifiedVoice must be used within OrionUnifiedVoiceProvider.");
  }
  return controller;
}
