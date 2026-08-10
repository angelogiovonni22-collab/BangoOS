"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectOrionVoiceSupport, resolveSpeechRecognitionCtor, type BrowserSpeechRecognitionLike, type SpeechRecognitionErrorEvent, type SpeechRecognitionResultEvent } from "./voice-support";
import type { OrionVoiceErrorCategory, OrionVoiceSessionOptions, OrionVoiceSessionSnapshot, OrionVoiceState } from "./voice-types";
import { sanitizeTranscript } from "./voice-transcript";
import { hasOrionConversationContinuation } from "./conversation-continuation";
import { ORION_SPEECH_ENDED_EVENT } from "./speech-output-adapter";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const FINAL_TRANSCRIPT_SETTLE_MS = 900;
const TRANSIENT_RECOGNITION_ERRORS = new Set(["network", "bad-grammar"]);

function logVoiceDev(event: string, details?: Record<string, unknown>) {
  if (IS_PRODUCTION || typeof console === "undefined") {
    return;
  }

  if (details) {
    console.debug(`[orion-voice] ${event}`, details);
    return;
  }

  console.debug(`[orion-voice] ${event}`);
}

function logOrionDebugInfo(message: string, ...optionalParams: unknown[]) {
  if (IS_PRODUCTION || typeof console === "undefined") {
    return;
  }

  console.info(message, ...optionalParams);
}

type RecognitionLifecycleEvent = Event & {
  error?: string;
  message?: string;
};

type RecognitionResultLifecycleEvent = SpeechRecognitionResultEvent & {
  type?: string;
};

const DEFAULT_MUTE_STORAGE_KEY = "bangoos:orion:voice-muted:v1";

function readMutedValue(storageKey: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function storeMutedValue(storageKey: string, muted: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, muted ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}

function useVoiceSupport() {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return detectOrionVoiceSupport(null);
    }

    return detectOrionVoiceSupport(window);
  }, []);
}

export function useOrionVoiceSession(options?: OrionVoiceSessionOptions) {
  const support = useVoiceSupport();
  const lang = options?.lang || "en-US";
  const muteStorageKey = options?.muteStorageKey || DEFAULT_MUTE_STORAGE_KEY;

  const recognitionRef = useRef<BrowserSpeechRecognitionLike | null>(null);
  const lastDeliveredFinalTranscriptRef = useRef<string | null>(null);
  const pendingFinalTranscriptRef = useRef("");
  const finalTranscriptSettleTimerRef = useRef<number | null>(null);
  const pendingCancelRef = useRef(false);
  const onPermissionDeniedRef = useRef(options?.onPermissionDenied);
  const onErrorCategoryRef = useRef(options?.onErrorCategory);
  const onFinalTranscriptRef = useRef(options?.onFinalTranscript);
  const [state, setState] = useState<OrionVoiceState>(support.recognitionSupported ? "idle" : "unsupported");
  const stateRef = useRef<OrionVoiceState>(support.recognitionSupported ? "idle" : "unsupported");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCategory, setErrorCategory] = useState<OrionVoiceErrorCategory | null>(null);
  const [muted, setMuted] = useState(() => readMutedValue(muteStorageKey));

  useEffect(() => {
    onPermissionDeniedRef.current = options?.onPermissionDenied;
    onErrorCategoryRef.current = options?.onErrorCategory;
    onFinalTranscriptRef.current = options?.onFinalTranscript;
  }, [options?.onErrorCategory, options?.onFinalTranscript, options?.onPermissionDenied]);

  const clearPendingFinalTranscript = useCallback(() => {
    if (finalTranscriptSettleTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(finalTranscriptSettleTimerRef.current);
      finalTranscriptSettleTimerRef.current = null;
    }
    pendingFinalTranscriptRef.current = "";
  }, []);

  const reportError = useCallback((category: OrionVoiceErrorCategory, message: string) => {
    setErrorCategory(category);
    setErrorMessage(message);
    onErrorCategoryRef.current?.(category, message);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    logOrionDebugInfo("[orion-debug] recognition stop requested");
    logOrionDebugInfo("[orion-debug] recognition.stop() call", { reason: "useOrionVoiceSession.stop" });
    setState((current) => (current === "listening" ? "processing" : current));
    recognition.stop();
  }, []);

  const cancel = useCallback(() => {
    clearPendingFinalTranscript();

    if (stateRef.current === "requesting_permission") {
      pendingCancelRef.current = true;
      logOrionDebugInfo("[orion-debug] recognition cancel deferred", { reason: "waiting_for_onstart" });
      return;
    }

    const recognition = recognitionRef.current;
    if (recognition) {
      logOrionDebugInfo("[orion-debug] recognition abort requested");
      logOrionDebugInfo("[orion-debug] recognition.abort() call", { reason: "useOrionVoiceSession.cancel" });
      recognition.abort();
    }

    setInterimTranscript("");
    setState(support.recognitionSupported ? "idle" : "unsupported");
  }, [clearPendingFinalTranscript, support.recognitionSupported]);

  const ensureRecognition = useCallback(() => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }

    if (typeof window === "undefined") {
      return null;
    }

    const speechRecognitionCtor = (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
    const webkitSpeechRecognitionCtor = (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    const speechCtorType = typeof speechRecognitionCtor;
    const webkitSpeechCtorType = typeof webkitSpeechRecognitionCtor;
    const Ctor = resolveSpeechRecognitionCtor(window);
    const selectedCtor = Ctor?.name || (speechRecognitionCtor === Ctor ? "SpeechRecognition" : webkitSpeechRecognitionCtor === Ctor ? "webkitSpeechRecognition" : "unknown");
    logOrionDebugInfo("[orion-debug] speech ctor available", Boolean(Ctor));
    logOrionDebugInfo("[orion-debug] speech ctor details", {
      speechRecognitionType: speechCtorType,
      webkitSpeechRecognitionType: webkitSpeechCtorType,
      selectedConstructor: selectedCtor,
      constructorName: Ctor?.name || null,
    });
    if (!Ctor) {
      return null;
    }

    const recognition = new Ctor();
    logVoiceDev("recognition created", {
      lang,
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
    });
    recognition.lang = lang;
    recognition.interimResults = true;
    // Keep one recognition session open so users can say “Hey Orion” and continue
    // speaking immediately even when the browser finalizes the wake phrase first.
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      logOrionDebugInfo("[orion-debug] recognition.onstart", { eventType: "start" });
      logVoiceDev("recognition started");
      clearPendingFinalTranscript();
      lastDeliveredFinalTranscriptRef.current = null;
      setErrorCategory(null);
      setErrorMessage(null);
      setState("listening");

      if (pendingCancelRef.current) {
        pendingCancelRef.current = false;
        logOrionDebugInfo("[orion-debug] recognition abort requested");
        logOrionDebugInfo("[orion-debug] recognition.abort() call", { reason: "useOrionVoiceSession.cancel" });
        recognition.abort();
      }
    };

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const lifecycleEvent = event as RecognitionResultLifecycleEvent;
      logOrionDebugInfo("[orion-debug] recognition.onresult", {
        eventType: lifecycleEvent.type || "result",
        resultIndex: event.resultIndex,
        resultCount: event.results.length,
      });
      let interim = "";
      const finals: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || "";
        if (result.isFinal) {
          finals.push(transcript);
        } else {
          interim += `${transcript} `;
        }
      }

      const sanitizedInterim = sanitizeTranscript(interim);
      setInterimTranscript(sanitizedInterim);
      logVoiceDev("transcript received", {
        resultIndex: event.resultIndex,
        resultCount: event.results.length,
        finalChunkCount: finals.length,
        interimChunkLength: interim.trim().length,
      });

      if (finals.length > 0) {
        const joined = sanitizeTranscript(finals.join(" "));
        if (joined) {
          const existing = pendingFinalTranscriptRef.current;
          pendingFinalTranscriptRef.current = sanitizeTranscript(existing ? `${existing} ${joined}` : joined);
          logOrionDebugInfo("[orion-trace] speech.final_chunk_buffered", {
            bufferedLength: pendingFinalTranscriptRef.current.length,
            settleMs: FINAL_TRANSCRIPT_SETTLE_MS,
          });
        }
      }

      if (!pendingFinalTranscriptRef.current) {
        return;
      }

      if (finalTranscriptSettleTimerRef.current !== null) {
        window.clearTimeout(finalTranscriptSettleTimerRef.current);
      }

      // A browser can mark a phrase final while the user is still speaking. Treat
      // every subsequent result (including interim speech) as proof the turn is
      // still active, and only dispatch after a short quiet window.
      finalTranscriptSettleTimerRef.current = window.setTimeout(() => {
        finalTranscriptSettleTimerRef.current = null;
        const settled = sanitizeTranscript(pendingFinalTranscriptRef.current);
        pendingFinalTranscriptRef.current = "";

        if (!settled || lastDeliveredFinalTranscriptRef.current === settled) {
          return;
        }

        lastDeliveredFinalTranscriptRef.current = settled;
        logOrionDebugInfo("[orion-timing] speech final result", {
          transcriptLength: settled.length,
          settleMs: FINAL_TRANSCRIPT_SETTLE_MS,
        });
        logOrionDebugInfo("[orion-trace] speech.final_result", {
          transcript: settled,
          transcriptLength: settled.length,
        });
        setInterimTranscript("");
        setFinalTranscript(settled);
        setState("processing");
        onFinalTranscriptRef.current?.(settled);
      }, FINAL_TRANSCRIPT_SETTLE_MS);
    };

    const recognitionWithNoMatch = recognition as BrowserSpeechRecognitionLike & {
      onnomatch?: ((event: Event) => void) | null;
    };

    recognitionWithNoMatch.onnomatch = (event: Event) => {
      logOrionDebugInfo("[orion-debug] recognition.onnomatch", {
        eventType: event.type || "nomatch",
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      pendingCancelRef.current = false;
      const lifecycleEvent = event as RecognitionLifecycleEvent;
      logOrionDebugInfo("[orion-debug] recognition.onerror", {
        error: event.error,
        message: lifecycleEvent.message ?? null,
        eventType: lifecycleEvent.type || "error",
      });
      logVoiceDev("recognition error", { error: event.error });

      if (event.error === "no-speech" || event.error === "aborted") {
        // These are expected lifecycle outcomes during normal stop/restart/wake flows.
        clearPendingFinalTranscript();
        setInterimTranscript("");
        setState(support.recognitionSupported ? "idle" : "unsupported");
        return;
      }

      if (TRANSIENT_RECOGNITION_ERRORS.has(event.error)) {
        // Chrome/Edge can emit a short-lived network recognizer failure even after
        // a valid final transcript has already been delivered. Do not convert that
        // recoverable transport interruption into Orion's fatal red error state.
        clearPendingFinalTranscript();
        setInterimTranscript("");
        setErrorCategory(null);
        setErrorMessage(null);
        setState(support.recognitionSupported ? "idle" : "unsupported");
        logOrionDebugInfo("[orion-trace] recognition.transient_error_recovered", {
          error: event.error,
        });
        return;
      }

      clearPendingFinalTranscript();
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        onPermissionDeniedRef.current?.();
        reportError("microphone_permission_denied", "Microphone permission was denied.");
      } else if (event.error === "audio-capture") {
        reportError("microphone_unavailable", "Microphone is unavailable.");
      } else {
        reportError("speech_recognition_error", "Voice capture failed. Try again.");
      }

      setState("error");
    };

    recognition.onend = () => {
      pendingCancelRef.current = false;
      logOrionDebugInfo("[orion-debug] recognition.onend", { eventType: "end" });
      logVoiceDev("recognition ended");
      setInterimTranscript("");
      setState((current) => {
        if (current === "unsupported") {
          return current;
        }

        if (current === "error") {
          return current;
        }

        return "idle";
      });
    };

    const recognitionLifecycle = recognition as BrowserSpeechRecognitionLike & {
      onaudiostart?: ((event: Event) => void) | null;
      onspeechstart?: ((event: Event) => void) | null;
      onsoundstart?: ((event: Event) => void) | null;
      onaudioend?: ((event: Event) => void) | null;
      onspeechend?: ((event: Event) => void) | null;
      onsoundend?: ((event: Event) => void) | null;
    };

    recognitionLifecycle.onaudiostart = (event: Event) => {
      logOrionDebugInfo("[orion-debug] recognition.onaudiostart", { eventType: event.type || "audiostart" });
    };

    recognitionLifecycle.onspeechstart = (event: Event) => {
      logOrionDebugInfo("[orion-debug] recognition.onspeechstart", { eventType: event.type || "speechstart" });
    };

    recognitionLifecycle.onsoundstart = (event: Event) => {
      logOrionDebugInfo("[orion-debug] recognition.onsoundstart", { eventType: event.type || "soundstart" });
    };

    recognitionLifecycle.onaudioend = (event: Event) => {
      logOrionDebugInfo("[orion-debug] recognition.onaudioend", { eventType: event.type || "audioend" });
    };

    recognitionLifecycle.onspeechend = (event: Event) => {
      logOrionDebugInfo("[orion-debug] recognition.onspeechend", { eventType: event.type || "speechend" });
    };

    recognitionLifecycle.onsoundend = (event: Event) => {
      logOrionDebugInfo("[orion-debug] recognition.onsoundend", { eventType: event.type || "soundend" });
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [clearPendingFinalTranscript, lang, reportError, support.recognitionSupported]);

  const start = useCallback(() => {
    if (!support.recognitionSupported) {
      setState("unsupported");
      reportError("speech_recognition_unsupported", support.message);
      return;
    }

    const recognition = ensureRecognition();
    if (!recognition) {
      setState("unsupported");
      reportError("speech_recognition_unsupported", "Voice control is not supported in this browser. You can still type your request.");
      return;
    }

    clearPendingFinalTranscript();
    setErrorCategory(null);
    setErrorMessage(null);
    setInterimTranscript("");
    setFinalTranscript("");
    lastDeliveredFinalTranscriptRef.current = null;
    pendingCancelRef.current = false;
    setState("requesting_permission");

    try {
      logOrionDebugInfo("[orion-debug] recognition start requested");
      logOrionDebugInfo("[orion-debug] before recognition.start()", {
        currentState: state,
        constructorName: recognition.constructor?.name || "unknown",
      });
      logVoiceDev("recognition start requested", { mode: "user_initiated" });
      recognition.start();
      logOrionDebugInfo("[orion-debug] recognition.start() returned");
    } catch (error) {
      const errorDetails = error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "UnknownError", message: String(error) };
      logOrionDebugInfo("[orion-debug] recognition.start() threw", errorDetails);
      setState("error");
      reportError("microphone_unavailable", "Unable to start microphone capture.");
    }
  }, [clearPendingFinalTranscript, ensureRecognition, reportError, state, support.message, support.recognitionSupported]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let retryTimer: number | null = null;

    const resumeForFollowUp = (attempt = 0) => {
      if (!hasOrionConversationContinuation()) {
        return;
      }

      if (stateRef.current === "idle") {
        logOrionDebugInfo("[orion-trace] conversation.follow_up.microphone_resume", { attempt });
        start();
        return;
      }

      if (attempt >= 8 || stateRef.current === "unsupported" || stateRef.current === "error") {
        return;
      }

      retryTimer = window.setTimeout(() => resumeForFollowUp(attempt + 1), 75);
    };

    const onSpeechEnded = () => {
      resumeForFollowUp();
    };

    window.addEventListener(ORION_SPEECH_ENDED_EVENT, onSpeechEnded);
    return () => {
      window.removeEventListener(ORION_SPEECH_ENDED_EVENT, onSpeechEnded);
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [start]);

  const restart = useCallback(() => {
    if (stateRef.current === "requesting_permission") {
      pendingCancelRef.current = true;
      return;
    }

    cancel();
    start();
  }, [cancel, start]);

  const retry = useCallback(() => {
    setErrorCategory(null);
    setErrorMessage(null);
    start();
  }, [start]);

  const setMutedValue = useCallback((next: boolean) => {
    setMuted(next);
    storeMutedValue(muteStorageKey, next);
  }, [muteStorageKey]);

  useEffect(() => {
    return () => {
      clearPendingFinalTranscript();
      const recognition = recognitionRef.current;
      if (recognition) {
        logOrionDebugInfo("[orion-debug] recognition abort on unmount");
        logOrionDebugInfo("[orion-debug] recognition.abort() call", { reason: "useOrionVoiceSession.unmount" });
        recognition.abort();
      }
    };
  }, [clearPendingFinalTranscript]);

  const snapshot: OrionVoiceSessionSnapshot = {
    state,
    interimTranscript,
    finalTranscript,
    errorMessage,
    errorCategory,
    muted,
    support,
  };

  return {
    ...snapshot,
    setState,
    start,
    stop,
    cancel,
    restart,
    retry,
    setMuted: setMutedValue,
    clearFinalTranscript: () => setFinalTranscript(""),
    clearError: () => {
      setErrorCategory(null);
      setErrorMessage(null);
    },
  };
}