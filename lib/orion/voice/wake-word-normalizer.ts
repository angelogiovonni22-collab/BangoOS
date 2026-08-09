import { clearOrionConversationContinuation, consumeOrionConversationContinuation } from "./conversation-continuation";
import type { OrionWakeWordDetection, OrionWakeWordPolicy, OrionWakeWordVariant } from "./wake-word-types";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function logWakeTrace(event: string, details: Record<string, unknown>) {
  if (IS_PRODUCTION || typeof console === "undefined") {
    return;
  }

  console.info(`[orion-trace] ${event}`, details);
}

const VARIANT_PATTERNS: Record<OrionWakeWordVariant, RegExp> = {
  hey_orion: /^\s*hey[\s,.:;-]+orion\b[\s,.:;-]*/i,
  orion: /^\s*orion\b[\s,.:;-]*/i,
  okay_orion: /^\s*(okay|ok)[\s,.:;-]+orion\b[\s,.:;-]*/i,
};

export function normalizeWakeInput(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export function detectWakeWord(input: string, policy: OrionWakeWordPolicy): OrionWakeWordDetection {
  const transcript = normalizeWakeInput(input);
  if (!transcript) {
    logWakeTrace("wake.detect.result", {
      originalTranscript: input,
      normalizedTranscript: transcript,
      wakeVariants: policy.enabled,
      regexUsed: null,
      cleanedCommand: "",
      detected: false,
    });
    return {
      detected: false,
      transcript,
      cleanedCommand: "",
      matchedVariant: null,
    };
  }

  for (const variant of policy.enabled) {
    const pattern = VARIANT_PATTERNS[variant];
    if (!pattern) {
      continue;
    }

    if (pattern.test(transcript)) {
      clearOrionConversationContinuation();
      const cleaned = normalizeWakeInput(transcript.replace(pattern, ""));
      logWakeTrace("wake.detect.result", {
        originalTranscript: input,
        normalizedTranscript: transcript,
        wakeVariants: policy.enabled,
        regexUsed: pattern.source,
        cleanedCommand: cleaned,
        detected: true,
        matchedVariant: variant,
      });
      return {
        detected: true,
        transcript,
        cleanedCommand: cleaned,
        matchedVariant: variant,
      };
    }
  }

  const continuationReason = consumeOrionConversationContinuation();
  if (continuationReason) {
    logWakeTrace("wake.detect.conversation_follow_up", {
      originalTranscript: input,
      normalizedTranscript: transcript,
      cleanedCommand: transcript,
      detected: true,
      continuationReason,
    });
    return {
      detected: true,
      transcript,
      cleanedCommand: transcript,
      matchedVariant: null,
    };
  }

  logWakeTrace("wake.detect.result", {
    originalTranscript: input,
    normalizedTranscript: transcript,
    wakeVariants: policy.enabled,
    regexUsed: policy.enabled
      .map((variant) => VARIANT_PATTERNS[variant]?.source)
      .filter((value): value is string => Boolean(value)),
    cleanedCommand: "",
    detected: false,
  });

  return {
    detected: false,
    transcript,
    cleanedCommand: "",
    matchedVariant: null,
  };
}
