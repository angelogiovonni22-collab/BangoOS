"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayerManager } from "@/components/bangoflow";
import { useFocusTrap } from "@/components/motion";
import { Button, Input, OverlayBackdrop, PortalHost, useBodyScrollLock } from "@/components/ui";
import { useTopmostOverlay } from "@/components/ui/overlay-runtime";
import { OrionHandsFreeToggle, OrionMicrophoneIndicator, OrionVoiceButton, OrionVoiceStatus, OrionVoiceTranscript, OrionWakeStatus, useGlobalOrionVoice } from "@/components/orion/voice";
import { rankActionsWithWorkspaceContext } from "@/lib/orion/command-center";
import { createOrionExecutionEnvelope } from "@/lib/orion/commands/execution-envelope";
import type { OrionIntentResult } from "@/lib/orion/intent-engine";
import { applyOrionCommandNavigationResult } from "@/lib/orion/navigation";
import { buildVoiceConfirmationSummary, detectWakeWord, isCancelPhrase, isWakeWordSupported, parseVoiceConfirmationPhrase, resolveSpokenCandidate } from "@/lib/orion/voice";
import type { OrionVoiceCaptureMode, OrionVoiceErrorCategory, OrionVoiceState } from "@/lib/orion/voice";
import type {
  OrionCommandCenterAction,
  OrionCommandCenterCatalog,
  OrionCustomerRelatedRecords,
  OrionRelatedRecordItem,
} from "@/lib/orion/command-center";

type OrionCommandCenterOverlayProps = {
  open: boolean;
  onClose: () => void;
  currentPath: string;
};

type OrionCommandExecutionResult = {
  success: boolean;
  status: "completed" | "unsupported" | "rejected" | "failed";
  userMessage: string;
  href: string | null;
  details?: Record<string, unknown>;
  requiresConfirmation: boolean;
  confirmationSummary: string | null;
};

type OrionCommandCenterResponse = {
  ok: boolean;
  catalog?: OrionCommandCenterCatalog;
  result?: OrionCommandExecutionResult;
  related?: OrionCustomerRelatedRecords;
  intent?: OrionIntentResult;
  error?: string;
  statusCategory?: string;
  validationErrors?: string[];
};

type OrionContextStatus =
  | "loading"
  | "ready"
  | "no_workspace"
  | "permission_denied"
  | "authentication_required"
  | "error";

type OrionVoiceUiState =
  | "listening"
  | "understanding"
  | "executing"
  | "success"
  | "error"
  | "waiting_for_wake";

const RECENTS_STORAGE_KEY = "bangoos:orion-command-center:recents:v1";
const PINNED_STORAGE_KEY = "bangoos:orion-command-center:pinned:v1";
const VOICE_NOTICE_STORAGE_KEY = "bangoos:orion:voice-notice-ack:v1";
const VOICE_MODE_STORAGE_KEY = "bangoos:orion:voice-mode:v1";
const HANDS_FREE_ENABLED_STORAGE_KEY = "bangoos:orion:hands-free-enabled:v1";
const HANDS_FREE_NOTICE_ACK_STORAGE_KEY = "bangoos:orion:hands-free-notice-ack:v1";
const SPOKEN_RESPONSES_STORAGE_KEY = "bangoos:orion:spoken-responses:v1";
const RETURN_TO_WAKE_STORAGE_KEY = "bangoos:orion:return-to-wake:v1";
const MAX_RECENT_IDS = 8;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function logVoiceTiming(stage: string, details?: Record<string, unknown>) {
  if (IS_PRODUCTION || typeof console === "undefined") {
    return;
  }

  if (details) {
    console.info(`[orion-timing] ${stage}`, details);
    return;
  }

  console.info(`[orion-timing] ${stage}`);
}

function parseStoredCaptureMode() {
  if (typeof window === "undefined") {
    return "push_to_talk" as OrionVoiceCaptureMode;
  }

  try {
    return window.localStorage.getItem(VOICE_MODE_STORAGE_KEY) === "tap_to_listen"
      ? "tap_to_listen"
      : "push_to_talk";
  } catch {
    return "push_to_talk";
  }
}

function userMessageForVoiceCategory(category: OrionVoiceErrorCategory, fallback: string) {
  switch (category) {
    case "microphone_permission_denied":
      return "Microphone permission is denied. Enable microphone access to use voice.";
    case "microphone_unavailable":
      return "Microphone is unavailable right now. Try again or use typed commands.";
    case "speech_recognition_unsupported":
      return "Speech recognition is not supported in this browser.";
    case "speech_recognition_error":
      return "Speech recognition failed. Try again.";
    case "no_speech":
      return "No speech detected. Try again.";
    case "network_error":
      return "Network error while processing voice request.";
    case "context_unavailable":
      return "Workspace context is unavailable. Retry after context loads.";
    case "intent_no_match":
      return "Orion could not match that request. Try a clearer command.";
    case "intent_ambiguous":
      return "Orion found multiple matches. Please choose one.";
    case "permission_denied":
      return "You do not have permission for that command.";
    case "confirmation_required":
      return "Confirmation is required before Orion can continue.";
    case "command_validation_failed":
      return "Command details are incomplete or invalid.";
    case "command_execution_failed":
      return "Orion could not complete that command.";
    case "navigation_failed":
      return "Navigation failed. Try again from the command list.";
    default:
      return fallback;
  }
}

function contextStatusFromResponse(payload: OrionCommandCenterResponse | null, statusCode: number): OrionContextStatus {
  if (statusCode === 401 || payload?.statusCategory === "authentication_required") {
    return "authentication_required";
  }

  if (payload?.statusCategory === "no_workspace") {
    return "no_workspace";
  }

  if (statusCode === 403 || payload?.statusCategory === "permission_denied") {
    return "permission_denied";
  }

  return "error";
}

function parseStoredIds(key: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  } catch {
    return [];
  }
}

function storeIds(key: string, ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Ignore storage write failures.
  }
}

function parseStoredBoolean(key: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function storeBoolean(key: string, value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Ignore storage write failures.
  }
}

function storeString(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures.
  }
}

function buildCurrentUrl(pathname: string, search: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  return `${origin}${pathname}${search ? `?${search}` : ""}`;
}

export function OrionCommandCenterOverlay({ open, onClose, currentPath }: OrionCommandCenterOverlayProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const contextAbortRef = useRef<AbortController | null>(null);
  const relatedAbortRef = useRef<AbortController | null>(null);
  const intentAbortRef = useRef<AbortController | null>(null);
  const voiceCorrelationRef = useRef<string | null>(null);

  const [catalog, setCatalog] = useState<OrionCommandCenterCatalog | null>(null);
  const [contextStatus, setContextStatus] = useState<OrionContextStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [contextReloadToken, setContextReloadToken] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [confirmationArmedId, setConfirmationArmedId] = useState<string | null>(null);
  const [relatedRecords, setRelatedRecords] = useState<OrionCustomerRelatedRecords | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [intentResult, setIntentResult] = useState<OrionIntentResult | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [clarificationCandidateId, setClarificationCandidateId] = useState<string | null>(null);
  const [voiceStatusMessage, setVoiceStatusMessage] = useState("Press and hold the microphone to speak.");
  const [voiceUiState, setVoiceUiState] = useState<OrionVoiceUiState>("listening");
  const [voiceResultMessage, setVoiceResultMessage] = useState<string | null>(null);
  const [voiceErrorCategory, setVoiceErrorCategory] = useState<OrionVoiceErrorCategory | null>(null);
  const [voiceShowNotice, setVoiceShowNotice] = useState(() => !parseStoredBoolean(VOICE_NOTICE_STORAGE_KEY));
  const [voiceCaptureMode, setVoiceCaptureMode] = useState<OrionVoiceCaptureMode>(() => parseStoredCaptureMode());
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(() => parseStoredBoolean(HANDS_FREE_ENABLED_STORAGE_KEY));
  const [handsFreeNoticeAcknowledged, setHandsFreeNoticeAcknowledged] = useState(() => parseStoredBoolean(HANDS_FREE_NOTICE_ACK_STORAGE_KEY));
  const [spokenResponsesEnabled, setSpokenResponsesEnabled] = useState(() => parseStoredBoolean(SPOKEN_RESPONSES_STORAGE_KEY));
  const [returnToWakeListening, setReturnToWakeListening] = useState(() => parseStoredBoolean(RETURN_TO_WAKE_STORAGE_KEY));
  const [wakeListening, setWakeListening] = useState(false);
  const [wakeStatusMessage, setWakeStatusMessage] = useState("Wake mode is off.");
  const [wakeSupported] = useState(() => (typeof window !== "undefined" ? isWakeWordSupported(window) : false));
  const [voiceConfirmationPending, setVoiceConfirmationPending] = useState<{
    commandId: string;
    params: Record<string, unknown>;
    summary: string;
    actionId: string | null;
  } | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => parseStoredIds(RECENTS_STORAGE_KEY));
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => parseStoredIds(PINNED_STORAGE_KEY));
  const skipNextDebouncedIntentRef = useRef(false);
  const voiceTranscriptTokenRef = useRef(0);
  const lastHandledTranscriptRef = useRef<string | null>(null);
  const navigationTimingRef = useRef<{ href: string; startedAt: number } | null>(null);
  const voiceTimingRef = useRef<{
    microphoneReleaseAt: number | null;
    finalResultAt: number | null;
    intentStartAt: number | null;
    intentEndAt: number | null;
    executeStartAt: number | null;
    executeEndAt: number | null;
    uiRenderedAt: number | null;
  }>({
    microphoneReleaseAt: null,
    finalResultAt: null,
    intentStartAt: null,
    intentEndAt: null,
    executeStartAt: null,
    executeEndAt: null,
    uiRenderedAt: null,
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[orion-debug] command center mounted");
    }
  }, []);

  function resetVoiceTiming() {
    voiceTimingRef.current = {
      microphoneReleaseAt: null,
      finalResultAt: null,
      intentStartAt: null,
      intentEndAt: null,
      executeStartAt: null,
      executeEndAt: null,
      uiRenderedAt: null,
    };
  }

  function logVoiceTimingBreakdown(outcome: "success" | "error") {
    const marks = voiceTimingRef.current;
    const finalToIntentMs = marks.finalResultAt !== null && marks.intentEndAt !== null
      ? Number((marks.intentEndAt - marks.finalResultAt).toFixed(1))
      : null;
    const finalToExecuteMs = marks.finalResultAt !== null && marks.executeEndAt !== null
      ? Number((marks.executeEndAt - marks.finalResultAt).toFixed(1))
      : null;
    const finalToRenderedMs = marks.finalResultAt !== null && marks.uiRenderedAt !== null
      ? Number((marks.uiRenderedAt - marks.finalResultAt).toFixed(1))
      : null;

    logVoiceTiming("voice.pipeline.breakdown", {
      outcome,
      finalToIntentMs,
      finalToExecuteMs,
      finalToRenderedMs,
    });
  }

  function startWakeListeningSession() {
    if (process.env.NODE_ENV !== "production") {
      console.info("[orion-debug] start wake requested");
    }
    if (!wakeSupported || voice.state === "listening" || voice.state === "requesting_permission") {
      return;
    }

    voice.start();
  }

  function stopWakeListeningSession() {
    if (voice.state === "listening" || voice.state === "requesting_permission" || voice.state === "processing") {
      voice.cancel();
    }
  }

  async function handleVoiceTranscript(transcript: string) {
    if (!open) {
      return;
    }

    let trimmed = transcript.trim();
    if (!trimmed) {
      return;
    }

    if (lastHandledTranscriptRef.current === trimmed) {
      return;
    }

    const requestToken = voiceTranscriptTokenRef.current + 1;
    voiceTranscriptTokenRef.current = requestToken;
    lastHandledTranscriptRef.current = trimmed;
    voiceTimingRef.current.finalResultAt = nowMs();
    logVoiceTiming("speech.final_result", { requestToken });
    setVoiceUiState("understanding");
    setVoiceStatusMessage("Understanding...");

    if (handsFreeEnabled && wakeListening) {
      const wakeDetection = detectWakeWord(trimmed, {
        enabled: ["hey_orion", "orion", "okay_orion"],
      });

      if (!wakeDetection.detected) {
        setVoiceUiState("waiting_for_wake");
        setVoiceStatusMessage("Wake phrase not detected. Say Hey Orion.");
        setWakeStatusMessage("Waiting for wake phrase.");
        return;
      }

      setWakeListening(false);
      setVoiceUiState("listening");
      setWakeStatusMessage("Wake phrase detected.");
      setVoiceStatusMessage("Listening for your command.");

      if (!wakeDetection.cleanedCommand) {
        return;
      }

      trimmed = wakeDetection.cleanedCommand;
    }

    if (contextStatus !== "ready" || !catalog) {
      setVoiceUiState("error");
      setVoiceErrorCategory("context_unavailable");
      const message = userMessageForVoiceCategory("context_unavailable", "Workspace context is still loading.");
      setVoiceStatusMessage(message);
      setVoiceResultMessage(message);
      return;
    }

    skipNextDebouncedIntentRef.current = true;
    setQuery(trimmed);
    setClarificationCandidateId(null);

    if (voiceConfirmationPending) {
      const phrase = parseVoiceConfirmationPhrase(trimmed);
      if (phrase === "cancel") {
        setVoiceConfirmationPending(null);
        setVoiceUiState("error");
        setVoiceStatusMessage("Voice confirmation canceled.");
        setVoiceResultMessage("Canceled.");
        return;
      }

      if (phrase === "confirm") {
        setVoiceUiState("executing");
        setVoiceStatusMessage("Executing confirmed voice command.");
        await executeResolvedCommandWithConfirmation({
          commandId: voiceConfirmationPending.commandId,
          commandParams: voiceConfirmationPending.params,
          confirmationSummary: voiceConfirmationPending.summary,
          actionId: voiceConfirmationPending.actionId,
        });
        return;
      }

      setVoiceStatusMessage("Please say confirm to continue or cancel to stop.");
      return;
    }

    if (isCancelPhrase(trimmed)) {
      setVoiceUiState("error");
      setVoiceStatusMessage("Voice request canceled.");
      setVoiceResultMessage("Canceled.");
      return;
    }

    setVoiceUiState("understanding");
    setVoiceStatusMessage("Understanding...");

    intentAbortRef.current?.abort();
    const intentController = new AbortController();
    intentAbortRef.current = intentController;

    let payload: OrionCommandCenterResponse;
    let response: Response;

    try {
      voiceTimingRef.current.intentStartAt = nowMs();
      logVoiceTiming("intent.request.start", { requestToken });
      const currentSearch = searchParams.toString();
      const url = buildCurrentUrl(currentPath, currentSearch);
      response = await fetch("/api/orion/command-center", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-orion-voice-turn": "1",
          "x-orion-company-id": catalog.context.currentCompany.id,
          "x-orion-context-hint": `${catalog.context.currentRoute}:${catalog.context.currentAuthenticatedUser.id}`,
        },
        signal: intentController.signal,
        body: JSON.stringify({
          mode: "intent",
          intent: {
            input: trimmed,
            route: {
              pathname: catalog.context.currentRoute || currentPath,
              projectId: catalog.context.currentProject?.id || null,
              customerId: catalog.context.currentCustomer?.id || null,
              estimateId: catalog.context.currentEstimate?.id || null,
              invoiceId: catalog.context.currentInvoice?.id || null,
              employeeId: catalog.context.currentEmployee?.id || null,
              crewId: catalog.context.currentCrew?.id || null,
              dashboardWidgetId: catalog.context.currentDashboardWidget || null,
              timelineItemId: catalog.context.currentTimelineItem || null,
            },
            selectedCandidateId: clarificationCandidateId,
            pinnedCommandIds: pinnedIds,
            recentCommandIds: recentIds,
            sourceUrl: url,
          },
        }),
      });

      payload = await response.json() as OrionCommandCenterResponse;
      voiceTimingRef.current.intentEndAt = nowMs();
      logVoiceTiming("intent.request.end", {
        requestToken,
        elapsedMs: Number((voiceTimingRef.current.intentEndAt - (voiceTimingRef.current.intentStartAt || voiceTimingRef.current.intentEndAt)).toFixed(1)),
      });
    } catch {
      setVoiceUiState("error");
      setVoiceErrorCategory("network_error");
      const message = userMessageForVoiceCategory("network_error", "Voice intent request failed.");
      setVoiceStatusMessage(message);
      setVoiceResultMessage(message);
      return;
    }

    if (!response.ok || !payload.ok || !payload.intent) {
      setVoiceUiState("error");
      const category = payload.statusCategory === "permission_denied"
        ? "permission_denied"
        : payload.statusCategory === "command_validation_failed"
          ? "command_validation_failed"
          : "intent_no_match";
      setVoiceErrorCategory(category);
      const failureMessage = payload.error || userMessageForVoiceCategory(category, "Voice intent failed.");
      setVoiceStatusMessage("Unable to resolve voice intent. You can still type your request.");
      setVoiceResultMessage(failureMessage);
      globalVoice.requestSpokenResponse({
        status: "error",
        message: failureMessage,
      });
      return;
    }

    const nextIntent = payload.intent;
    setIntentResult(nextIntent);

    if ((payload.statusCategory || "").startsWith("workflow_") && !nextIntent.suggestedCommand) {
      const workflowMessage = nextIntent.message || "Workflow step ready.";
      const isCanceled = payload.statusCategory === "workflow_canceled";
      const isNotEnabled = payload.statusCategory === "workflow_not_enabled";
      const isDone = payload.statusCategory === "workflow_completed";

      setVoiceErrorCategory(isNotEnabled ? "intent_no_match" : null);
      setVoiceUiState(isDone ? "success" : isCanceled || isNotEnabled ? "error" : "understanding");
      setVoiceStatusMessage(workflowMessage);
      setVoiceResultMessage(workflowMessage);
      globalVoice.requestSpokenResponse({
        status: isNotEnabled ? "error" : isDone ? "success" : "processing",
        message: workflowMessage,
      });
      return;
    }

    if (nextIntent.requiresClarification) {
      const spokenCandidate = resolveSpokenCandidate(trimmed, nextIntent.candidates.map((candidate) => ({
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        label: candidate.label,
        subtitle: candidate.subtitle,
        score: candidate.score,
      })));

      if (spokenCandidate) {
        setClarificationCandidateId(spokenCandidate.entityId);
        setVoiceUiState("understanding");
        setVoiceStatusMessage(`Selected ${spokenCandidate.label}. Resolving command.`);
        return;
      }

      setVoiceUiState("understanding");
      setVoiceErrorCategory("intent_ambiguous");
      setVoiceStatusMessage("I found multiple matches. Please choose one.");
      setVoiceResultMessage("I found multiple matches. Please choose one.");
      globalVoice.requestSpokenResponse({
        status: "clarification",
      });
      return;
    }

    if (!nextIntent.suggestedCommand || !nextIntent.commandPreview) {
      setVoiceUiState("error");
      const noMatchMessage = nextIntent.message || "No matching command found.";
      setVoiceErrorCategory("intent_no_match");
      setVoiceStatusMessage(noMatchMessage);
      setVoiceResultMessage(noMatchMessage);
      globalVoice.requestSpokenResponse({
        status: "error",
        message: noMatchMessage,
      });
      return;
    }

    setVoiceResultMessage(nextIntent.message || "Intent resolved.");

    if (nextIntent.commandPreview.confirmationLevel === "REQUIRED") {
      const summary = buildVoiceConfirmationSummary({
        transcript: trimmed,
        preview: {
          commandId: nextIntent.commandPreview.commandId,
          target: nextIntent.commandPreview.target,
          confirmationLevel: nextIntent.commandPreview.confirmationLevel,
          expectedOutcome: nextIntent.commandPreview.expectedOutcome,
          eventsThatWillPublish: nextIntent.commandPreview.eventsThatWillPublish,
        },
        amountText: trimmed.includes("dollar") ? trimmed : null,
      });

      setVoiceConfirmationPending({
        commandId: nextIntent.suggestedCommand.commandId,
        params: nextIntent.suggestedCommand.params,
        summary,
        actionId: null,
      });
      setVoiceErrorCategory("confirmation_required");
      setVoiceUiState("understanding");
      setVoiceStatusMessage(`Confirmation required. ${summary} Say confirm to continue or cancel to stop.`);
      globalVoice.requestSpokenResponse({
        status: "confirmation_required",
      });
      return;
    }

    setVoiceUiState("executing");
    if (nextIntent.suggestedCommand.commandId === "dashboard.open") {
      const deepLink = String(nextIntent.suggestedCommand.params.deepLink || "");
      if (deepLink) {
        const destination = deepLink.replace(/^\//, "");
        setVoiceStatusMessage(`Opening ${destination}.`);
      } else {
        setVoiceStatusMessage("Executing voice command.");
      }
    } else {
      setVoiceStatusMessage("Executing voice command.");
    }
    await executeResolvedCommandWithConfirmation({
      commandId: nextIntent.suggestedCommand.commandId,
      commandParams: nextIntent.suggestedCommand.params,
      actionId: null,
    });
  }

  const globalVoice = useGlobalOrionVoice();
  const voice = {
    state: (globalVoice.micActive ? "listening" : "idle") as OrionVoiceState,
    interimTranscript: globalVoice.interimTranscript,
    finalTranscript: globalVoice.finalTranscript,
    errorMessage: globalVoice.errorCategory
      ? userMessageForVoiceCategory(globalVoice.errorCategory as OrionVoiceErrorCategory, globalVoice.statusMessage)
      : null,
    support: { message: globalVoice.supportMessage },
    muted: !globalVoice.settings.spokenResponsesEnabled,
    start: () => {
      if (!globalVoice.settings.enabled) {
        globalVoice.enableGlobalVoice();
      }

      if (globalVoice.mode === "push_to_talk") {
        globalVoice.startPressToTalk();
        return;
      }

      globalVoice.toggleTapListening();
    },
    stop: () => {
      if (globalVoice.mode === "push_to_talk") {
        globalVoice.stopPressToTalk();
        return;
      }

      globalVoice.toggleTapListening();
    },
    cancel: () => {
      globalVoice.stopAllListening();
    },
    restart: () => {
      globalVoice.retryFromError();
      if (globalVoice.mode === "push_to_talk") {
        globalVoice.startPressToTalk();
      } else {
        globalVoice.toggleTapListening();
      }
    },
    retry: () => {
      globalVoice.retryFromError();
    },
    setMuted: (next: boolean) => {
      globalVoice.setSpokenResponsesEnabled(!next);
    },
    setState: (_next: string) => {
      // Global provider owns canonical phase transitions.
    },
  };

  useEffect(() => {
    if (globalVoice.mode === "hands_free") {
      setVoiceCaptureMode("tap_to_listen");
    } else {
      setVoiceCaptureMode(globalVoice.mode);
    }

    setHandsFreeEnabled(globalVoice.mode === "hands_free");
    setWakeListening(globalVoice.wakeListening);
    setVoiceStatusMessage(globalVoice.statusMessage);
    if (globalVoice.resultMessage) {
      setVoiceResultMessage(globalVoice.resultMessage);
    }

    const nextUiState: OrionVoiceUiState = globalVoice.phase === "waiting_for_wake"
      ? "waiting_for_wake"
      : globalVoice.phase === "understanding" || globalVoice.phase === "clarification_required" || globalVoice.phase === "confirmation_required"
        ? "understanding"
        : globalVoice.phase === "executing"
          ? "executing"
          : globalVoice.phase === "success"
            ? "success"
            : globalVoice.phase === "error" || globalVoice.phase === "permission_denied" || globalVoice.phase === "reactivation_required"
              ? "error"
              : "listening";
    setVoiceUiState(nextUiState);
  }, [globalVoice.mode, globalVoice.phase, globalVoice.resultMessage, globalVoice.statusMessage, globalVoice.wakeListening]);
  const cancelVoice = () => {
    // Command center close should not stop global voice session.
  };
  const previousOpenPathRef = useRef<string | null>(null);

  const handleClose = () => {
    contextAbortRef.current?.abort();
    intentAbortRef.current?.abort();
    relatedAbortRef.current?.abort();
    setVoiceConfirmationPending(null);
    onClose();
  };

  const isTopmost = useTopmostOverlay(open);

  useBodyScrollLock(open);
  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: handleClose,
  });

  useEffect(() => {
    storeString(VOICE_MODE_STORAGE_KEY, voiceCaptureMode);
  }, [voiceCaptureMode]);

  useEffect(() => {
    storeBoolean(HANDS_FREE_ENABLED_STORAGE_KEY, handsFreeEnabled);
  }, [handsFreeEnabled]);

  useEffect(() => {
    storeBoolean(SPOKEN_RESPONSES_STORAGE_KEY, spokenResponsesEnabled);
  }, [spokenResponsesEnabled]);

  useEffect(() => {
    storeBoolean(RETURN_TO_WAKE_STORAGE_KEY, returnToWakeListening);
  }, [returnToWakeListening]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    contextAbortRef.current?.abort();
    contextAbortRef.current = controller;

    const load = async () => {
      setContextStatus("loading");
      setErrorMessage(null);
      setCatalog(null);
      setRelatedRecords(null);
      const contextLookupStartedAt = nowMs();
      logVoiceTiming("context.lookup.start");

      try {
        const currentSearch = searchParams.toString();
        const url = buildCurrentUrl(currentPath, currentSearch);
        const response = await fetch(`/api/orion/command-center?url=${encodeURIComponent(url)}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "x-orion-context-hint": `${currentPath}:overlay-open`,
          },
          signal: controller.signal,
        });
        const payload = await response.json() as OrionCommandCenterResponse;

        if (!response.ok || !payload.ok || !payload.catalog) {
          logVoiceTiming("context.lookup.end", {
            elapsedMs: Number((nowMs() - contextLookupStartedAt).toFixed(1)),
            ok: false,
          });
          setContextStatus(contextStatusFromResponse(payload, response.status));
          setErrorMessage(payload.error || "Unable to load Orion Command Center.");
          return;
        }

        setCatalog(payload.catalog);
        logVoiceTiming("context.lookup.end", {
          elapsedMs: Number((nowMs() - contextLookupStartedAt).toFixed(1)),
          ok: true,
        });
        setContextStatus("ready");
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        logVoiceTiming("context.lookup.end", {
          elapsedMs: Number((nowMs() - contextLookupStartedAt).toFixed(1)),
          ok: false,
        });
        setContextStatus("error");
        setErrorMessage("Unable to load Orion Command Center.");
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [contextReloadToken, currentPath, open, searchParams]);

  useEffect(() => {
    if (!open || !query.trim() || !catalog) {
      return;
    }

    if (skipNextDebouncedIntentRef.current) {
      skipNextDebouncedIntentRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const resolveIntent = async () => {
        intentAbortRef.current?.abort();
        const controller = new AbortController();
        intentAbortRef.current = controller;
        setLoadingIntent(true);
        try {
          const currentSearch = searchParams.toString();
          const url = buildCurrentUrl(currentPath, currentSearch);
          const response = await fetch("/api/orion/command-center", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-orion-company-id": catalog.context.currentCompany.id,
              "x-orion-context-hint": `${catalog.context.currentRoute}:${catalog.context.currentAuthenticatedUser.id}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
              mode: "intent",
              intent: {
                input: query,
                route: {
                  pathname: catalog.context.currentRoute,
                  projectId: catalog.context.currentProject?.id || null,
                  customerId: catalog.context.currentCustomer?.id || null,
                  estimateId: catalog.context.currentEstimate?.id || null,
                  invoiceId: catalog.context.currentInvoice?.id || null,
                  employeeId: catalog.context.currentEmployee?.id || null,
                  crewId: catalog.context.currentCrew?.id || null,
                  dashboardWidgetId: catalog.context.currentDashboardWidget,
                  timelineItemId: catalog.context.currentTimelineItem,
                },
                selectedCandidateId: clarificationCandidateId,
                pinnedCommandIds: pinnedIds,
                recentCommandIds: recentIds,
                sourceUrl: url,
              },
            }),
          });

          const payload = await response.json() as OrionCommandCenterResponse;
          if (!controller.signal.aborted) {
            setIntentResult(response.ok && payload.ok ? payload.intent || null : null);
          }
        } catch {
          if (!controller.signal.aborted) {
            setIntentResult(null);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoadingIntent(false);
          }
        }
      };

      void resolveIntent();
    }, 220);

    return () => {
      intentAbortRef.current?.abort();
      window.clearTimeout(timeoutId);
    };
  }, [catalog, clarificationCandidateId, currentPath, open, pinnedIds, query, recentIds, searchParams]);

  const activeIntentResult = open && query.trim() ? intentResult : null;
  const activeLoadingIntent = open && query.trim() ? loadingIntent : false;

  useEffect(() => {
    if (!open || !isTopmost) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelVoice();
        setVoiceConfirmationPending(null);
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [cancelVoice, isTopmost, onClose, open]);

  useEffect(() => {
    if (!open) {
      contextAbortRef.current?.abort();
      intentAbortRef.current?.abort();
      relatedAbortRef.current?.abort();
      previousOpenPathRef.current = null;
    }
  }, [cancelVoice, open]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setWakeListening(false);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cancelVoice]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!previousOpenPathRef.current) {
      previousOpenPathRef.current = currentPath;
      return;
    }

    if (previousOpenPathRef.current !== currentPath) {
      previousOpenPathRef.current = currentPath;
    }
  }, [cancelVoice, currentPath, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!voiceResultMessage && !resultMessage) {
      return;
    }

    voiceTimingRef.current.uiRenderedAt = nowMs();
    logVoiceTiming("ui.result.rendered");
    logVoiceTimingBreakdown(voiceUiState === "error" ? "error" : "success");
  }, [open, resultMessage, voiceResultMessage, voiceUiState]);

  useEffect(() => {
    if (!navigationTimingRef.current) {
      return;
    }

    const pending = navigationTimingRef.current;
    const elapsedMs = Number((nowMs() - pending.startedAt).toFixed(1));
    logVoiceTiming("navigation.complete", { href: pending.href, elapsedMs, currentPath });
    navigationTimingRef.current = null;
  }, [currentPath]);

  useEffect(() => {
    if (!open || !catalog?.context.currentCustomer?.id || relatedRecords) {
      return;
    }

    const controller = new AbortController();
    relatedAbortRef.current?.abort();
    relatedAbortRef.current = controller;

    const loadRelated = async () => {
      setLoadingRelated(true);
      try {
        const response = await fetch(
          `/api/orion/command-center?mode=related&entityType=customer&customerId=${catalog.context.currentCustomer?.id}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "x-orion-company-id": catalog.context.currentCompany.id,
              "x-orion-context-hint": `${catalog.context.currentRoute}:${catalog.context.currentAuthenticatedUser.id}`,
            },
            signal: controller.signal,
          },
        );

        const payload = await response.json() as OrionCommandCenterResponse;
        if (!response.ok || !payload.ok || !payload.related) {
          return;
        }

        if (!controller.signal.aborted) {
          setRelatedRecords(payload.related);
        }
      } catch {
        // Related records are non-blocking for command center execution.
      } finally {
        if (!controller.signal.aborted) {
          setLoadingRelated(false);
        }
      }
    };

    void loadRelated();

    return () => {
      controller.abort();
    };
  }, [
    catalog?.context.currentAuthenticatedUser.id,
    catalog?.context.currentCompany.id,
    catalog?.context.currentCustomer?.id,
    catalog?.context.currentRoute,
    open,
    relatedRecords,
  ]);

  const rankedActions = useMemo(
    () => rankActionsWithWorkspaceContext({
      actions: catalog?.actions || [],
      query,
      context: catalog?.context || {
        currentPage: "Workspace",
        currentRoute: currentPath,
        currentProject: null,
        currentCustomer: null,
        currentEstimate: null,
        currentInvoice: null,
        currentEmployee: null,
        currentCrew: null,
        currentDashboardWidget: null,
        currentTimelineItem: null,
        currentCompany: { id: "", label: "Company" },
        currentAuthenticatedUser: { id: "", label: "User" },
        focusArea: "general",
      },
      recentIds,
      pinnedIds,
    }),
    [catalog?.actions, catalog?.context, currentPath, pinnedIds, query, recentIds],
  );

  const resolvedActiveIndex = rankedActions.length === 0
    ? 0
    : Math.min(activeIndex, rankedActions.length - 1);

  const selectedAction = rankedActions[resolvedActiveIndex] || null;

  const recentActionItems = useMemo(
    () => recentIds.map((id) => catalog?.actions.find((action) => action.id === id)).filter((action): action is OrionCommandCenterAction => Boolean(action)),
    [catalog?.actions, recentIds],
  );

  const pinnedActionItems = useMemo(
    () => pinnedIds.map((id) => catalog?.actions.find((action) => action.id === id)).filter((action): action is OrionCommandCenterAction => Boolean(action)),
    [catalog?.actions, pinnedIds],
  );

  const suggestedActions = useMemo(() => {
    const suggestedIds = new Set(catalog?.suggestedActionIds || []);
    return rankedActions.filter((action) => suggestedIds.has(action.id)).slice(0, 8);
  }, [catalog?.suggestedActionIds, rankedActions]);

  const handleTogglePinned = (actionId: string) => {
    setPinnedIds((current) => {
      const next = current.includes(actionId)
        ? current.filter((entry) => entry !== actionId)
        : [actionId, ...current].slice(0, MAX_RECENT_IDS);
      storeIds(PINNED_STORAGE_KEY, next);
      return next;
    });
  };

  const markRecent = (actionId: string) => {
    setRecentIds((current) => {
      const next = [actionId, ...current.filter((entry) => entry !== actionId)].slice(0, MAX_RECENT_IDS);
      storeIds(RECENTS_STORAGE_KEY, next);
      return next;
    });
  };

  const handleExecute = async (action: OrionCommandCenterAction) => {
    if (isRunning) {
      return;
    }

    if (action.confirmationLevel !== "NONE" && confirmationArmedId !== action.id) {
      setConfirmationArmedId(action.id);
      setResultMessage("Run this command again to confirm execution.");
      return;
    }

    setIsRunning(true);
    setResultMessage(null);

    try {
      const executionEnvelope = createOrionExecutionEnvelope(action.commandId);
      const response = await fetch("/api/orion/command-center", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-orion-company-id": catalog?.context.currentCompany.id || "",
          "x-orion-context-hint": `${catalog?.context.currentRoute || currentPath}:${catalog?.context.currentAuthenticatedUser.id || "unknown"}`,
        },
        body: JSON.stringify({
          commandId: action.commandId,
          params: action.params,
          correlationId: executionEnvelope.correlationId,
          idempotencyKey: executionEnvelope.idempotencyKey,
          confirmation: action.confirmationLevel === "NONE"
            ? undefined
            : { confirmed: true, summary: "Confirmed from Orion Command Center" },
        }),
      });

      let payload: OrionCommandCenterResponse;
      try {
        payload = await response.json() as OrionCommandCenterResponse;
      } catch {
        setResultMessage("Command request failed before Orion could parse a response.");
        return;
      }

      if (!response.ok || !payload.ok || !payload.result) {
        setResultMessage(payload.error || "Command execution failed.");
        return;
      }

      const result = payload.result;
      setResultMessage(result.userMessage);
      setConfirmationArmedId(null);
      markRecent(action.id);

      const canGoBack = typeof window !== "undefined" && window.history.length > 1;
      const navigationOutcome = applyOrionCommandNavigationResult({
        result,
        canGoBack,
        goBack: () => {
          router.back();
        },
        push: (href) => {
          router.push(href);
        },
      });

      if (navigationOutcome.usedFallback) {
        const fallbackMessage = typeof result.details?.fallbackMessage === "string"
          ? result.details.fallbackMessage
          : "No previous page in history. Opening Dashboard.";
        setResultMessage(fallbackMessage);
      }

      if (navigationOutcome.performed) {
        handleClose();
      }
    } catch {
      setResultMessage("Network error while executing command.");
    } finally {
      setIsRunning(false);
    }
  };

  const executeResolvedCommand = async (commandId: string, params: Record<string, unknown>) => {
    if (isRunning) {
      return;
    }

    const hasKnownCommand = Boolean(catalog?.actions.some((action) => action.commandId === commandId));
    if (!hasKnownCommand) {
      setResultMessage(`Unsupported command ID from intent: ${commandId}.`);
      setVoiceErrorCategory("command_validation_failed");
      return;
    }

    setIsRunning(true);
    setResultMessage(null);

    try {
      const executionEnvelope = createOrionExecutionEnvelope(commandId);
      const response = await fetch("/api/orion/command-center", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-orion-company-id": catalog?.context.currentCompany.id || "",
          "x-orion-context-hint": `${catalog?.context.currentRoute || currentPath}:${catalog?.context.currentAuthenticatedUser.id || "unknown"}`,
        },
        body: JSON.stringify({
          commandId,
          params,
          correlationId: executionEnvelope.correlationId,
          idempotencyKey: executionEnvelope.idempotencyKey,
        }),
      });

      let payload: OrionCommandCenterResponse;
      try {
        payload = await response.json() as OrionCommandCenterResponse;
      } catch {
        setResultMessage("Command request failed before Orion could parse a response.");
        return;
      }

      if (!response.ok || !payload.ok || !payload.result) {
        setResultMessage(payload.error || "Command execution failed.");
        return;
      }

      const result = payload.result;
      setResultMessage(result.userMessage);

      const matchingAction = catalog?.actions.find((action) => action.commandId === commandId);
      if (matchingAction) {
        markRecent(matchingAction.id);
      }

      const canGoBack = typeof window !== "undefined" && window.history.length > 1;
      const navigationOutcome = applyOrionCommandNavigationResult({
        result,
        canGoBack,
        goBack: () => {
          router.back();
        },
        push: (href) => {
          router.push(href);
        },
      });

      if (navigationOutcome.usedFallback) {
        const fallbackMessage = typeof result.details?.fallbackMessage === "string"
          ? result.details.fallbackMessage
          : "No previous page in history. Opening Dashboard.";
        setResultMessage(fallbackMessage);
      }

      if (navigationOutcome.performed) {
        handleClose();
      }
    } catch {
      setResultMessage("Network error while executing command.");
    } finally {
      setIsRunning(false);
    }
  };

  const executeResolvedCommandWithConfirmation = async (params: {
    commandId: string;
    commandParams: Record<string, unknown>;
    confirmationSummary?: string;
    actionId?: string | null;
  }) => {
    if (isRunning) {
      return;
    }

    const hasKnownCommand = Boolean(catalog?.actions.some((action) => action.commandId === params.commandId));
    if (!hasKnownCommand) {
      const message = `Unsupported command ID from intent: ${params.commandId}.`;
      setVoiceUiState("error");
      setVoiceErrorCategory("command_validation_failed");
      setResultMessage(message);
      setVoiceResultMessage(message);
      setVoiceStatusMessage(userMessageForVoiceCategory("command_validation_failed", message));
      voice.setState("error");
      return;
    }

    setIsRunning(true);
  setVoiceUiState("executing");
    setResultMessage(null);
    setVoiceResultMessage(null);
  voiceTimingRef.current.executeStartAt = nowMs();
  logVoiceTiming("command.execute.start", { commandId: params.commandId });

    try {
      const executionEnvelope = createOrionExecutionEnvelope(params.commandId);
      voiceCorrelationRef.current = executionEnvelope.correlationId;

      const response = await fetch("/api/orion/command-center", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-orion-company-id": catalog?.context.currentCompany.id || "",
          "x-orion-context-hint": `${catalog?.context.currentRoute || currentPath}:${catalog?.context.currentAuthenticatedUser.id || "unknown"}`,
        },
        body: JSON.stringify({
          commandId: params.commandId,
          params: params.commandParams,
          correlationId: executionEnvelope.correlationId,
          idempotencyKey: executionEnvelope.idempotencyKey,
          confirmation: params.confirmationSummary
            ? { confirmed: true, summary: params.confirmationSummary }
            : undefined,
        }),
      });

      let payload: OrionCommandCenterResponse;
      try {
        payload = await response.json() as OrionCommandCenterResponse;
      } catch {
        const parseMessage = "Command request failed before Orion could parse a response.";
        setVoiceUiState("error");
        setVoiceErrorCategory("command_execution_failed");
        setResultMessage(parseMessage);
        setVoiceResultMessage(parseMessage);
        setVoiceStatusMessage(userMessageForVoiceCategory("command_execution_failed", parseMessage));
        voice.setState("error");
        return;
      }

      if (!response.ok || !payload.ok || !payload.result) {
        const category = payload.statusCategory === "permission_denied"
          ? "permission_denied"
          : payload.statusCategory === "command_validation_failed"
            ? "command_validation_failed"
            : "command_execution_failed";
        const message = payload.error || userMessageForVoiceCategory(category, "Command execution failed.");
        setVoiceUiState("error");
        setVoiceErrorCategory(category);
        setResultMessage(message);
        setVoiceResultMessage(message);
        setVoiceStatusMessage(userMessageForVoiceCategory(category, message));
        voice.setState("error");
        globalVoice.requestSpokenResponse({
          status: "error",
          commandId: params.commandId,
          message,
        });
        return;
      }

      const result = payload.result;
      setResultMessage(result.userMessage);
      setVoiceResultMessage(result.userMessage);
      setVoiceStatusMessage("Voice request completed.");
      setVoiceErrorCategory(null);
      setVoiceConfirmationPending(null);
      setVoiceUiState("success");
      voice.setState("success");
      voiceTimingRef.current.executeEndAt = nowMs();
      logVoiceTiming("command.execute.end", {
        commandId: params.commandId,
        elapsedMs: Number((voiceTimingRef.current.executeEndAt - (voiceTimingRef.current.executeStartAt || voiceTimingRef.current.executeEndAt)).toFixed(1)),
      });

      if (params.actionId) {
        markRecent(params.actionId);
      } else {
        const matchingAction = catalog?.actions.find((action) => action.commandId === params.commandId);
        if (matchingAction) {
          markRecent(matchingAction.id);
        }
      }

      globalVoice.requestSpokenResponse({
        status: "success",
        commandId: params.commandId,
        targetLabel: result.href || undefined,
        message: result.userMessage,
      });

      const canGoBack = typeof window !== "undefined" && window.history.length > 1;
      const navigationOutcome = applyOrionCommandNavigationResult({
        result,
        canGoBack,
        goBack: () => {
          router.back();
        },
        push: (href) => {
          navigationTimingRef.current = { href, startedAt: nowMs() };
          logVoiceTiming("navigation.start", { href });
          router.push(href);
          logVoiceTiming("navigation.end", { href, elapsedMs: 0 });
        },
      });

      if (navigationOutcome.mode === "back") {
        logVoiceTiming("navigation.start", { mode: "back" });
        logVoiceTiming("navigation.end", { mode: "back", elapsedMs: 0 });
      }

      if (navigationOutcome.usedFallback) {
        const fallbackMessage = typeof result.details?.fallbackMessage === "string"
          ? result.details.fallbackMessage
          : "No previous page in history. Opening Dashboard.";
        setVoiceStatusMessage(fallbackMessage);
        setVoiceResultMessage(fallbackMessage);
      }

      if (navigationOutcome.performed) {
        handleClose();
      }
      if (handsFreeEnabled && returnToWakeListening) {
        setVoiceUiState("waiting_for_wake");
        setWakeListening(true);
        setWakeStatusMessage("Waiting for wake phrase.");
        startWakeListeningSession();
      }
    } catch {
      const message = userMessageForVoiceCategory("network_error", "Network error while executing command.");
      setVoiceUiState("error");
      setVoiceErrorCategory("network_error");
      setResultMessage(message);
      setVoiceResultMessage(message);
      setVoiceStatusMessage(message);
      voice.setState("error");
      globalVoice.requestSpokenResponse({
        status: "error",
        commandId: params.commandId,
        message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const relatedSections: Array<{ title: string; items: OrionRelatedRecordItem[] }> = relatedRecords
    ? [
        { title: "Projects", items: relatedRecords.projects },
        { title: "Estimates", items: relatedRecords.estimates },
        { title: "Invoices", items: relatedRecords.invoices },
        { title: "Documents", items: relatedRecords.documents },
        { title: "Timeline", items: relatedRecords.timeline },
        { title: "Photos", items: relatedRecords.photos },
        { title: "Tasks", items: relatedRecords.tasks },
        { title: "Crews", items: relatedRecords.crews },
      ]
    : [];

  if (!open) {
    return null;
  }

  return (
    <PortalHost>
      <OverlayBackdrop closeLabel="Close Orion Command Center" onClick={handleClose} className="bg-slate-950/70 backdrop-blur-sm" />
      <LayerManager layer="spotlight">
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center p-3 sm:p-6">
          <section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Orion Command Center"
            className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-[linear-gradient(165deg,rgba(15,23,42,0.93),rgba(3,7,18,0.92))] text-slate-100 shadow-[0_40px_100px_-40px_rgba(15,23,42,0.95)]"
          >
            <header className="border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Orion Command Center</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Workspace-aware command execution</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded border border-white/25 bg-white/10 px-2 py-1 text-xs text-slate-200">Ctrl+K</span>
                  <span className="rounded border border-white/25 bg-white/10 px-2 py-1 text-xs text-slate-200">Cmd+K</span>
                  <Button type="button" variant="ghost" onClick={handleClose} className="text-slate-100 hover:bg-white/10 hover:text-white">
                    Close
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                    setConfirmationArmedId(null);
                    setClarificationCandidateId(null);
                  }}
                  placeholder="Search commands, records, and workspace actions"
                  className="h-11 border-white/20 bg-slate-900/70 text-slate-100 placeholder:text-slate-400"
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveIndex(Math.min(resolvedActiveIndex + 1, Math.max(rankedActions.length - 1, 0)));
                      return;
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveIndex(Math.max(resolvedActiveIndex - 1, 0));
                      return;
                    }

                    if (event.key === "Enter") {
                      event.preventDefault();

                      if (selectedAction) {
                        void handleExecute(selectedAction);
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (selectedAction) {
                      void handleExecute(selectedAction);
                    }
                  }}
                  disabled={!selectedAction || isRunning}
                  className="h-11 bg-blue-500 text-white hover:bg-blue-400 disabled:bg-slate-700"
                >
                  {isRunning ? "Running" : "Run"}
                </Button>
                <OrionVoiceButton
                  state={voice.state}
                  mode={voiceCaptureMode}
                  disabled={!open}
                  onStart={() => {
                    resetVoiceTiming();
                    lastHandledTranscriptRef.current = null;
                    if (!globalVoice.settings.enabled) {
                      globalVoice.enableGlobalVoice();
                    }
                    voice.start();
                    if (voiceShowNotice) {
                      setVoiceShowNotice(false);
                      storeBoolean(VOICE_NOTICE_STORAGE_KEY, true);
                    }
                    setVoiceUiState("listening");
                    setVoiceStatusMessage(voiceCaptureMode === "push_to_talk" ? "Hold to talk." : "Listening...");
                    setVoiceResultMessage(null);
                  }}
                  onStop={() => {
                    voiceTimingRef.current.microphoneReleaseAt = nowMs();
                    logVoiceTiming("microphone.release");
                    voice.stop();
                    setVoiceUiState("understanding");
                    setVoiceStatusMessage("Understanding...");
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const nextMuted = !voice.muted;
                    voice.setMuted(nextMuted);
                    setSpokenResponsesEnabled(!nextMuted);
                    globalVoice.setSpokenResponsesEnabled(!nextMuted);
                  }}
                  className="h-11 text-slate-100 hover:bg-white/10"
                >
                  {voice.muted ? "Unmute Voice" : "Mute Voice"}
                </Button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 text-slate-100 hover:bg-white/10"
                  onClick={() => {
                    const next = voiceCaptureMode === "push_to_talk" ? "tap_to_listen" : "push_to_talk";
                    setVoiceCaptureMode(next);
                    globalVoice.setMode(next);
                  }}
                >
                  Mode: {voiceCaptureMode === "push_to_talk" ? "Hold to talk" : "Tap to listen"}
                </Button>

                <OrionHandsFreeToggle
                  enabled={handsFreeEnabled}
                  unsupported={!wakeSupported}
                  onChange={(enabled) => {
                    if (process.env.NODE_ENV !== "production") {
                      console.info("[orion-debug] hands-free changed", enabled);
                    }
                    if (enabled && !handsFreeNoticeAcknowledged) {
                      setHandsFreeNoticeAcknowledged(true);
                      storeBoolean(HANDS_FREE_NOTICE_ACK_STORAGE_KEY, true);
                    }

                    setHandsFreeEnabled(enabled);
                    setWakeListening(enabled);
                    setVoiceUiState(enabled ? "waiting_for_wake" : "listening");
                    setWakeStatusMessage(enabled ? "Waiting for wake phrase." : "Wake mode is off.");

                    globalVoice.setMode(enabled ? "hands_free" : "tap_to_listen");

                    if (enabled) {
                      startWakeListeningSession();
                    } else {
                      stopWakeListeningSession();
                    }
                  }}
                />

                <OrionMicrophoneIndicator active={globalVoice.micActive} />

                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 text-slate-100 hover:bg-white/10"
                  onClick={() => {
                    const next = !returnToWakeListening;
                    setReturnToWakeListening(next);
                    globalVoice.setReturnToWakeAfterCommand(next);
                  }}
                >
                  Return to wake: {returnToWakeListening ? "On" : "Off"}
                </Button>
              </div>

              <p className="mt-2 text-xs text-slate-300">
                {voiceCaptureMode === "push_to_talk"
                  ? "Hold to talk"
                  : "Tap once to listen, tap again to stop"}
              </p>

              {handsFreeEnabled && !handsFreeNoticeAcknowledged ? (
                <p className="mt-2 rounded border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-2 text-xs text-cyan-100">
                  Hands-Free Orion listens for the wake phrase locally and stays off until you enable it. No raw audio is persisted.
                </p>
              ) : null}

              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <OrionVoiceStatus
                  state={voiceUiState}
                  message={voice.errorMessage || (voice.state === "unsupported"
                    ? "Voice control is not supported in this browser. You can still type your request."
                    : voiceStatusMessage || voice.support.message)}
                  showNotice={voiceShowNotice}
                />
                <OrionWakeStatus
                  active={wakeListening}
                  supported={wakeSupported}
                  message={wakeStatusMessage}
                />
                <OrionVoiceTranscript
                  interimTranscript={voice.interimTranscript}
                  finalTranscript={voice.finalTranscript}
                  onStop={() => {
                    voice.stop();
                    setVoiceUiState("understanding");
                    setVoiceStatusMessage("Stopping microphone.");
                  }}
                  onCancel={() => {
                    voice.cancel();
                    setVoiceUiState("error");
                    setVoiceStatusMessage("Voice canceled.");
                    setVoiceConfirmationPending(null);
                  }}
                  onRestart={() => {
                    voice.restart();
                    setVoiceUiState("listening");
                    setVoiceStatusMessage("Voice restarted.");
                  }}
                  onRetry={() => {
                    voice.retry();
                    setVoiceUiState("listening");
                    setVoiceStatusMessage("Retrying voice capture.");
                  }}
                />
              </div>

              {voiceErrorCategory ? (
                <p className="mt-2 rounded border border-white/20 bg-white/5 px-2.5 py-2 text-xs text-slate-100">
                  Voice error category: {voiceErrorCategory}
                </p>
              ) : null}

              {activeLoadingIntent ? (
                <p className="mt-2 text-xs text-slate-300">Resolving intent...</p>
              ) : null}

              {activeIntentResult ? (
                <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
                  <p>Intent {activeIntentResult.resolvedIntent || "unknown"}</p>
                  <p>Confidence {Math.round(activeIntentResult.confidence * 100)}%</p>
                  {activeIntentResult.message ? <p className="mt-1 text-slate-300">{activeIntentResult.message}</p> : null}
                  {activeIntentResult.requiresClarification ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {activeIntentResult.candidates.map((candidate) => (
                        <button
                          key={`${candidate.entityType}:${candidate.entityId}`}
                          type="button"
                          className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/10"
                          onClick={() => {
                            setClarificationCandidateId(candidate.entityId);
                          }}
                        >
                          {candidate.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </header>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_360px]">
              <div className="min-h-0 border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
                <ul className="h-full overflow-y-auto p-2">
                  {contextStatus === "loading" ? (
                    <li className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Loading Orion workspace context...</li>
                  ) : contextStatus === "authentication_required" ? (
                    <li className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-4 text-sm text-amber-100">Authentication is required to load Orion workspace context.</li>
                  ) : contextStatus === "no_workspace" ? (
                    <li className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-4 text-sm text-amber-100">No workspace is configured for this account yet.</li>
                  ) : contextStatus === "permission_denied" ? (
                    <li className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-4 text-sm text-amber-100">Permission denied while loading Orion workspace context.</li>
                  ) : errorMessage ? (
                    <li className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
                      <p>{errorMessage}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-2 text-rose-100 hover:bg-rose-400/20"
                        onClick={() => {
                          setCatalog(null);
                          setContextStatus("loading");
                          setContextReloadToken((current) => current + 1);
                        }}
                      >
                        Retry
                      </Button>
                    </li>
                  ) : rankedActions.length === 0 ? (
                    <li className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">No actions match your search.</li>
                  ) : (
                    rankedActions.map((action, index) => {
                      const isActive = index === resolvedActiveIndex;
                      const isPinned = pinnedIds.includes(action.id);
                      const isSuggested = suggestedActions.some((item) => item.id === action.id);

                      return (
                        <li key={action.id} className="mb-2">
                          <div
                            className={[
                              "rounded-xl border p-3 transition",
                              isActive
                                ? "border-blue-300/60 bg-blue-500/20"
                                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                className="flex-1 text-left"
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => {
                                  setActiveIndex(index);
                                  void handleExecute(action);
                                }}
                              >
                                <p className="text-sm font-semibold text-white">{action.label}</p>
                                <p className="mt-0.5 text-xs text-slate-300">{action.subtitle}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                                  <span>{action.commandId}</span>
                                  <span>{action.group}</span>
                                  {isSuggested ? <span className="text-cyan-300">Suggested</span> : null}
                                </div>
                              </button>
                              <button
                                type="button"
                                className="rounded border border-white/20 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/15"
                                onClick={() => handleTogglePinned(action.id)}
                                aria-label={isPinned ? "Unpin action" : "Pin action"}
                              >
                                {isPinned ? "Pinned" : "Pin"}
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>

              <aside className="min-h-0 overflow-y-auto p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Current Context</p>
                {catalog ? (
                  <div className="mt-3 space-y-3 text-sm text-slate-200">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Page</p>
                      <p className="mt-1 text-white">{catalog.context.currentPage}</p>
                      <p className="mt-1 text-xs text-slate-300">Route {catalog.context.currentRoute}</p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Focus</p>
                      <p className="mt-1 text-white">{catalog.context.focusArea}</p>
                      <p className="mt-1 text-xs text-slate-300">Company {catalog.context.currentCompany.label}</p>
                    </div>

                    {activeIntentResult?.commandPreview ? (
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Command Preview</p>
                        <p className="mt-1 text-white">Target {activeIntentResult.commandPreview.target}</p>
                        <p className="mt-1 text-xs text-slate-300">Permission {activeIntentResult.commandPreview.permission.join(", ")}</p>
                        <p className="mt-1 text-xs text-slate-300">Confirmation {activeIntentResult.commandPreview.confirmationLevel}</p>
                        <p className="mt-1 text-xs text-slate-300">Expected outcome {activeIntentResult.commandPreview.expectedOutcome}</p>
                        <p className="mt-1 text-xs text-slate-300">
                          Events {activeIntentResult.commandPreview.eventsThatWillPublish.length > 0 ? activeIntentResult.commandPreview.eventsThatWillPublish.join(", ") : "none"}
                        </p>
                      </div>
                    ) : selectedAction ? (
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Command Preview</p>
                        <p className="mt-1 text-white">Target {selectedAction.preview.target}</p>
                        <p className="mt-1 text-xs text-slate-300">Permission {selectedAction.preview.permission.join(", ")}</p>
                        <p className="mt-1 text-xs text-slate-300">Confirmation {selectedAction.preview.confirmationLevel}</p>
                        <p className="mt-1 text-xs text-slate-300">Expected outcome {selectedAction.preview.expectedOutcome}</p>
                        <p className="mt-1 text-xs text-slate-300">
                          Events {selectedAction.preview.eventsThatWillPublish.length > 0 ? selectedAction.preview.eventsThatWillPublish.join(", ") : "none"}
                        </p>
                      </div>
                    ) : null}

                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Suggested Actions</p>
                      <div className="mt-2 space-y-1">
                        {suggestedActions.length > 0 ? suggestedActions.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="block w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-left text-xs text-slate-100 hover:bg-white/10"
                            onClick={() => void handleExecute(item)}
                          >
                            {item.label}
                          </button>
                        )) : <p className="text-xs text-slate-300">No suggestions yet.</p>}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Recent Commands</p>
                      <p className="mt-1 text-xs text-slate-300">{recentActionItems.map((item) => item.label).join(" • ") || "None yet"}</p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Pinned Commands</p>
                      <p className="mt-1 text-xs text-slate-300">{pinnedActionItems.map((item) => item.label).join(" • ") || "None pinned"}</p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Recent Activity</p>
                      <div className="mt-2 space-y-1">
                        {(catalog.recentTimeline || []).slice(0, 5).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="block w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-left text-xs text-slate-100 hover:bg-white/10"
                            onClick={() => {
                              if (item.href) {
                                router.push(item.href);
                                handleClose();
                              }
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {catalog.context.currentCustomer ? (
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Related Records</p>
                        {loadingRelated ? <p className="mt-2 text-xs text-slate-300">Loading customer related records...</p> : null}
                        {!loadingRelated && relatedSections.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {relatedSections.map((section) => (
                              <div key={section.title}>
                                <p className="text-[11px] uppercase tracking-[0.1em] text-slate-300">{section.title}</p>
                                <p className="mt-1 text-xs text-slate-100">{section.items.slice(0, 3).map((item) => item.label).join(" • ") || "None"}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">
                    {contextStatus === "loading"
                      ? "Loading context..."
                      : contextStatus === "authentication_required"
                        ? "Authentication required."
                        : contextStatus === "no_workspace"
                          ? "No workspace configured."
                          : contextStatus === "permission_denied"
                            ? "Permission denied for current context."
                            : "Context failed to load."}
                  </p>
                )}

                {resultMessage ? (
                  <div className="mt-4 rounded-lg border border-blue-300/35 bg-blue-500/15 p-3 text-sm text-blue-100">
                    {resultMessage}
                  </div>
                ) : null}

                {voiceResultMessage ? (
                  <div className="mt-3 rounded-lg border border-cyan-300/35 bg-cyan-500/15 p-3 text-sm text-cyan-100" aria-live="polite" aria-atomic="true">
                    {voiceResultMessage}
                  </div>
                ) : null}
              </aside>
            </div>
          </section>
        </div>
      </LayerManager>
    </PortalHost>
  );
}
