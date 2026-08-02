import { clamp } from "./helpers";
import type { BusinessSignalInput, SignalConfidence } from "./types";

export function computeSignalConfidence(input: Pick<BusinessSignalInput, "evidence" | "missingInformation" | "freshness">): SignalConfidence {
  const evidenceCount = input.evidence.length;
  const missingCount = input.missingInformation.length;

  const freshnessPenalty =
    input.freshness === "live" ? 0 :
      input.freshness === "partial" ? 8 :
        input.freshness === "stale" ? 18 : 24;

  const raw = 38 + Math.min(44, evidenceCount * 12) - missingCount * 10 - freshnessPenalty;
  const percent = clamp(Math.round(raw), 5, 99);

  const evidenceReasons = input.evidence.slice(0, 4).map((item) => item.label);
  const missingReasons = input.missingInformation.slice(0, 3);

  const reasons = [
    ...evidenceReasons,
    ...missingReasons.map((item) => `Missing: ${item}`),
    input.freshness === "live"
      ? "Data freshness is live"
      : input.freshness === "partial"
        ? "Data freshness is partial"
        : input.freshness === "stale"
          ? "Data freshness is stale"
          : "Data freshness is unknown",
  ];

  return {
    percent,
    reasons: reasons.length > 0 ? reasons : ["Limited evidence available"],
  };
}
