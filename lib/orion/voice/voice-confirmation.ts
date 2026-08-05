import type { OrionCommandConfirmationLevel } from "@/lib/orion/commands";

type VoicePreview = {
  commandId: string;
  target: string;
  confirmationLevel: OrionCommandConfirmationLevel;
  expectedOutcome: string;
  eventsThatWillPublish: string[];
};

export function voiceConfirmationRequired(level: OrionCommandConfirmationLevel) {
  return level === "REQUIRED";
}

export function buildVoiceConfirmationSummary(params: {
  transcript: string;
  preview: VoicePreview;
  amountText?: string | null;
}) {
  const command = params.preview.commandId;
  const target = params.preview.target;
  const outcome = params.preview.expectedOutcome;
  const events = params.preview.eventsThatWillPublish.length > 0
    ? params.preview.eventsThatWillPublish.join(", ")
    : "none";

  const amountPart = params.amountText ? ` Amount ${params.amountText}.` : "";

  return `Command ${command}. Target ${target}. Expected change ${outcome}.${amountPart} Events ${events}.`;
}
