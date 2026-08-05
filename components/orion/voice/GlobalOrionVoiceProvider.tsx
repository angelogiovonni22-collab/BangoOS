"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company";
import type { OrionIntentResult } from "@/lib/orion/intent-engine";
import { normalizeIntentInput } from "@/lib/orion/intent-engine";
import { buildVoiceConfirmationSummary } from "@/lib/orion/voice/voice-confirmation";
import { buildVoiceResponse } from "@/lib/orion/voice/voice-response";
import { isCancelPhrase, parseVoiceConfirmationPhrase, resolveSpokenCandidate } from "@/lib/orion/voice/voice-transcript";
import { detectWakeWord } from "@/lib/orion/voice/wake-word-normalizer";
import { useOrionVoiceSession } from "@/lib/orion/voice/voice-session";
import type { OrionVoiceCaptureMode, OrionVoiceErrorCategory, OrionVoiceState } from "@/lib/orion/voice/voice-types";
import type { OrionCommandCenterCatalog } from "@/lib/orion/command-center";

export type GlobalOrionVoicePhase =
  | "disabled"
  | "unsupported"
  | "permission_required"
  | "permission_denied"
  | "reactivation_required"
  | "starting"
  | "waiting_for_wake"
  | "wake_detected"
  | "listening"
  | "finalizing"
  | "understanding"
  | "clarification_required"
  | "confirmation_required"
  | "executing"
  | "speaking"
  | "success"
  | "no_match"
  | "error"
  | "stopping";

type GlobalWakePhrase = "hey_orion" | "okay_orion" | "orion";

type GlobalVoiceControlPhrase =
  | "activate_voice_command"
  | "end_voice_command"
  | null;

type GlobalVoiceInactivityTimeout = "30s" | "1m" | "5m" | "never";

type GlobalOrionVoiceSettings = {
  enabled: boolean;
  mode: "push_to_talk" | "tap_to_listen" | "hands_free";
  wakePhrase: GlobalWakePhrase;
  shortWakePhraseAllowed: boolean;
  spokenResponsesEnabled: boolean;
  returnToWakeAfterCommand: boolean;
  autoEndContinuousMode: boolean;
  inactivityTimeout: GlobalVoiceInactivityTimeout;
  showTranscript: boolean;
  diagnosticsEnabled: boolean;
  voiceVolume: number;
  voiceRate: number;
  voicePitch: number;
  wakeAcknowledge: "sound" | "spoken" | "visual_only";
  consentAcknowledged: boolean;
};

type RouteContext = {
  pathname: string;
  projectId: string | null;
  customerId: string | null;
  estimateId: string | null;
  invoiceId: string | null;
  employeeId: string | null;
  crewId: string | null;
  dashboardWidgetId: string | null;
  timelineItemId: string | null;
};

type VoiceConfirmationPending = {
  commandId: string;
  params: Record<string, unknown>;
  summary: string;
};

type GlobalOrionVoiceContextValue = {
  phase: GlobalOrionVoicePhase;
  mode: OrionVoiceCaptureMode | "hands_free";
  settings: GlobalOrionVoiceSettings;
  supportMessage: string;
  micActive: boolean;
  wakeListening: boolean;
  commandSessionActive: boolean;
  interimTranscript: string;
  finalTranscript: string;
  resultMessage: string | null;
  statusMessage: string;
  errorCategory: OrionVoiceErrorCategory | "voice_disabled" | "recognition_start_failed" | "reactivation_required" | "workspace_unavailable" | "authentication_required" | "no_match" | null;
  intentResult: OrionIntentResult | null;
  pendingConfirmation: VoiceConfirmationPending | null;
  canUseHandsFree: boolean;
  reactivationRequired: boolean;
  consentRequired: boolean;
  enableGlobalVoice: () => void;
  disableGlobalVoice: () => void;
  startPressToTalk: () => void;
  stopPressToTalk: () => void;
  toggleTapListening: () => void;
  setMode: (mode: OrionVoiceCaptureMode | "hands_free") => void;
  setSpokenResponsesEnabled: (enabled: boolean) => void;
  setReturnToWakeAfterCommand: (enabled: boolean) => void;
  acknowledgeConsent: () => void;
  startVoiceCommandMode: () => void;
  endVoiceCommandMode: () => void;
  confirmPendingCommand: () => void;
  cancelPendingCommand: () => void;
  stopAllListening: () => void;
  retryFromError: () => void;
};

const GlobalOrionVoiceContext = createContext<GlobalOrionVoiceContextValue | null>(null);

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function toTimeoutMs(value: GlobalVoiceInactivityTimeout) {
  if (value === "30s") return 30_000;
  if (value === "1m") return 60_000;
  if (value === "5m") return 300_000;
  return null;
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function mapVoiceErrorCategory(category: OrionVoiceErrorCategory | null): GlobalOrionVoiceContextValue["errorCategory"] {
  if (!category) {
    return null;
  }

  if (category === "microphone_permission_denied") return "permission_denied";
  if (category === "speech_recognition_unsupported") return "recognition_start_failed";
  return category;
}

function userMessageForVoiceCategory(category: NonNullable<GlobalOrionVoiceContextValue["errorCategory"]>, fallback: string) {
  switch (category) {
    case "voice_disabled":
      return "Global Orion Voice is off. Enable it to use voice commands.";
    case "microphone_permission_denied":
    case "permission_denied":
      return "Microphone permission is denied. Enable microphone access to continue.";
    case "microphone_unavailable":
      return "Microphone is unavailable right now.";
    case "recognition_start_failed":
      return "Speech recognition is not supported in this browser.";
    case "reactivation_required":
      return "Global Orion Voice is enabled. Tap once to reactivate the microphone.";
    case "speech_recognition_error":
      return "Speech recognition failed. Try again.";
    case "no_speech":
      return "No speech detected. Try again.";
    case "context_unavailable":
    case "workspace_unavailable":
      return "Workspace context is unavailable. Try again.";
    case "authentication_required":
      return "Authentication is required for Orion voice commands.";
    case "intent_ambiguous":
      return "I found multiple matches. Please choose one.";
    case "confirmation_required":
      return "Confirmation is required. Say Confirm or Cancel.";
    case "command_validation_failed":
      return "Command details are invalid or incomplete.";
    case "command_execution_failed":
      return "The command failed to execute.";
    case "navigation_failed":
      return "Navigation failed.";
    case "network_error":
      return "Network error while processing voice command.";
    case "no_match":
      return "No matching command found.";
    default:
      return fallback;
  }
}

function detectControlPhrase(input: string): GlobalVoiceControlPhrase {
  const normalized = input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const startPhrases = [
    "orion activate voice command",
    "orion start voice command",
    "orion start voice mode",
    "orion begin voice session",
  ];

  const endPhrases = [
    "orion end voice command",
    "orion stop voice command",
    "orion end session",
    "orion stop listening",
    "orion exit voice mode",
  ];

  if (startPhrases.includes(normalized)) {
    return "activate_voice_command";
  }

  if (endPhrases.includes(normalized)) {
    return "end_voice_command";
  }

  return null;
}

function buildRouteContext(pathname: string, search: URLSearchParams): RouteContext {
  const parseEntityId = (key: string, routePrefix: string) => {
    const byQuery = search.get(key);
    if (byQuery && byQuery.trim()) {
      return byQuery.trim();
    }

    const match = pathname.match(new RegExp(`^/${routePrefix}/([^/?#]+)`));
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }

    return null;
  };

  return {
    pathname,
    projectId: parseEntityId("projectId", "projects"),
    customerId: parseEntityId("customerId", "customers"),
    estimateId: parseEntityId("estimateId", "estimates"),
    invoiceId: parseEntityId("invoiceId", "invoices"),
    employeeId: parseEntityId("employeeId", "employees"),
    crewId: parseEntityId("crewId", "crews"),
    dashboardWidgetId: search.get("widgetId"),
    timelineItemId: search.get("timelineItemId") || search.get("eventId"),
  };
}

function buildExecutionEnvelope(commandId: string, params: Record<string, unknown>) {
  const correlationId = typeof window !== "undefined" && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `orion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const idempotencyKey = `${commandId}:${JSON.stringify(params)}`;

  return { correlationId, idempotencyKey };
}

function defaultSettings(): GlobalOrionVoiceSettings {
  return {
    enabled: false,
    mode: "push_to_talk",
    wakePhrase: "hey_orion",
    shortWakePhraseAllowed: false,
    spokenResponsesEnabled: true,
    returnToWakeAfterCommand: true,
    autoEndContinuousMode: false,
    inactivityTimeout: "1m",
    showTranscript: true,
    diagnosticsEnabled: false,
    voiceVolume: 1,
    voiceRate: 1,
    voicePitch: 1,
    wakeAcknowledge: "spoken",
    consentAcknowledged: false,
  };
}

function logDiagnostics(enabled: boolean, stage: string, details?: Record<string, unknown>) {
  if (!enabled || IS_PRODUCTION || typeof console === "undefined") {
    return;
  }

  if (details) {
    console.info(`[orion-global-voice] ${stage}`, details);
    return;
  }

  console.info(`[orion-global-voice] ${stage}`);
}

function logGlobalVisibility(event: string, details?: Record<string, unknown>) {
  if (IS_PRODUCTION || typeof console === "undefined") {
    return;
  }

  if (details) {
    console.info(`[orion-global] ${event}`, details);
    return;
  }

  console.info(`[orion-global] ${event}`);
}

function logVoiceTrace(event: string, details?: Record<string, unknown>) {
  if (IS_PRODUCTION || typeof console === "undefined") {
    return;
  }

  if (details) {
    console.info(`[orion-trace] ${event}`, details);
    return;
  }

  console.info(`[orion-trace] ${event}`);
}

export function GlobalOrionVoiceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const company = useCompany();

  const storageKey = useMemo(
    () => `bangoos:orion:global-voice:${company.userId}:${company.companyId}:v1`,
    [company.companyId, company.userId],
  );

  const [settings, setSettings] = useState<GlobalOrionVoiceSettings>(defaultSettings);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [phase, setPhase] = useState<GlobalOrionVoicePhase>("disabled");
  const [wakeListening, setWakeListening] = useState(false);
  const [commandSessionActive, setCommandSessionActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Global Orion Voice is disabled.");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorCategory, setErrorCategory] = useState<GlobalOrionVoiceContextValue["errorCategory"]>(null);
  const [intentResult, setIntentResult] = useState<OrionIntentResult | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<VoiceConfirmationPending | null>(null);
  const [catalog, setCatalog] = useState<OrionCommandCenterCatalog | null>(null);
  const [reactivationRequired, setReactivationRequired] = useState(false);
  const [consentRequired, setConsentRequired] = useState(true);
  const [speechActive, setSpeechActive] = useState(false);
  const [lastCommandAt, setLastCommandAt] = useState<number | null>(null);

  const routeContext = useMemo(
    () => buildRouteContext(pathname || "/dashboard", searchParams),
    [pathname, searchParams],
  );

  const isMountedRef = useRef(true);
  const inFlightIntentRef = useRef<AbortController | null>(null);
  const inFlightExecuteRef = useRef<AbortController | null>(null);
  const transcriptTokenRef = useRef(0);
  const lastProcessedTranscriptRef = useRef<{ token: number; transcript: string } | null>(null);
  const lastModeSwitchAtRef = useRef(0);
  const inactivityTimerRef = useRef<number | null>(null);
  const hiddenPauseRef = useRef(false);
  const visibleResumeAttemptRef = useRef(false);
  const lastStartRequestAtRef = useRef(0);
  const settingsRef = useRef(settings);
  const phaseRef = useRef(phase);
  const commandSessionActiveRef = useRef(commandSessionActive);
  const errorCategoryRef = useRef(errorCategory);
  const reactivationRequiredRef = useRef(reactivationRequired);
  const voiceStartRef = useRef<() => void>(() => undefined);
  const voiceStopRef = useRef<() => void>(() => undefined);
  const voiceCancelRef = useRef<() => void>(() => undefined);
  const voiceStateRef = useRef<OrionVoiceState>("idle");
  const voiceRecognitionSupportedRef = useRef(false);
  const voiceSupportMessageRef = useRef("Voice control is not supported in this browser.");

  const voice = useOrionVoiceSession({
    lang: "en-US",
    onPermissionDenied: () => {
      setPhase("permission_denied");
      setErrorCategory("permission_denied");
      setStatusMessage("Microphone permission is denied.");
    },
    onErrorCategory: (category, message) => {
      const mapped = mapVoiceErrorCategory(category);
      setErrorCategory(mapped);
      setPhase(mapped === "permission_denied" ? "permission_denied" : "error");
      setStatusMessage(userMessageForVoiceCategory(mapped || "recognition_start_failed", message));
    },
    onFinalTranscript: (transcript) => {
      const token = transcriptTokenRef.current + 1;
      transcriptTokenRef.current = token;
      logVoiceTrace("provider.onFinalTranscript", {
        token,
        transcript,
      });
      logVoiceTrace("provider.dispatchTranscript", {
        token,
      });
      void handleTranscript(transcript, token);
    },
  });

  const canUseHandsFree = voice.support.recognitionSupported;
  const micActive = voice.state === "listening";

  useEffect(() => {
    settingsRef.current = settings;
    phaseRef.current = phase;
    commandSessionActiveRef.current = commandSessionActive;
    errorCategoryRef.current = errorCategory;
    reactivationRequiredRef.current = reactivationRequired;
    voiceStartRef.current = voice.start;
    voiceStopRef.current = voice.stop;
    voiceCancelRef.current = voice.cancel;
    voiceStateRef.current = voice.state;
    voiceRecognitionSupportedRef.current = voice.support.recognitionSupported;
    voiceSupportMessageRef.current = voice.support.message;
  }, [commandSessionActive, errorCategory, phase, reactivationRequired, settings, voice.cancel, voice.start, voice.state, voice.stop, voice.support.message, voice.support.recognitionSupported]);

  const persistSettings = useCallback((next: GlobalOrionVoiceSettings) => {
    setSettings(next);
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore storage failures.
    }
  }, [storageKey]);

  const speak = useCallback((text: string) => {
    if (!settings.spokenResponsesEnabled || typeof window === "undefined") {
      return;
    }

    if (!voice.support.synthesisSupported || !text.trim()) {
      return;
    }

    if (micActive || voice.state === "requesting_permission" || voice.state === "processing") {
      voice.stop();
    }

    setSpeechActive(true);
    setPhase("speaking");

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = "en-US";
    utterance.volume = settings.voiceVolume;
    utterance.rate = settings.voiceRate;
    utterance.pitch = settings.voicePitch;

    utterance.onend = () => {
      setSpeechActive(false);
      if (!isMountedRef.current) {
        return;
      }

      if (settings.enabled && settings.mode === "hands_free" && settings.returnToWakeAfterCommand && !commandSessionActive) {
        setWakeListening(true);
        setPhase("waiting_for_wake");
        setStatusMessage("Waiting for wake phrase.");
      }
    };

    utterance.onerror = () => {
      setSpeechActive(false);
      if (!isMountedRef.current) {
        return;
      }

      if (settings.enabled && settings.mode === "hands_free" && settings.returnToWakeAfterCommand && !commandSessionActive) {
        setWakeListening(true);
        setPhase("waiting_for_wake");
      }
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [commandSessionActive, micActive, settings.enabled, settings.mode, settings.returnToWakeAfterCommand, settings.spokenResponsesEnabled, settings.voicePitch, settings.voiceRate, settings.voiceVolume, voice]);

  const fetchCatalog = useCallback(async (): Promise<OrionCommandCenterCatalog | null> => {
    if (!settings.enabled) {
      return null;
    }

    const url = typeof window !== "undefined"
      ? `${window.location.origin}${routeContext.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
      : `http://localhost${routeContext.pathname}`;

    try {
      const response = await fetch(`/api/orion/command-center?url=${encodeURIComponent(url)}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "x-orion-context-hint": `${routeContext.pathname}:global-voice`,
        },
      });

      const payload = await response.json() as { ok: boolean; catalog?: OrionCommandCenterCatalog; error?: string; statusCategory?: string };

      if (!response.ok || !payload.ok || !payload.catalog) {
        setCatalog(null);
        if (payload.statusCategory === "authentication_required") {
          setPhase("disabled");
          setErrorCategory("authentication_required");
          setStatusMessage("Authentication is required for Orion voice.");
          return null;
        }

        setErrorCategory("workspace_unavailable");
        setStatusMessage(payload.error || "Workspace context is unavailable.");
        return null;
      }

      setCatalog(payload.catalog);
      return payload.catalog;
    } catch {
      setCatalog(null);
      setErrorCategory("network_error");
      setStatusMessage("Network error while loading Orion context.");
      return null;
    }
  }, [routeContext.pathname, searchParams, settings.enabled]);

  const executeCommand = useCallback(async (commandId: string, params: Record<string, unknown>, confirmationSummary?: string) => {
    if (!catalog) {
      setPhase("error");
      setErrorCategory("context_unavailable");
      setStatusMessage("Workspace context is unavailable.");
      return;
    }

    const hasKnownCommand = catalog.actions.some((action) => action.commandId === commandId);
    if (!hasKnownCommand) {
      setPhase("error");
      setErrorCategory("command_validation_failed");
      setStatusMessage("Unsupported command ID from intent.");
      return;
    }

    inFlightExecuteRef.current?.abort();
    const controller = new AbortController();
    inFlightExecuteRef.current = controller;

    setPhase("executing");
    setStatusMessage("Executing voice command.");

    const envelope = buildExecutionEnvelope(commandId, params);

    try {
      logVoiceTrace("command.execute.start", {
        commandId,
      });
      const response = await fetch("/api/orion/command-center", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-orion-company-id": catalog.context.currentCompany.id,
          "x-orion-context-hint": `${catalog.context.currentRoute}:${catalog.context.currentAuthenticatedUser.id}`,
        },
        body: JSON.stringify({
          commandId,
          params,
          correlationId: envelope.correlationId,
          idempotencyKey: envelope.idempotencyKey,
          confirmation: confirmationSummary ? { confirmed: true, summary: confirmationSummary } : undefined,
        }),
      });

      const payload = await response.json() as {
        ok: boolean;
        result?: { success: boolean; userMessage: string; href: string | null; status: string };
        error?: string;
        statusCategory?: string;
      };

      if (!response.ok || !payload.ok || !payload.result) {
        const category = payload.statusCategory === "permission_denied"
          ? "permission_denied"
          : payload.statusCategory === "command_validation_failed"
            ? "command_validation_failed"
            : "command_execution_failed";
        setPhase("error");
        setErrorCategory(category);
        setStatusMessage(userMessageForVoiceCategory(category, payload.error || "Command execution failed."));
        setResultMessage(payload.error || "Command execution failed.");
        speak(buildVoiceResponse({ status: "error", message: payload.error || "Command execution failed." }).text);
        logVoiceTrace("command.execute.end", {
          commandId,
          ok: false,
          statusCategory: category,
          error: payload.error || "Command execution failed.",
        });
        return;
      }

      setPhase("success");
      setErrorCategory(null);
      setStatusMessage("Voice request completed.");
      setResultMessage(payload.result.userMessage);
      setLastCommandAt(Date.now());

      const responseText = buildVoiceResponse({
        status: "success",
        targetLabel: payload.result.href || undefined,
        message: payload.result.userMessage,
      }).text;
      speak(responseText);

      if (payload.result.href) {
        router.push(payload.result.href);
      }

      if (settings.mode === "hands_free" && settings.returnToWakeAfterCommand && !commandSessionActive) {
        setWakeListening(true);
        setPhase("waiting_for_wake");
        setStatusMessage("Waiting for wake phrase.");
      }

      logVoiceTrace("command.execute.end", {
        commandId,
        ok: true,
        href: payload.result.href,
      });
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      setPhase("error");
      setErrorCategory("network_error");
      setStatusMessage("Network error while executing voice command.");
      logVoiceTrace("command.execute.end", {
        commandId,
        ok: false,
        statusCategory: "network_error",
      });
    }
  }, [catalog, commandSessionActive, router, settings.mode, settings.returnToWakeAfterCommand, speak]);

  const handleTranscript = useCallback(async (rawTranscript: string, token: number) => {
    logVoiceTrace("provider.processTranscript", {
      token,
      rawTranscript,
      currentToken: transcriptTokenRef.current,
      settingsEnabled: settings.enabled,
    });

    if (!settings.enabled) {
      logVoiceTrace("provider.processTranscript.skip.settings_disabled", {
        token,
        settingsEnabled: settings.enabled,
      });
      setPhase("disabled");
      return;
    }

    if (token !== transcriptTokenRef.current) {
      logVoiceTrace("provider.processTranscript.skip.stale_token", {
        token,
        currentToken: transcriptTokenRef.current,
      });
      return;
    }

    const trimmed = rawTranscript.trim();
    if (!trimmed) {
      logVoiceTrace("provider.processTranscript.skip.empty_transcript", {
        token,
        rawTranscript,
      });
      return;
    }

    const lastProcessed = lastProcessedTranscriptRef.current;
    if (lastProcessed?.token === token && lastProcessed.transcript === trimmed) {
      logVoiceTrace("provider.processTranscript.skip.duplicate_transcript", {
        token,
        lastToken: lastProcessed.token,
        transcript: trimmed,
        lastTranscript: lastProcessed.transcript,
      });
      return;
    }

    lastProcessedTranscriptRef.current = { token, transcript: trimmed };

    const controlPhrase = detectControlPhrase(trimmed);
    if (controlPhrase === "activate_voice_command") {
      logVoiceTrace("provider.processTranscript.skip.control_phrase_activate", {
        token,
        transcript: trimmed,
      });
      setCommandSessionActive(true);
      setWakeListening(false);
      setPhase("listening");
      setStatusMessage("Voice Command Mode activated. I'm listening.");
      setResultMessage("Voice Command Mode activated.");
      speak("Voice Command Mode activated. I'm listening.");
      return;
    }

    if (controlPhrase === "end_voice_command") {
      logVoiceTrace("provider.processTranscript.skip.control_phrase_end", {
        token,
        transcript: trimmed,
      });
      setCommandSessionActive(false);
      setPendingConfirmation(null);
      setIntentResult(null);
      setStatusMessage("Voice Command Mode ended.");
      setResultMessage("Voice Command Mode ended.");
      speak("Voice Command Mode ended.");

      if (settings.mode === "hands_free" && settings.returnToWakeAfterCommand) {
        setWakeListening(true);
        setPhase("waiting_for_wake");
      } else {
        setPhase("stopping");
        voice.stop();
      }
      return;
    }

    if (pendingConfirmation) {
      const phrase = parseVoiceConfirmationPhrase(trimmed);
      if (phrase === "cancel") {
        logVoiceTrace("provider.processTranscript.skip.pending_confirmation_cancel", {
          token,
          transcript: trimmed,
        });
        setPendingConfirmation(null);
        setPhase("success");
        setStatusMessage("Canceled.");
        setResultMessage("Canceled.");
        speak("Canceled.");
        return;
      }

      if (phrase === "confirm") {
        logVoiceTrace("provider.processTranscript.skip.pending_confirmation_confirm", {
          token,
          transcript: trimmed,
        });
        const pending = pendingConfirmation;
        setPendingConfirmation(null);
        await executeCommand(pending.commandId, pending.params, pending.summary);
        return;
      }

      logVoiceTrace("provider.processTranscript.skip.pending_confirmation_unrecognized", {
        token,
        transcript: trimmed,
      });
      setPhase("confirmation_required");
      setStatusMessage("Please say Confirm or Cancel.");
      return;
    }

    if (isCancelPhrase(trimmed)) {
      logVoiceTrace("provider.processTranscript.skip.cancel_phrase", {
        token,
        transcript: trimmed,
      });
      setPhase("success");
      setStatusMessage("Voice request canceled.");
      setResultMessage("Canceled.");
      return;
    }

    let normalized = trimmed;

    if (!commandSessionActive) {
      if (settings.mode === "hands_free" || wakeListening) {
        const wakeVariants: Array<GlobalWakePhrase> = ["hey_orion", "okay_orion"];
        if (settings.shortWakePhraseAllowed) {
          wakeVariants.push("orion");
        }

        const wakeDetection = detectWakeWord(trimmed, { enabled: wakeVariants });

        if (!wakeDetection.detected) {
          logVoiceTrace("provider.processTranscript.skip.wake_not_detected", {
            token,
            transcript: trimmed,
            wakeVariants,
          });
          setPhase("waiting_for_wake");
          setStatusMessage("Waiting for wake phrase.");
          return;
        }

        setPhase("wake_detected");
        setWakeListening(false);
        if (settings.wakeAcknowledge === "spoken" && settings.spokenResponsesEnabled) {
          speak("I'm listening.");
        }

        if (!wakeDetection.cleanedCommand) {
          logVoiceTrace("provider.processTranscript.skip.wake_missing_command", {
            token,
            transcript: trimmed,
            matchedVariant: wakeDetection.matchedVariant,
          });
          setPhase("listening");
          setStatusMessage("I'm listening.");
          return;
        }

        normalized = wakeDetection.cleanedCommand;
      }
    }

    const activeCatalog = catalog ?? await fetchCatalog();

    if (!activeCatalog) {
      logVoiceTrace("provider.processTranscript.skip.catalog_unavailable", {
        token,
        hasCatalogInState: Boolean(catalog),
      });
      setPhase("error");
      setErrorCategory("context_unavailable");
      setStatusMessage("Workspace context is unavailable.");
      return;
    }

    const normalizedInput = normalizeIntentInput(normalized);
    if (!normalizedInput) {
      logVoiceTrace("provider.processTranscript.skip.normalization_failed", {
        token,
        normalized,
        trimmed,
      });
      return;
    }

    inFlightIntentRef.current?.abort();
    const controller = new AbortController();
    inFlightIntentRef.current = controller;

    setPhase("understanding");
    setStatusMessage("Understanding...");

    try {
      const requestUrl = typeof window !== "undefined"
        ? `${window.location.origin}${routeContext.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
        : `http://localhost${routeContext.pathname}`;

      logVoiceTrace("intent.request.start", {
        token,
        input: normalizedInput,
      });

      const response = await fetch("/api/orion/command-center", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-orion-company-id": activeCatalog.context.currentCompany.id,
          "x-orion-context-hint": `${activeCatalog.context.currentRoute}:${activeCatalog.context.currentAuthenticatedUser.id}`,
        },
        body: JSON.stringify({
          mode: "intent",
          intent: {
            input: normalizedInput,
            route: {
              pathname: activeCatalog.context.currentRoute || routeContext.pathname,
              projectId: activeCatalog.context.currentProject?.id || routeContext.projectId,
              customerId: activeCatalog.context.currentCustomer?.id || routeContext.customerId,
              estimateId: activeCatalog.context.currentEstimate?.id || routeContext.estimateId,
              invoiceId: activeCatalog.context.currentInvoice?.id || routeContext.invoiceId,
              employeeId: activeCatalog.context.currentEmployee?.id || routeContext.employeeId,
              crewId: activeCatalog.context.currentCrew?.id || routeContext.crewId,
              dashboardWidgetId: activeCatalog.context.currentDashboardWidget || routeContext.dashboardWidgetId,
              timelineItemId: activeCatalog.context.currentTimelineItem || routeContext.timelineItemId,
            },
            sourceUrl: requestUrl,
          },
        }),
      });

      const payload = await response.json() as {
        ok: boolean;
        intent?: OrionIntentResult;
        error?: string;
        statusCategory?: string;
      };

      logVoiceTrace("intent.request.end", {
        token,
        ok: response.ok && payload.ok,
        hasIntent: Boolean(payload.intent),
        statusCategory: payload.statusCategory || null,
      });

      if (!response.ok || !payload.ok || !payload.intent) {
        const category = payload.statusCategory === "permission_denied"
          ? "permission_denied"
          : "no_match";
        setPhase(category === "no_match" ? "no_match" : "error");
        setErrorCategory(category);
        setStatusMessage(userMessageForVoiceCategory(category, payload.error || "Voice intent failed."));
        setResultMessage(payload.error || "No match found.");
        speak(buildVoiceResponse({ status: "error", message: payload.error || "No match found." }).text);
        return;
      }

      const nextIntent = payload.intent;
      setIntentResult(nextIntent);

      if (nextIntent.requiresClarification) {
        const spokenCandidate = resolveSpokenCandidate(normalizedInput, nextIntent.candidates.map((candidate) => ({
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          label: candidate.label,
          subtitle: candidate.subtitle,
          score: candidate.score,
        })));

        if (!spokenCandidate) {
          setPhase("clarification_required");
          setErrorCategory("intent_ambiguous");
          setStatusMessage("I found multiple matches. Which one do you mean?");
          setResultMessage("I found multiple matches. Which one do you mean?");
          speak("I found multiple matches. Which one do you mean?");
          return;
        }
      }

      if (!nextIntent.suggestedCommand || !nextIntent.commandPreview) {
        setPhase("no_match");
        setErrorCategory("no_match");
        setStatusMessage(nextIntent.message || "No matching command found.");
        setResultMessage(nextIntent.message || "No matching command found.");
        return;
      }

      if (nextIntent.commandPreview.confirmationLevel === "REQUIRED") {
        const summary = buildVoiceConfirmationSummary({
          transcript: normalizedInput,
          preview: {
            commandId: nextIntent.commandPreview.commandId,
            target: nextIntent.commandPreview.target,
            confirmationLevel: nextIntent.commandPreview.confirmationLevel,
            expectedOutcome: nextIntent.commandPreview.expectedOutcome,
            eventsThatWillPublish: nextIntent.commandPreview.eventsThatWillPublish,
          },
        });

        setPendingConfirmation({
          commandId: nextIntent.suggestedCommand.commandId,
          params: nextIntent.suggestedCommand.params,
          summary,
        });
        setPhase("confirmation_required");
        setErrorCategory("confirmation_required");
        setStatusMessage(`${summary} Say Confirm or Cancel.`);
        speak("Confirmation is required. Say Confirm or Cancel.");
        return;
      }

      await executeCommand(nextIntent.suggestedCommand.commandId, nextIntent.suggestedCommand.params);
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      setPhase("error");
      setErrorCategory("network_error");
      setStatusMessage("Network error while resolving voice intent.");
    }
  }, [catalog, commandSessionActive, executeCommand, fetchCatalog, pendingConfirmation, routeContext, searchParams, settings.enabled, settings.mode, settings.shortWakePhraseAllowed, settings.spokenResponsesEnabled, settings.wakeAcknowledge, speak, voice]);

  const stopAllListening = useCallback(() => {
    setPhase("stopping");
    setWakeListening(false);
    setCommandSessionActive(false);
    setPendingConfirmation(null);
    inFlightIntentRef.current?.abort();
    inFlightExecuteRef.current?.abort();
    voice.cancel();
    setStatusMessage("Voice stopped.");

    if (settings.enabled) {
      setPhase(settings.mode === "hands_free" ? "waiting_for_wake" : "disabled");
    }
  }, [settings.enabled, settings.mode, voice]);

  const enableGlobalVoice = useCallback(() => {
    const next = { ...settings, enabled: true };
    persistSettings(next);
    setConsentRequired(!next.consentAcknowledged);
    setErrorCategory(null);
    setResultMessage(null);
    setReactivationRequired(false);
    setPhase("permission_required");
    setStatusMessage("Tap once to start Orion voice.");
  }, [persistSettings, settings]);

  const disableGlobalVoice = useCallback(() => {
    const next = { ...settings, enabled: false };
    persistSettings(next);
    stopAllListening();
    setPhase("disabled");
    setStatusMessage("Global Orion Voice is disabled.");
  }, [persistSettings, settings, stopAllListening]);

  const requestVoiceStart = useCallback((reason: "manual" | "hands_free" | "visible_resume") => {
    if (!settingsRef.current.enabled) {
      return;
    }

    if (!voiceRecognitionSupportedRef.current) {
      setPhase("unsupported");
      setErrorCategory("recognition_start_failed");
      setStatusMessage(voiceSupportMessageRef.current);
      return;
    }

    if (voiceStateRef.current === "requesting_permission" || voiceStateRef.current === "listening" || voiceStateRef.current === "processing") {
      return;
    }

    const now = Date.now();
    if (now - lastStartRequestAtRef.current < 350) {
      return;
    }

    lastStartRequestAtRef.current = now;
    if (reason === "visible_resume") {
      visibleResumeAttemptRef.current = true;
    }

    lastModeSwitchAtRef.current = now;
    setPhase("starting");
    setErrorCategory(null);
    setResultMessage(null);
    voiceStartRef.current();
  }, []);

  const startVoiceCapture = useCallback(() => {
    if (!settings.enabled) {
      setPhase("disabled");
      setErrorCategory("voice_disabled");
      setStatusMessage("Enable Global Orion Voice first.");
      return;
    }

    if (!voice.support.recognitionSupported) {
      setPhase("unsupported");
      setErrorCategory("recognition_start_failed");
      setStatusMessage(voice.support.message);
      return;
    }

    if (speechActive) {
      return;
    }

    requestVoiceStart("manual");
  }, [requestVoiceStart, settings.enabled, speechActive, voice.support.message, voice.support.recognitionSupported]);

  const startPressToTalk = useCallback(() => {
    if (settings.mode !== "push_to_talk") {
      return;
    }

    startVoiceCapture();
  }, [settings.mode, startVoiceCapture]);

  const stopPressToTalk = useCallback(() => {
    if (settings.mode !== "push_to_talk") {
      return;
    }

    if (voice.state === "listening" || voice.state === "requesting_permission") {
      setPhase("finalizing");
      voice.stop();
    }
  }, [settings.mode, voice]);

  const toggleTapListening = useCallback(() => {
    if (settings.mode !== "tap_to_listen") {
      return;
    }

    if (voice.state === "listening" || voice.state === "requesting_permission") {
      setPhase("finalizing");
      voice.stop();
      return;
    }

    startVoiceCapture();
  }, [settings.mode, startVoiceCapture, voice]);

  const setMode = useCallback((mode: OrionVoiceCaptureMode | "hands_free") => {
    const next = { ...settings, mode };
    persistSettings(next);
    setWakeListening(mode === "hands_free");
    setCommandSessionActive(false);
    setPendingConfirmation(null);
    setPhase(mode === "hands_free" ? "waiting_for_wake" : settings.enabled ? "permission_required" : "disabled");
    setStatusMessage(mode === "hands_free" ? "Waiting for wake phrase." : "Voice mode updated.");
  }, [persistSettings, settings]);

  const setSpokenResponsesEnabled = useCallback((enabled: boolean) => {
    persistSettings({ ...settings, spokenResponsesEnabled: enabled });
  }, [persistSettings, settings]);

  const setReturnToWakeAfterCommand = useCallback((enabled: boolean) => {
    persistSettings({ ...settings, returnToWakeAfterCommand: enabled });
  }, [persistSettings, settings]);

  const acknowledgeConsent = useCallback(() => {
    const next = { ...settings, consentAcknowledged: true };
    persistSettings(next);
    setConsentRequired(false);
  }, [persistSettings, settings]);

  const startVoiceCommandMode = useCallback(() => {
    setCommandSessionActive(true);
    setWakeListening(false);
    setPhase("listening");
    setStatusMessage("Voice Command Mode activated. I'm listening.");
    speak("Voice Command Mode activated. I'm listening.");
  }, [speak]);

  const endVoiceCommandMode = useCallback(() => {
    setCommandSessionActive(false);
    setPendingConfirmation(null);
    setIntentResult(null);
    setStatusMessage("Voice Command Mode ended.");
    setResultMessage("Voice Command Mode ended.");
    speak("Voice Command Mode ended.");

    if (settings.mode === "hands_free" && settings.returnToWakeAfterCommand) {
      setWakeListening(true);
      setPhase("waiting_for_wake");
    } else {
      setPhase("disabled");
      voice.stop();
    }
  }, [settings.mode, settings.returnToWakeAfterCommand, speak, voice]);

  const confirmPendingCommand = useCallback(() => {
    if (!pendingConfirmation) {
      return;
    }

    const pending = pendingConfirmation;
    setPendingConfirmation(null);
    void executeCommand(pending.commandId, pending.params, pending.summary);
  }, [executeCommand, pendingConfirmation]);

  const cancelPendingCommand = useCallback(() => {
    setPendingConfirmation(null);
    setPhase("success");
    setStatusMessage("Canceled.");
    setResultMessage("Canceled.");
  }, []);

  const retryFromError = useCallback(() => {
    setErrorCategory(null);
    setResultMessage(null);
    if (reactivationRequired) {
      setPhase("reactivation_required");
      setStatusMessage("Global Orion Voice is enabled. Tap once to reactivate the microphone.");
      return;
    }

    setPhase(settings.mode === "hands_free" ? "waiting_for_wake" : "permission_required");
    setStatusMessage("Ready.");
  }, [reactivationRequired, settings.mode]);

  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? safeJsonParse<GlobalOrionVoiceSettings>(window.localStorage.getItem(storageKey))
      : null;

    if (stored) {
      setSettings({ ...defaultSettings(), ...stored });
      setConsentRequired(!stored.consentAcknowledged);
    }

    setSettingsHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      inFlightIntentRef.current?.abort();
      inFlightExecuteRef.current?.abort();
      voiceCancelRef.current();
    };
  }, []);

  useEffect(() => {
    inFlightIntentRef.current?.abort();
    inFlightExecuteRef.current?.abort();
    voice.cancel();
    setCatalog(null);
    setWakeListening(false);
    setCommandSessionActive(false);
    setPendingConfirmation(null);
    setIntentResult(null);
    setStatusMessage("Workspace changed. Voice paused.");
    setPhase(settings.enabled ? "reactivation_required" : "disabled");
  }, [company.companyId, company.userId]);

  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    if (!settings.enabled) {
      setPhase("disabled");
      setWakeListening(false);
      setCommandSessionActive(false);
      return;
    }

    if (!voice.support.recognitionSupported) {
      setPhase("unsupported");
      setErrorCategory("recognition_start_failed");
      return;
    }

    setPhase(settings.mode === "hands_free" ? "waiting_for_wake" : "permission_required");
    setWakeListening(settings.mode === "hands_free");
  }, [settings.enabled, settings.mode, settingsHydrated, voice.support.recognitionSupported]);

  useEffect(() => {
    if (!settings.enabled) {
      return;
    }

    void fetchCatalog();
  }, [fetchCatalog, routeContext.pathname, settings.enabled]);

  useEffect(() => {
    if (!settings.enabled) {
      return;
    }

    if (voice.state === "listening") {
      if (commandSessionActive || settings.mode !== "hands_free") {
        setPhase("listening");
        setStatusMessage("Listening...");
      } else if (wakeListening) {
        setPhase("waiting_for_wake");
        setStatusMessage("Waiting for wake phrase.");
      }
      return;
    }

    if (voice.state === "requesting_permission") {
      setPhase("starting");
      setStatusMessage("Starting microphone...");
      return;
    }

    if (voice.state === "processing") {
      setPhase("finalizing");
      setStatusMessage("Finalizing transcript...");
      return;
    }

    if (voice.state === "error") {
      if (mapVoiceErrorCategory(voice.errorCategory) === "permission_denied") {
        setPhase("permission_denied");
      } else {
        setPhase("error");
      }
      return;
    }

    if (voice.state === "idle" && settings.mode === "hands_free" && wakeListening && !speechActive && !commandSessionActive && !pendingConfirmation) {
      if (Date.now() - lastModeSwitchAtRef.current < 240) {
        return;
      }

      if (!reactivationRequired) {
        requestVoiceStart("hands_free");
      }
    }
  }, [commandSessionActive, pendingConfirmation, reactivationRequired, requestVoiceStart, settings.enabled, settings.mode, speechActive, voice.errorCategory, voice.state, wakeListening]);

  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.hidden || document.visibilityState === "hidden";
      const currentSettings = settingsRef.current;

      logGlobalVisibility("visibilitychange", {
        hidden,
        visibilityState: document.visibilityState,
        enabled: currentSettings.enabled,
        mode: currentSettings.mode,
        currentPhase: phaseRef.current,
      });

      if (!currentSettings.enabled) {
        return;
      }

      if (hidden) {
        hiddenPauseRef.current = true;
        visibleResumeAttemptRef.current = false;
        setWakeListening(false);
        setPhase("stopping");
        setStatusMessage("Voice paused while tab is hidden.");
        voiceStopRef.current();
        logGlobalVisibility("hidden pause requested");
        return;
      }

      if (!hiddenPauseRef.current || document.visibilityState !== "visible") {
        return;
      }

      hiddenPauseRef.current = false;
      logGlobalVisibility("visible resume requested");

      const modeRequiresListening = currentSettings.mode === "hands_free" || commandSessionActiveRef.current;
      const permissionValid = errorCategoryRef.current !== "permission_denied" && errorCategoryRef.current !== "microphone_permission_denied";
      const canAttemptResume = modeRequiresListening
        && permissionValid
        && voiceRecognitionSupportedRef.current
        && !reactivationRequiredRef.current;

      if (!canAttemptResume) {
        if (modeRequiresListening && (!permissionValid || reactivationRequiredRef.current)) {
          visibleResumeAttemptRef.current = false;
          setReactivationRequired(true);
          setPhase("reactivation_required");
          setErrorCategory("reactivation_required");
          setStatusMessage("Global Orion Voice is enabled. Tap once to reactivate the microphone.");
          logGlobalVisibility("reactivation required");
        }
        return;
      }

      if (currentSettings.mode === "hands_free") {
        setWakeListening(true);
        setPhase("waiting_for_wake");
        setStatusMessage("Waiting for wake phrase.");
      }

      requestVoiceStart("visible_resume");
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [requestVoiceStart]);

  useEffect(() => {
    if (!settings.enabled || !commandSessionActive) {
      if (inactivityTimerRef.current !== null) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    const timeoutMs = toTimeoutMs(settings.inactivityTimeout);
    if (timeoutMs === null) {
      return;
    }

    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    inactivityTimerRef.current = window.setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      setCommandSessionActive(false);
      setPendingConfirmation(null);
      setStatusMessage("Voice Command Mode ended due to inactivity.");
      setResultMessage("Voice Command Mode ended due to inactivity.");
      if (settings.mode === "hands_free" && settings.returnToWakeAfterCommand) {
        setWakeListening(true);
        setPhase("waiting_for_wake");
      } else {
        setPhase("disabled");
      }
    }, timeoutMs);

    return () => {
      if (inactivityTimerRef.current !== null) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [commandSessionActive, lastCommandAt, settings.enabled, settings.inactivityTimeout, settings.mode, settings.returnToWakeAfterCommand]);

  useEffect(() => {
    if (!settings.enabled || settings.mode !== "hands_free") {
      return;
    }

    if (voice.errorCategory === "microphone_permission_denied") {
      setReactivationRequired(true);
      setPhase("reactivation_required");
      setErrorCategory("reactivation_required");
      setStatusMessage("Global Orion Voice is enabled. Tap once to reactivate the microphone.");
    }
  }, [settings.enabled, settings.mode, voice.errorCategory]);

  useEffect(() => {
    if (!visibleResumeAttemptRef.current) {
      return;
    }

    if (voice.state === "requesting_permission" || voice.state === "listening" || voice.state === "processing") {
      visibleResumeAttemptRef.current = false;
      return;
    }

    if (voice.state !== "error") {
      return;
    }

    if (voice.errorCategory === "microphone_permission_denied" || voice.errorCategory === "microphone_unavailable" || voice.errorCategory === "speech_recognition_error") {
      visibleResumeAttemptRef.current = false;
      setReactivationRequired(true);
      setPhase("reactivation_required");
      setErrorCategory("reactivation_required");
      setStatusMessage("Global Orion Voice is enabled. Tap once to reactivate the microphone.");
      logGlobalVisibility("reactivation required");
    }
  }, [voice.errorCategory, voice.state]);

  useEffect(() => {
    logDiagnostics(settings.diagnosticsEnabled, "phase", {
      phase,
      micActive,
      wakeListening,
      commandSessionActive,
      route: routeContext.pathname,
    });
  }, [commandSessionActive, micActive, phase, routeContext.pathname, settings.diagnosticsEnabled, wakeListening]);

  const value = useMemo<GlobalOrionVoiceContextValue>(() => ({
    phase,
    mode: settings.mode,
    settings,
    supportMessage: voice.support.message,
    micActive,
    wakeListening,
    commandSessionActive,
    interimTranscript: voice.interimTranscript,
    finalTranscript: voice.finalTranscript,
    resultMessage,
    statusMessage,
    errorCategory,
    intentResult,
    pendingConfirmation,
    canUseHandsFree,
    reactivationRequired,
    consentRequired,
    enableGlobalVoice,
    disableGlobalVoice,
    startPressToTalk,
    stopPressToTalk,
    toggleTapListening,
    setMode,
    setSpokenResponsesEnabled,
    setReturnToWakeAfterCommand,
    acknowledgeConsent,
    startVoiceCommandMode,
    endVoiceCommandMode,
    confirmPendingCommand,
    cancelPendingCommand,
    stopAllListening,
    retryFromError,
  }), [
    acknowledgeConsent,
    canUseHandsFree,
    cancelPendingCommand,
    commandSessionActive,
    confirmPendingCommand,
    consentRequired,
    disableGlobalVoice,
    enableGlobalVoice,
    endVoiceCommandMode,
    errorCategory,
    intentResult,
    micActive,
    pendingConfirmation,
    phase,
    reactivationRequired,
    resultMessage,
    retryFromError,
    setMode,
    setReturnToWakeAfterCommand,
    setSpokenResponsesEnabled,
    settings,
    startPressToTalk,
    startVoiceCommandMode,
    statusMessage,
    stopAllListening,
    stopPressToTalk,
    toggleTapListening,
    voice.finalTranscript,
    voice.interimTranscript,
    voice.support.message,
    wakeListening,
  ]);

  return (
    <GlobalOrionVoiceContext.Provider value={value}>
      {children}
    </GlobalOrionVoiceContext.Provider>
  );
}

export function useGlobalOrionVoice() {
  const context = useContext(GlobalOrionVoiceContext);

  if (!context) {
    throw new Error("useGlobalOrionVoice must be used within GlobalOrionVoiceProvider.");
  }

  return context;
}
