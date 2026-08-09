import { armOrionConversationContinuation } from "./conversation-continuation";
import type { OrionVoiceResultTone } from "./voice-types";

type VoiceResponseInput = {
  status: "success" | "clarification" | "confirmation_required" | "error" | "unsupported" | "processing";
  commandId?: string | null;
  targetLabel?: string | null;
  message?: string | null;
};

function normalizePath(targetLabel: string | null | undefined) {
  if (!targetLabel) {
    return "";
  }

  if (targetLabel.startsWith("http://") || targetLabel.startsWith("https://")) {
    try {
      const parsed = new URL(targetLabel);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return targetLabel;
    }
  }

  return targetLabel;
}

function buildSuccessResponse(commandId: string | null | undefined, targetLabel: string | null | undefined, message: string | null | undefined) {
  const target = normalizePath(targetLabel);

  if (commandId === "navigation.back") {
    return "Going back.";
  }

  if (target.startsWith("/customers/new")) {
    return "Opening a new customer.";
  }

  if (target.startsWith("/projects/new")) {
    return "Opening a new project.";
  }

  if (target.startsWith("/estimates/new")) {
    return "Opening a new estimate.";
  }

  if (target.startsWith("/invoices/new")) {
    return "Opening a new invoice.";
  }

  if (target.includes("tab=work") && target.startsWith("/projects/")) {
    return "Opening tasks.";
  }

  if (target.startsWith("/dashboard")) return "Opening Dashboard.";
  if (target.startsWith("/projects")) return "Opening Projects.";
  if (target.startsWith("/customers")) return "Opening Customers.";
  if (target.startsWith("/vendors")) return "Opening Vendors.";
  if (target.startsWith("/estimates")) return "Opening Estimates.";
  if (target.startsWith("/invoices")) return "Opening Invoices.";
  if (target.startsWith("/schedule") || commandId === "schedule.open") return "Opening Schedule.";
  if (target.startsWith("/daily-reports")) return "Opening Reports.";
  if (target.startsWith("/equipment")) return "Opening Equipment.";
  if (target.startsWith("/materials")) return "Opening Materials.";
  if (target.startsWith("/settings")) return "Opening Settings.";
  if (target.startsWith("/operations")) return "Opening Operations.";

  if (message && message.trim()) {
    return message;
  }

  return "Request completed successfully.";
}

function asksForFollowUp(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.includes("?")) {
    return true;
  }

  return /\b(please say|say confirm|say the|tell me|which one|which project|which customer|what project|what customer|what would you like|what are we|who is this for)\b/.test(normalized);
}

function armContinuationForResponse(status: VoiceResponseInput["status"], text: string) {
  if (status === "clarification") {
    armOrionConversationContinuation("clarification");
    return;
  }

  if (status === "confirmation_required") {
    armOrionConversationContinuation("confirmation");
    return;
  }

  if (status === "success" && asksForFollowUp(text)) {
    armOrionConversationContinuation("workflow_follow_up");
  }
}

export function buildVoiceResponse(input: VoiceResponseInput): { tone: OrionVoiceResultTone; text: string } {
  if (input.status === "success") {
    const text = buildSuccessResponse(input.commandId, input.targetLabel, input.message);
    armContinuationForResponse(input.status, text);
    return {
      tone: "success",
      text,
    };
  }

  if (input.status === "clarification") {
    const text = "I found multiple matches. Please choose one.";
    armContinuationForResponse(input.status, text);
    return {
      tone: "info",
      text,
    };
  }

  if (input.status === "confirmation_required") {
    const text = "Confirmation is required. Say confirm to continue or cancel to stop.";
    armContinuationForResponse(input.status, text);
    return {
      tone: "warning",
      text,
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
    text: input.message || "That command could not be completed.",
  };
}
