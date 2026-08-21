import { getUniversalBosCommandByToolName } from "./universal-command-catalog";

export type OrionIntelligenceRoute =
  | { kind: "conversation"; answer: string }
  | { kind: "web_search"; query: string }
  | { kind: "bos_command"; toolName: string; params: Record<string, unknown> }
  | { kind: "clarify"; question: string };

export type OrionResolvedBosAction = {
  commandId: string;
  params: Record<string, unknown>;
};

export function resolveBosActionFromIntelligenceRoute(route: OrionIntelligenceRoute): OrionResolvedBosAction | null {
  if (route.kind !== "bos_command") {
    return null;
  }

  const command = getUniversalBosCommandByToolName(route.toolName);
  if (!command) {
    return null;
  }

  if (command.coverage.status === "unsupported") {
    return null;
  }

  return {
    commandId: command.id,
    params: route.params,
  };
}

export function buildOrionSystemPolicy() {
  return [
    "You are Orion, the intelligence interface for Bango Operating System (BOS).",
    "Answer normal conversational questions directly when no tool is needed.",
    "Use web search for current or external information when it is available and relevant.",
    "Use BOS tools for company data, navigation, and operational actions.",
    "Never claim a BOS action succeeded until the BOS command executor returns success.",
    "Never bypass BOS permissions, validation, confirmation levels, or audit logging.",
    "When information required for an action is missing, ask a short natural follow-up question and keep the conversational turn open.",
    "Prefer current page/project/customer context instead of asking the user to repeat information already known by BOS.",
    "When the user asks to scroll a named BOS interface region such as the sidebar, navigation menu, or page list, target the semantic scroll region returned by the current UI observation instead of scrolling the main document or guessing coordinates.",
    "If a BOS capability is unavailable, explain that clearly instead of presenting a generic error state.",
  ].join("\n");
}
