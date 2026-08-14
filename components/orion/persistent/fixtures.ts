import type { PersistentOrionFixture, PersistentOrionPalette, PersistentOrionStateId } from "./types";

const baseFixture: Omit<PersistentOrionFixture, "workspace" | "state" | "observation" | "whyItMatters" | "evidenceStatus" | "dataFreshness" | "recommendedNextReview" | "approvalBoundary" | "limitations"> = {};

function buildFixture(overrides: Omit<PersistentOrionFixture, keyof typeof baseFixture>) {
  return {
    ...baseFixture,
    ...overrides,
  };
}

export function getPersistentOrionFixture(pathname: string): PersistentOrionFixture {
  if (pathname === "/" || pathname.startsWith("/dashboard")) {
    return buildFixture({
      workspace: "Dashboard",
      state: "READY",
      observation: "Monitoring company operations.",
      whyItMatters: "Keeps executive priorities visible before risk compounds.",
      evidenceStatus: "Moderate",
      dataFreshness: "Fresh",
      recommendedNextReview: "Review executive overview at the next shift handoff.",
      approvalBoundary: "Advisory only. No autonomous execution.",
      limitations: "Prototype fixture only; no live source validation.",
    });
  }

  if (pathname.startsWith("/projects")) {
    return buildFixture({
      workspace: "Projects",
      state: "ANALYZING",
      observation: "Monitoring project health, schedule, and dependencies.",
      whyItMatters: "Early correlation helps prevent cascading schedule slippage.",
      evidenceStatus: "Moderate",
      dataFreshness: "Mixed",
      recommendedNextReview: "Review dependencies before the next milestone update.",
      approvalBoundary: "Project lead confirms any schedule action.",
      limitations: "Read-only context and deterministic fixture mapping.",
    });
  }

  if (pathname.startsWith("/crm") || pathname.startsWith("/customers")) {
    return buildFixture({
      workspace: "CRM",
      state: "NEW_INSIGHT",
      observation: "Monitoring follow-ups and customer activity.",
      whyItMatters: "Timely follow-up improves conversion and reduces revenue delay.",
      evidenceStatus: "High",
      dataFreshness: "Fresh",
      recommendedNextReview: "Review customer follow-up backlog this afternoon.",
      approvalBoundary: "Account owner approval required before escalations.",
      limitations: "No outbound messaging or CRM writes in prototype mode.",
    });
  }

  if (
    pathname.startsWith("/invoices")
    || pathname.startsWith("/estimates")
    || pathname.startsWith("/change-orders")
    || pathname.startsWith("/labor-rates")
  ) {
    return buildFixture({
      workspace: "Finance",
      state: "ATTENTION",
      observation: "Monitoring invoices, approvals, and cash-flow signals.",
      whyItMatters: "Approval lag can create avoidable billing bottlenecks.",
      evidenceStatus: "Moderate",
      dataFreshness: "Mixed",
      recommendedNextReview: "Review pending approvals before close of business.",
      approvalBoundary: "Finance manager approval required for any intervention.",
      limitations: "Prototype does not connect to accounting or payment rails.",
    });
  }

  if (pathname.startsWith("/equipment")) {
    return buildFixture({
      workspace: "Equipment",
      state: "CRITICAL",
      observation: "Monitoring inspections, maintenance, and assignments.",
      whyItMatters: "Inspection misses can expose immediate operational risk.",
      evidenceStatus: "High",
      dataFreshness: "Fresh",
      recommendedNextReview: "Review inspection queue before dispatch finalization.",
      approvalBoundary: "Safety and operations approval required before restart.",
      limitations: "Prototype warning is deterministic and not live compliance data.",
    });
  }

  if (
    pathname.startsWith("/crews")
    || pathname.startsWith("/employees")
    || pathname.startsWith("/team")
  ) {
    return buildFixture({
      workspace: "Workforce",
      state: "STALE_DATA",
      observation: "Monitoring workforce activity and missing updates.",
      whyItMatters: "Stale updates can hide staffing constraints.",
      evidenceStatus: "Limited",
      dataFreshness: "Stale",
      recommendedNextReview: "Refresh workforce signals before planning decisions.",
      approvalBoundary: "Manual verification required before reassignment.",
      limitations: "Fixture assumes stale telemetry for readability testing.",
    });
  }

  if (pathname.startsWith("/settings")) {
    return buildFixture({
      workspace: "Settings",
      state: "UNAVAILABLE",
      observation: "Orion intelligence is limited in this workspace.",
      whyItMatters: "Prevents overconfidence in advisory context outside operations views.",
      evidenceStatus: "Limited",
      dataFreshness: "Unavailable",
      recommendedNextReview: "Use Orion Core Lab for full prototype behavior.",
      approvalBoundary: "No advisory actions available in this view.",
      limitations: "Intelligence intentionally constrained for settings routes.",
    });
  }

  return buildFixture({
    workspace: "Workspace",
    state: "READY",
    observation: "Monitoring this workspace.",
    whyItMatters: "Maintains consistent contextual awareness across modules.",
    evidenceStatus: "Moderate",
    dataFreshness: "Mixed",
    recommendedNextReview: "Open Orion Core Lab for full state diagnostics.",
    approvalBoundary: "Prototype advisory only.",
    limitations: "Fixture-only context with deterministic route mapping.",
  });
}

export function getPersistentOrionPalette(state: PersistentOrionStateId): PersistentOrionPalette {
  if (state === "ANALYZING") {
    return {
      ring: "128, 96, 196",
      glow: "100, 72, 168",
      core: "170, 140, 226",
      accent: "150, 116, 216",
      line: "121, 102, 179",
      shadow: "rgba(92, 72, 132, 0.45)",
    };
  }

  if (state === "NEW_INSIGHT") {
    return {
      ring: "68, 168, 114",
      glow: "53, 142, 94",
      core: "132, 214, 168",
      accent: "98, 196, 146",
      line: "78, 150, 114",
      shadow: "rgba(45, 102, 74, 0.42)",
    };
  }

  if (state === "ATTENTION") {
    return {
      ring: "188, 144, 82",
      glow: "164, 124, 68",
      core: "224, 190, 132",
      accent: "212, 172, 102",
      line: "171, 136, 88",
      shadow: "rgba(110, 85, 48, 0.42)",
    };
  }

  if (state === "CRITICAL") {
    return {
      ring: "166, 70, 78",
      glow: "138, 54, 64",
      core: "210, 112, 122",
      accent: "166, 90, 124",
      line: "145, 67, 82",
      shadow: "rgba(95, 38, 48, 0.44)",
    };
  }

  if (state === "STALE_DATA") {
    return {
      ring: "168, 175, 188",
      glow: "136, 144, 158",
      core: "220, 226, 236",
      accent: "188, 196, 208",
      line: "154, 162, 176",
      shadow: "rgba(98, 106, 120, 0.38)",
    };
  }

  if (state === "UNAVAILABLE") {
    return {
      ring: "98, 103, 112",
      glow: "79, 84, 92",
      core: "138, 144, 154",
      accent: "116, 122, 132",
      line: "92, 97, 106",
      shadow: "rgba(52, 56, 64, 0.36)",
    };
  }

  return {
    ring: "84, 168, 226",
    glow: "64, 122, 202",
    core: "172, 228, 246",
    accent: "98, 188, 234",
    line: "82, 152, 214",
    shadow: "rgba(52, 94, 156, 0.44)",
  };
}
