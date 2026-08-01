import { computeDeterministicConfidence } from "./confidence-engine";
import type { LearningEngineOutput } from "./learning-types";
import type { LearningCustomerRow, LearningMemoryRow } from "./learning-provider";
import type { LearningMetricRecord, LearningTimeWindow } from "./metric-types";

export function buildCustomerLearning(
  companyId: string,
  customers: ReadonlyArray<LearningCustomerRow>,
  memories: ReadonlyArray<LearningMemoryRow>,
  timeWindow: LearningTimeWindow,
): LearningEngineOutput {
  const customerIds = new Set(customers.map((customer) => customer.id));
  const customerMemories = memories.filter((memory) => memory.customer_id && customerIds.has(memory.customer_id));
  const evidenceIds = customerMemories.map((memory) => memory.id);

  const verifiedPreferenceCount = customerMemories.filter(
    (memory) => memory.category === "customer_preference" && memory.verification_status === "verified",
  ).length;
  const changeObservationCount = customerMemories.filter(
    (memory) => memory.category === "change_order_pattern",
  ).length;
  const paymentObservationCount = customerMemories.filter(
    (memory) => memory.category === "payment_pattern",
  ).length;

  const metrics: LearningMetricRecord[] = [
    {
      id: `customer-verified-pref-${companyId}`,
      metricType: "customer_verified_preference_count",
      subjectType: "customer",
      subjectId: companyId,
      companyId,
      value: verifiedPreferenceCount,
      unit: "count",
      direction: verifiedPreferenceCount > 0 ? "improving" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: verifiedPreferenceCount,
        sampleSize: customerMemories.length,
        requiredSampleSize: 6,
      }),
      sourceCount: verifiedPreferenceCount,
      sampleSize: customerMemories.length,
      timeWindow,
      calculationMethod: "count(verified customer_preference memories)",
      evidenceIds,
      limitations:
        customerMemories.length === 0 ? ["No customer-linked memories found in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `customer-change-observation-${companyId}`,
      metricType: "customer_change_observation_count",
      subjectType: "customer",
      subjectId: companyId,
      companyId,
      value: changeObservationCount,
      unit: "count",
      direction: "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: changeObservationCount,
        sampleSize: customerMemories.length,
        requiredSampleSize: 5,
      }),
      sourceCount: changeObservationCount,
      sampleSize: customerMemories.length,
      timeWindow,
      calculationMethod: "count(memories where category=change_order_pattern and customer_id is not null)",
      evidenceIds,
      limitations:
        customerMemories.length === 0 ? ["No customer-linked memories found in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `customer-payment-observation-${companyId}`,
      metricType: "customer_payment_observation_count",
      subjectType: "customer",
      subjectId: companyId,
      companyId,
      value: paymentObservationCount,
      unit: "count",
      direction: "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: paymentObservationCount,
        sampleSize: customerMemories.length,
        requiredSampleSize: 5,
      }),
      sourceCount: paymentObservationCount,
      sampleSize: customerMemories.length,
      timeWindow,
      calculationMethod: "count(memories where category=payment_pattern and customer_id is not null)",
      evidenceIds,
      limitations:
        customerMemories.length === 0 ? ["No customer-linked memories found in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
  ];

  const traits = [
    {
      traitId: "customer-collaboration-style",
      labelKey: "learning.traits.customerCollaborationStyle",
      metricType: "customer_verified_preference_count" as const,
      confidence: computeDeterministicConfidence({
        sourceCount: verifiedPreferenceCount + changeObservationCount + paymentObservationCount,
        sampleSize: customerMemories.length,
        requiredSampleSize: 8,
      }),
      evidenceCount: customerMemories.length,
      timeWindow,
      sourceIds: evidenceIds,
      limitations: [
        "Customer collaboration trait only includes explicit customer-linked memory records.",
      ],
    },
  ];

  const limitations: string[] = [];
  if (customerMemories.length < 3) {
    limitations.push("Customer learning has limited reliability because fewer than 3 customer-linked memories were observed.");
  }

  return {
    subjectType: "customer",
    metrics,
    traits,
    limitations,
  };
}
