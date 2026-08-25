"use client";

/**
 * Route context is intentionally omitted from the global top bar.
 * The sidebar already communicates navigation state and each workspace owns
 * one clear page title, avoiding repeated labels such as Operations.
 */
export function NavigationBreadcrumb() {
  return null;
}
