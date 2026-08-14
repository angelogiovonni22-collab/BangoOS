import { buildKnowledgeGraphFixtures } from "../knowledge-graph";
import { buildOrionMemoryFixtures } from "../memory";
import type { ExecutivePipelineFixture, ExecutiveSignalFact } from "./executive-intelligence-types";

const NOW = "2026-08-02T12:00:00.000Z";

function baseSignalFact(overrides: Partial<ExecutiveSignalFact> & Pick<ExecutiveSignalFact, "companyId" | "category" | "severity" | "urgency" | "observation" | "canonicalConditionType" | "ruleFamily" | "signalType" | "entityReferences">): ExecutiveSignalFact {
  return {
    companyId: overrides.companyId,
    category: overrides.category,
    severity: overrides.severity,
    urgency: overrides.urgency,
    observation: overrides.observation,
    evidence: overrides.evidence ?? [
      {
        id: `ev-${overrides.canonicalConditionType}`,
        label: "Deterministic fixture evidence",
        value: overrides.canonicalConditionType,
        source: "fixture",
        observedAt: NOW,
      },
    ],
    missingInformation: overrides.missingInformation ?? [],
    freshness: overrides.freshness ?? "live",
    createdAt: overrides.createdAt ?? NOW,
    canonicalConditionType: overrides.canonicalConditionType,
    ruleFamily: overrides.ruleFamily,
    signalType: overrides.signalType,
    entityReferences: overrides.entityReferences,
    graphRootEntity: overrides.graphRootEntity,
    approvalBoundary: overrides.approvalBoundary,
  };
}

function buildBaseFixture(companyId: string): Omit<ExecutivePipelineFixture, "scenarioId" | "signalFacts" | "sourceAvailability"> {
  const graph = buildKnowledgeGraphFixtures();
  return {
    companyId,
    evaluationWindow: {
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-08-02T23:59:59.999Z",
    },
    memoryRecords: buildOrionMemoryFixtures(),
    graph: {
      nodes: graph.nodes,
      edges: graph.edges,
    },
  };
}

export function buildExecutiveIntelligenceFixtures(): Record<string, ExecutivePipelineFixture> {
  const base = buildBaseFixture("company-a");

  const normalOperations: ExecutivePipelineFixture = {
    ...base,
    scenarioId: "normal-operations",
    sourceAvailability: {
      memory: "available",
      graph: "available",
    },
    signalFacts: [
      baseSignalFact({
        companyId: "company-a",
        category: "operations",
        severity: "low",
        urgency: "monitor",
        observation: "Task throughput remains stable with one minor handoff optimization opportunity.",
        canonicalConditionType: "stable_throughput",
        ruleFamily: "operations.stability",
        signalType: "operations_stable",
        entityReferences: [{ entityType: "project", entityId: "proj-riverside", companyId: "company-a" }],
        graphRootEntity: { entityType: "project", entityId: "proj-riverside" },
      }),
    ],
  };

  const crewUpdateRisk: ExecutivePipelineFixture = {
    ...base,
    scenarioId: "crew-update-risk",
    sourceAvailability: {
      memory: "available",
      graph: "available",
    },
    signalFacts: [
      baseSignalFact({
        companyId: "company-a",
        category: "workforce",
        severity: "high",
        urgency: "today",
        observation: "Crew Alpha has not submitted a required update for the active shift.",
        canonicalConditionType: "crew_missing_update",
        ruleFamily: "workforce.reporting",
        signalType: "crew_missing_update",
        missingInformation: ["Supervisor check-in timestamp"],
        freshness: "partial",
        entityReferences: [{ entityType: "crew", entityId: "crew-alpha", companyId: "company-a" }],
        graphRootEntity: { entityType: "crew", entityId: "crew-alpha" },
        approvalBoundary: "Supervisor review required before assignment changes.",
      }),
    ],
  };

  const customerApprovalDelay: ExecutivePipelineFixture = {
    ...base,
    scenarioId: "customer-approval-delay",
    sourceAvailability: {
      memory: "available",
      graph: "available",
    },
    signalFacts: [
      baseSignalFact({
        companyId: "company-a",
        category: "customer",
        severity: "medium",
        urgency: "soon",
        observation: "Change order approval is delayed and invoice progression is waiting.",
        canonicalConditionType: "customer_approval_delay",
        ruleFamily: "customer.approvals",
        signalType: "customer_approval_delay",
        entityReferences: [{ entityType: "customer", entityId: "cust-riverside", companyId: "company-a" }],
        graphRootEntity: { entityType: "change_order", entityId: "co-7" },
      }),
      baseSignalFact({
        companyId: "company-a",
        category: "financial",
        severity: "high",
        urgency: "today",
        observation: "Invoice timeline is extending due to pending approval dependencies.",
        canonicalConditionType: "invoice_delay",
        ruleFamily: "financial.billing",
        signalType: "invoice_delay",
        entityReferences: [{ entityType: "invoice", entityId: "inv-1842", companyId: "company-a" }],
        graphRootEntity: { entityType: "invoice", entityId: "inv-1842" },
      }),
    ],
  };

  const equipmentComplianceRisk: ExecutivePipelineFixture = {
    ...base,
    scenarioId: "equipment-compliance-risk",
    sourceAvailability: {
      memory: "available",
      graph: "available",
    },
    signalFacts: [
      baseSignalFact({
        companyId: "company-a",
        category: "equipment",
        severity: "critical",
        urgency: "immediate",
        observation: "Lift 44 inspection is overdue before a scheduled dependency window.",
        canonicalConditionType: "equipment_inspection_overdue",
        ruleFamily: "equipment.compliance",
        signalType: "equipment_inspection_warning",
        missingInformation: ["Inspector confirmation"],
        freshness: "live",
        entityReferences: [{ entityType: "equipment", entityId: "equip-lift-44", companyId: "company-a" }],
        graphRootEntity: { entityType: "equipment", entityId: "equip-lift-44" },
      }),
      baseSignalFact({
        companyId: "company-a",
        category: "safety",
        severity: "high",
        urgency: "today",
        observation: "Inspection dependency risk is elevated for the affected project phase.",
        canonicalConditionType: "inspection_dependency_risk",
        ruleFamily: "safety.inspection",
        signalType: "inspection_risk",
        entityReferences: [{ entityType: "project", entityId: "proj-riverside", companyId: "company-a" }],
        graphRootEntity: { entityType: "inspection", entityId: "insp-901" },
      }),
    ],
  };

  const mixedPartialData: ExecutivePipelineFixture = {
    ...base,
    scenarioId: "mixed-partial-data",
    sourceAvailability: {
      memory: "unavailable",
      graph: "available",
    },
    signalFacts: [
      baseSignalFact({
        companyId: "company-a",
        category: "schedule",
        severity: "medium",
        urgency: "today",
        observation: "Delivery scheduling conflict is probable from stale dependency edges.",
        canonicalConditionType: "delivery_schedule_risk",
        ruleFamily: "schedule.dependencies",
        signalType: "delivery_delay",
        freshness: "partial",
        entityReferences: [{ entityType: "schedule_event", entityId: "sched-delivery-12", companyId: "company-a" }],
        graphRootEntity: { entityType: "schedule_event", entityId: "sched-delivery-12" },
      }),
      baseSignalFact({
        companyId: "company-a",
        category: "workforce",
        severity: "low",
        urgency: "monitor",
        observation: "One roster feed remains unknown; verify before shift planning.",
        canonicalConditionType: "workforce_data_unknown",
        ruleFamily: "workforce.quality",
        signalType: "workforce_data_gap",
        freshness: "unknown",
        missingInformation: ["Roster synchronization status"],
        entityReferences: [{ entityType: "crew", entityId: "crew-alpha", companyId: "company-a" }],
      }),
    ],
  };

  const crossCompanyAttack: ExecutivePipelineFixture = {
    ...base,
    scenarioId: "cross-company-attack",
    sourceAvailability: {
      memory: "available",
      graph: "available",
    },
    signalFacts: [
      baseSignalFact({
        companyId: "company-a",
        category: "financial",
        severity: "high",
        urgency: "today",
        observation: "Mixed-company invoice relationship attempt should be rejected.",
        canonicalConditionType: "cross_company_mixed_invoice",
        ruleFamily: "security.scope",
        signalType: "cross_company_attack",
        entityReferences: [{ entityType: "invoice", entityId: "inv-1842", companyId: "company-a" }],
        graphRootEntity: { entityType: "invoice", entityId: "inv-1842" },
      }),
      baseSignalFact({
        companyId: "company-b",
        category: "financial",
        severity: "critical",
        urgency: "immediate",
        observation: "Injected cross-company record should never be accepted.",
        canonicalConditionType: "cross_company_injected",
        ruleFamily: "security.scope",
        signalType: "cross_company_attack",
        entityReferences: [{ entityType: "invoice", entityId: "inv-1842", companyId: "company-b" }],
      }),
    ],
  };

  return {
    "normal-operations": normalOperations,
    "crew-update-risk": crewUpdateRisk,
    "customer-approval-delay": customerApprovalDelay,
    "equipment-compliance-risk": equipmentComplianceRisk,
    "mixed-partial-data": mixedPartialData,
    "cross-company-attack": crossCompanyAttack,
  };
}
