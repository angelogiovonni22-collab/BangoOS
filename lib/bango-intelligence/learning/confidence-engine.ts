import type { LearningConfidence } from "./metric-types";

export type ConfidenceInput = {
  sourceCount: number;
  sampleSize: number;
  requiredSampleSize: number;
};

export function computeDeterministicConfidence(input: ConfidenceInput): LearningConfidence {
  const sourceCount = Math.max(0, input.sourceCount);
  const sampleSize = Math.max(0, input.sampleSize);
  const requiredSampleSize = Math.max(1, input.requiredSampleSize);

  if (sourceCount <= 0 || sampleSize <= 0) {
    return "insufficient";
  }

  if (sourceCount >= 5 && sampleSize >= requiredSampleSize) {
    return "high";
  }

  if (sourceCount >= 3 && sampleSize >= Math.ceil(requiredSampleSize * 0.6)) {
    return "medium";
  }

  if (sourceCount >= 2 && sampleSize >= Math.ceil(requiredSampleSize * 0.3)) {
    return "low";
  }

  return "insufficient";
}
