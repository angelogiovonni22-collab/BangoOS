import { computeDeterministicConfidence } from "./confidence-engine";
import type { LearningEngineOutput } from "./learning-types";
import type { LearningMemoryRow, LearningVendorRow } from "./learning-provider";
import type { LearningMetricRecord, LearningTimeWindow } from "./metric-types";

export function buildVendorLearning(
  companyId: string,
  vendors: ReadonlyArray<LearningVendorRow>,
  memories: ReadonlyArray<LearningMemoryRow>,
  timeWindow: LearningTimeWindow,
): LearningEngineOutput {
  const vendorIds = new Set(vendors.map((vendor) => vendor.id));
  const vendorMemories = memories.filter((memory) => memory.linked_vendor_id && vendorIds.has(memory.linked_vendor_id));

  const linkedMemoryCount = vendorMemories.length;
  const verifiedPreferenceCount = vendorMemories.filter(
    (memory) =>
      memory.category === "vendor_preference" &&
      memory.verification_status === "verified",
  ).length;
  const positiveOutcomeCount = vendorMemories.filter(
    (memory) => memory.recommendation_outcome === "positive",
  ).length;
  const negativeOutcomeCount = vendorMemories.filter(
    (memory) => memory.recommendation_outcome === "negative",
  ).length;

  const preferredVendors = vendors.filter((vendor) => vendor.preferred_vendor).length;
  const activeVendors = vendors.filter((vendor) => vendor.status === "active").length;

  const evidenceIds = vendorMemories.map((memory) => memory.id);
  const sourceCount = linkedMemoryCount;

  const metrics: LearningMetricRecord[] = [
    {
      id: `vendor-linked-memory-${companyId}`,
      metricType: "vendor_linked_memory_count",
      subjectType: "vendor",
      subjectId: companyId,
      companyId,
      value: linkedMemoryCount,
      unit: "count",
      direction: "stable",
      confidence: computeDeterministicConfidence({
        sourceCount,
        sampleSize: linkedMemoryCount,
        requiredSampleSize: 10,
      }),
      sourceCount,
      sampleSize: linkedMemoryCount,
      timeWindow,
      calculationMethod: "count(memories where linked_vendor_id is not null)",
      evidenceIds,
      limitations: linkedMemoryCount === 0 ? ["No vendor-linked memory records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `vendor-verified-pref-${companyId}`,
      metricType: "vendor_verified_preference_count",
      subjectType: "vendor",
      subjectId: companyId,
      companyId,
      value: verifiedPreferenceCount,
      unit: "count",
      direction: verifiedPreferenceCount > 0 ? "improving" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: verifiedPreferenceCount,
        sampleSize: linkedMemoryCount,
        requiredSampleSize: 6,
      }),
      sourceCount: verifiedPreferenceCount,
      sampleSize: linkedMemoryCount,
      timeWindow,
      calculationMethod: "count(verified vendor_preference memories)",
      evidenceIds,
      limitations: linkedMemoryCount === 0 ? ["No vendor-linked memories available for preference analysis."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `vendor-positive-outcomes-${companyId}`,
      metricType: "vendor_positive_outcome_count",
      subjectType: "vendor",
      subjectId: companyId,
      companyId,
      value: positiveOutcomeCount,
      unit: "count",
      direction: positiveOutcomeCount >= negativeOutcomeCount ? "improving" : "declining",
      confidence: computeDeterministicConfidence({
        sourceCount: positiveOutcomeCount + negativeOutcomeCount,
        sampleSize: linkedMemoryCount,
        requiredSampleSize: 6,
      }),
      sourceCount: positiveOutcomeCount + negativeOutcomeCount,
      sampleSize: linkedMemoryCount,
      timeWindow,
      calculationMethod: "count(memories where recommendation_outcome=positive)",
      evidenceIds,
      limitations: linkedMemoryCount === 0 ? ["No recommendation outcomes tied to vendors in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `vendor-negative-outcomes-${companyId}`,
      metricType: "vendor_negative_outcome_count",
      subjectType: "vendor",
      subjectId: companyId,
      companyId,
      value: negativeOutcomeCount,
      unit: "count",
      direction: negativeOutcomeCount > positiveOutcomeCount ? "declining" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: positiveOutcomeCount + negativeOutcomeCount,
        sampleSize: linkedMemoryCount,
        requiredSampleSize: 6,
      }),
      sourceCount: positiveOutcomeCount + negativeOutcomeCount,
      sampleSize: linkedMemoryCount,
      timeWindow,
      calculationMethod: "count(memories where recommendation_outcome=negative)",
      evidenceIds,
      limitations: linkedMemoryCount === 0 ? ["No recommendation outcomes tied to vendors in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `vendor-usage-${companyId}`,
      metricType: "vendor_usage_count",
      subjectType: "vendor",
      subjectId: companyId,
      companyId,
      value: activeVendors,
      unit: "count",
      direction: "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: activeVendors,
        sampleSize: vendors.length,
        requiredSampleSize: 5,
      }),
      sourceCount: activeVendors,
      sampleSize: vendors.length,
      timeWindow,
      calculationMethod: "count(vendors where status=active)",
      evidenceIds: vendors.map((vendor) => vendor.id),
      limitations: vendors.length === 0 ? ["No vendors found for company."] : [],
      generatedAt: timeWindow.endAt,
    },
  ];

  const traits = [
    {
      traitId: "vendor-network-strength",
      labelKey: "learning.traits.vendorNetworkStrength",
      metricType: "vendor_verified_preference_count" as const,
      confidence: computeDeterministicConfidence({
        sourceCount: preferredVendors + verifiedPreferenceCount,
        sampleSize: Math.max(vendors.length, linkedMemoryCount),
        requiredSampleSize: 8,
      }),
      evidenceCount: linkedMemoryCount + vendors.length,
      timeWindow,
      sourceIds: [...vendors.map((vendor) => vendor.id), ...evidenceIds],
      limitations: [
        "Vendor trait confidence is constrained by available verified preference and outcome records.",
      ],
    },
  ];

  const limitations: string[] = [];
  if (linkedMemoryCount < 3) {
    limitations.push("Vendor learning has limited reliability because fewer than 3 linked memories were observed.");
  }

  return {
    subjectType: "vendor",
    metrics,
    traits,
    limitations,
  };
}
