import type { MissionFreshness, MissionSeverity } from "@/lib/labs/mission-control/types";

export const missionTokens = {
  healthy: "var(--mc-healthy)",
  info: "var(--mc-info)",
  attention: "var(--mc-attention)",
  critical: "var(--mc-critical)",
  orion: "var(--mc-orion)",
  unknown: "var(--mc-unknown)",
  stale: "var(--mc-stale)",
  unavailable: "var(--mc-unavailable)",
} as const;

export function severityClass(severity: MissionSeverity) {
  return {
    healthy: "border-[color:color-mix(in_oklab,var(--mc-healthy)_50%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-healthy)_20%,transparent)] text-[var(--mc-healthy)]",
    info: "border-[color:color-mix(in_oklab,var(--mc-info)_50%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-info)_20%,transparent)] text-[var(--mc-info)]",
    attention: "border-[color:color-mix(in_oklab,var(--mc-attention)_52%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-attention)_20%,transparent)] text-[var(--mc-attention)]",
    critical: "border-[color:color-mix(in_oklab,var(--mc-critical)_56%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-critical)_20%,transparent)] text-[var(--mc-critical)]",
    orion: "border-[color:color-mix(in_oklab,var(--mc-orion)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-orion)_22%,transparent)] text-[var(--mc-orion)]",
    unknown: "border-[color:color-mix(in_oklab,var(--mc-unknown)_58%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-unknown)_18%,transparent)] text-[var(--mc-unknown)]",
    stale: "border-[color:color-mix(in_oklab,var(--mc-stale)_58%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-stale)_20%,transparent)] text-[var(--mc-stale)]",
    unavailable: "border-[color:color-mix(in_oklab,var(--mc-unavailable)_58%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-unavailable)_20%,transparent)] text-[var(--mc-unavailable)]",
  }[severity];
}

export function freshnessSeverity(freshness: MissionFreshness): MissionSeverity {
  if (freshness === "live") {
    return "healthy";
  }

  if (freshness === "partial") {
    return "attention";
  }

  if (freshness === "stale") {
    return "stale";
  }

  return "unknown";
}
