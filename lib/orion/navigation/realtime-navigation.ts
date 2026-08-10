import { resolveDeterministicNavigationRoute } from "./catalog";

/**
 * Normalizes the small amount of conversational framing that commonly wraps a
 * direct voice-navigation command before handing it to the canonical B.O.S.
 * deterministic navigation catalog.
 *
 * This intentionally does not fuzzy-match entity names or longer requests.
 * "Open customers" should navigate immediately; "open John Smith's project"
 * must continue through Orion intelligence/entity resolution instead.
 */
export function normalizeRealtimeNavigationUtterance(input: string) {
  return input
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/^\s*(?:(?:hey|hi|hello|okay|ok)\s+)?orion(?:[,\s:;-]+|$)/i, "")
    .replace(/^please\s+/i, "")
    .replace(/\s+please$/i, "")
    .trim();
}

export function resolveRealtimeNavigationCommand(input: string) {
  const normalized = normalizeRealtimeNavigationUtterance(input);
  if (!normalized) return null;
  return resolveDeterministicNavigationRoute(normalized);
}
