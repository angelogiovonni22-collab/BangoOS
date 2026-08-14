import type { LearningDirection } from "./metric-types";

export type TrendInput = {
  current: number | null;
  previous: number | null;
  minimumDeltaPercent?: number;
};

export function calculateTrendDirection(input: TrendInput): LearningDirection {
  if (input.current === null || input.previous === null) {
    return "insufficient_data";
  }

  const minimumDeltaPercent = input.minimumDeltaPercent ?? 0.1;
  const baseline = Math.abs(input.previous) < Number.EPSILON ? 1 : Math.abs(input.previous);
  const deltaPercent = ((input.current - input.previous) / baseline) * 100;

  if (Math.abs(deltaPercent) < minimumDeltaPercent) {
    return "stable";
  }

  return deltaPercent > 0 ? "improving" : "declining";
}
