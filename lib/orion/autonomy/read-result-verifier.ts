import type { OrionCommandDefinition, OrionCommandExecutionResult } from "@/lib/orion/commands/types";

export type OrionReadVerification =
  | { ok: true; verified: true }
  | { ok: false; verified: false; reason: string };

function internalBosHref(href: string | null) {
  if (!href) return true;
  if (!href.startsWith("/")) return false;
  if (href.startsWith("//")) return false;
  return !href.toLowerCase().startsWith("/api/");
}

export function verifyOrionAutonomousReadResult(args: {
  command: OrionCommandDefinition;
  result: OrionCommandExecutionResult;
}): OrionReadVerification {
  const { command, result } = args;

  if (!result.success || result.status !== "completed") {
    return { ok: false, verified: false, reason: "The BOS read command did not complete successfully." };
  }

  if (result.commandId !== command.id) {
    return { ok: false, verified: false, reason: "The BOS read result did not match the command that was executed." };
  }

  if (result.requiresConfirmation) {
    return { ok: false, verified: false, reason: "A read-only autonomy step unexpectedly requested confirmation." };
  }

  if (result.createdEntityIds.length > 0 || result.updatedEntityIds.length > 0 || result.publishedEventIds.length > 0) {
    return { ok: false, verified: false, reason: "A read-only autonomy step reported side effects, so Orion stopped the sequence." };
  }

  if (result.entityCreated || result.entityUpdated || result.publishedEvent) {
    return { ok: false, verified: false, reason: "A read-only autonomy step reported legacy side-effect evidence, so Orion stopped the sequence." };
  }

  if (!internalBosHref(result.href)) {
    return { ok: false, verified: false, reason: "A read-only autonomy step returned a non-BOS destination." };
  }

  if (command.entityType && result.entityType && result.entityType !== command.entityType) {
    return { ok: false, verified: false, reason: "The BOS read result returned an unexpected entity type." };
  }

  return { ok: true, verified: true };
}
