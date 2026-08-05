import type { OrionVoiceResultTone } from "./voice-types";

type VoiceResponseInput = {
  status: "success" | "clarification" | "confirmation_required" | "error" | "unsupported" | "processing";
  targetLabel?: string | null;
  message?: string | null;
};

export function buildVoiceResponse(input: VoiceResponseInput): { tone: OrionVoiceResultTone; text: string } {
  if (input.status === "success") {
    if (input.targetLabel?.startsWith("/dashboard")) {
      return {
        tone: "success",
        text: "Opening dashboard.",
      };
    }

    if (input.targetLabel?.startsWith("/projects")) {
      return {
        tone: "success",
        text: "Opening projects.",
      };
    }

    if (input.targetLabel?.startsWith("/customers")) {
      return {
        tone: "success",
        text: "Opening customers.",
      };
    }

    return {
      tone: "success",
      text: input.targetLabel
        ? `Completed request for ${input.targetLabel}.`
        : "Request completed successfully.",
    };
  }

  if (input.status === "clarification") {
    return {
      tone: "info",
      text: "I found multiple matches. Please choose one.",
    };
  }

  if (input.status === "confirmation_required") {
    return {
      tone: "warning",
      text: "Confirmation is required. Say confirm to continue or cancel to stop.",
    };
  }

  if (input.status === "unsupported") {
    return {
      tone: "warning",
      text: "Voice control is not supported in this browser. You can still type your request.",
    };
  }

  if (input.status === "processing") {
    return {
      tone: "info",
      text: "Processing your voice request.",
    };
  }

  return {
    tone: "error",
    text: input.message || "I could not complete that request.",
  };
}
