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

export function buildVoiceResponse(input: VoiceResponseInput): { tone: OrionVoiceResultTone; text: string } {
  if (input.status === "success") {
    return {
      tone: "success",
      text: buildSuccessResponse(input.commandId, input.targetLabel, input.message),
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
    text: input.message || "That command could not be completed.",
  };
}
