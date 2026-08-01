import { filterMetricsByMinimumConfidence, maxConfidence } from "./evidence-aggregation";
import { buildCompanyLearning } from "./company-learning-engine";
import { buildCrewLearning } from "./crew-learning-engine";
import { buildCustomerLearning } from "./customer-learning-engine";
import { buildProjectLearning } from "./project-learning-engine";
import { buildVendorLearning } from "./vendor-learning-engine";
import type {
  CompanyLearningDNA,
  CustomerLearningDNA,
  LearningContextResult,
  ProjectLearningDNA,
  StructuredLearningDNA,
} from "./learning-types";
import type {
  LearningProvider,
  LearningTimeScope,
} from "./learning-provider";
import type {
  LearningConfidence,
  LearningMetricRecord,
  LearningTimeWindow,
} from "./metric-types";

export type LearningServiceInput = {
  companyId: string;
  projectId: string | null;
  customerId: string | null;
  nowIso?: string;
};

export type LearningServiceResult = LearningContextResult & {
  companyDNA: CompanyLearningDNA;
  projectDNA: ProjectLearningDNA | null;
  customerDNA: CustomerLearningDNA | null;
};

function buildTimeScope(nowIso: string, days: number): LearningTimeScope {
  const endDate = new Date(nowIso);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  return {
    fromIso: startDate.toISOString(),
    toIso: endDate.toISOString(),
  };
}

function toTimeWindow(scope: LearningTimeScope): LearningTimeWindow {
  return {
    name: "recent_90_days",
    startAt: scope.fromIso,
    endAt: scope.toIso,
  };
}

function computeOverallConfidence(metrics: ReadonlyArray<LearningMetricRecord>): LearningConfidence {
  let result: LearningConfidence = "insufficient";

  for (const metric of metrics) {
    result = maxConfidence(result, metric.confidence);
  }

  return result;
}

function toStructuredDNA(traits: StructuredLearningDNA["traits"], metrics: ReadonlyArray<LearningMetricRecord>): StructuredLearningDNA {
  const evidenceCount = metrics.reduce((sum, metric) => sum + metric.evidenceIds.length, 0);
  const limitations = [
    ...new Set([
      ...traits.flatMap((trait) => trait.limitations),
      ...metrics.flatMap((metric) => metric.limitations),
    ]),
  ];

  return {
    traits,
    evidenceCount,
    confidence: computeOverallConfidence(metrics),
    generatedAt: new Date().toISOString(),
    limitations,
  };
}

export async function buildDeterministicLearningContext(
  provider: LearningProvider,
  input: LearningServiceInput,
): Promise<LearningServiceResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const scope = buildTimeScope(nowIso, 90);
  const timeWindow = toTimeWindow(scope);

  const [tasks, projects, changeOrders, estimates, invoices, memories, vendors, customers, equipment, materials] =
    await Promise.all([
      provider.getTasks(input.companyId, scope),
      provider.getProjects(input.companyId, scope),
      provider.getChangeOrders(input.companyId, scope),
      provider.getEstimates(input.companyId, scope),
      provider.getInvoices(input.companyId, scope),
      provider.getMemories(input.companyId, scope),
      provider.getVendors(input.companyId),
      provider.getCustomers(input.companyId),
      provider.getEquipment(input.companyId, scope),
      provider.getMaterials(input.companyId, scope),
    ]);

  const project = input.projectId ? projects.find((item) => item.id === input.projectId) ?? null : null;

  const crewLearning = buildCrewLearning(input.companyId, tasks, timeWindow);
  const vendorLearning = buildVendorLearning(input.companyId, vendors, memories, timeWindow);
  const customerLearning = buildCustomerLearning(input.companyId, customers, memories, timeWindow);
  const projectLearning = buildProjectLearning(
    input.companyId,
    project,
    tasks,
    changeOrders,
    estimates,
    invoices,
    memories,
    timeWindow,
  );
  const companyLearning = buildCompanyLearning(
    input.companyId,
    memories,
    tasks,
    projects,
    equipment,
    materials,
    timeWindow,
  );

  const allMetrics = [
    ...crewLearning.metrics,
    ...vendorLearning.metrics,
    ...customerLearning.metrics,
    ...projectLearning.metrics,
    ...companyLearning.metrics,
  ];

  const highConfidenceMetrics = filterMetricsByMinimumConfidence(allMetrics, "medium");
  const allTraits = [
    ...crewLearning.traits,
    ...vendorLearning.traits,
    ...customerLearning.traits,
    ...projectLearning.traits,
    ...companyLearning.traits,
  ];

  const briefingLines = highConfidenceMetrics.slice(0, 8).map((metric) => ({
    metricId: metric.id,
    confidence: metric.confidence,
    text: `${metric.metricType}: ${String(metric.value)} ${metric.unit}`,
  }));

  const companyDNA = toStructuredDNA(companyLearning.traits, companyLearning.metrics);

  const projectDNA = project
    ? toStructuredDNA(projectLearning.traits, projectLearning.metrics)
    : null;

  const customerDNA = input.customerId
    ? toStructuredDNA(
        customerLearning.traits,
        customerLearning.metrics.filter((metric) => metric.subjectType === "customer"),
      )
    : null;

  const limitations = [
    ...new Set([
      ...crewLearning.limitations,
      ...vendorLearning.limitations,
      ...customerLearning.limitations,
      ...projectLearning.limitations,
      ...companyLearning.limitations,
    ]),
  ];

  return {
    snapshot: {
      metrics: allMetrics,
      traits: allTraits,
      generatedAt: nowIso,
      limitations,
    },
    briefingLines,
    companyDNA,
    projectDNA,
    customerDNA,
  };
}
