import type { OrionCommandConfirmationLevel, OrionCommandDefinition } from "@/lib/orion/commands/types";

export type OrionAutonomyRisk = "read" | "reversible_write" | "external_effect" | "financial" | "destructive" | "legal_or_authority";
export type OrionAutonomyMode = "auto" | "review" | "confirm";

export const ORION_MAX_AUTONOMOUS_STEPS = 8;

const EXTERNAL_EFFECT_COMMANDS = new Set([
  "estimate.send",
  "invoice.send",
  "customer_update.send",
  "permit.submit",
]);

const FINANCIAL_COMMANDS = new Set([
  "invoice.record_payment",
  "invoice.record_deposit",
  "invoice.issue_refund",
  "estimate.generate_deposit_invoice",
]);

const DESTRUCTIVE_COMMANDS = new Set([
  "customer.archive",
  "employee.archive",
  "crew.remove",
  "project.archive",
  "document.delete",
]);

const LEGAL_OR_AUTHORITY_COMMANDS = new Set([
  "estimate.approve",
  "estimate.decline",
  "estimate.convert",
  "inspection.pass",
  "inspection.fail",
  "inspection.cancel",
  "permit.approve",
  "permit.issue",
  "permit.reject",
  "permit.renew",
  "permit.close",
  "permit.mark_not_required",
  "document.sign",
]);

function looksReadOnly(command: Pick<OrionCommandDefinition, "id" | "coverage">) {
  return command.id.endsWith(".open")
    || command.id.endsWith(".view")
    || command.id.includes(".read_")
    || command.coverage.status === "navigation_only";
}

export function classifyOrionCommandRisk(command: Pick<OrionCommandDefinition, "id" | "coverage" | "undoCapable">): OrionAutonomyRisk {
  if (FINANCIAL_COMMANDS.has(command.id)) return "financial";
  if (EXTERNAL_EFFECT_COMMANDS.has(command.id)) return "external_effect";
  if (DESTRUCTIVE_COMMANDS.has(command.id)) return "destructive";
  if (LEGAL_OR_AUTHORITY_COMMANDS.has(command.id)) return "legal_or_authority";
  if (looksReadOnly(command)) return "read";
  return "reversible_write";
}

export function autonomyModeForCommand(command: Pick<OrionCommandDefinition, "id" | "coverage" | "undoCapable" | "confirmationLevel">): OrionAutonomyMode {
  const risk = classifyOrionCommandRisk(command);
  if (command.confirmationLevel === "REQUIRED") return "confirm";
  if (["external_effect", "financial", "destructive", "legal_or_authority"].includes(risk)) return "confirm";
  if (risk === "read") return "auto";
  if (command.confirmationLevel === "REVIEW") return "review";
  return "auto";
}

export function effectiveOrionConfirmationLevel(command: Pick<OrionCommandDefinition, "id" | "coverage" | "undoCapable" | "confirmationLevel">): OrionCommandConfirmationLevel {
  const mode = autonomyModeForCommand(command);
  if (mode === "confirm") return "REQUIRED";
  if (mode === "auto" && classifyOrionCommandRisk(command) === "read") return "NONE";
  return command.confirmationLevel;
}

export function canContinueAutonomousSequence(args: {
  stepNumber: number;
  previousOk: boolean;
  previousVerified?: boolean;
  nextMode: OrionAutonomyMode;
}) {
  if (args.stepNumber < 1 || args.stepNumber > ORION_MAX_AUTONOMOUS_STEPS) return false;
  if (!args.previousOk) return false;
  if (args.previousVerified === false) return false;
  return args.nextMode === "auto";
}
