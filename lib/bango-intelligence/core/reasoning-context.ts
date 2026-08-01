import type { BriefingGroundingContext } from "../prompts/superintendent-briefing-prompt";
import type {
  BangoBusinessContext,
  BangoCapabilityId,
  BangoEvidence,
  BangoRoleDefinition,
} from "./context-types";
import type {
  CompanyDNA,
  CustomerProfileSummary,
  MemoryEvidence,
  MemorySummary,
  ProjectDNA,
  RecommendationHistoryEntry,
} from "../memory/memory-types";
import type {
  CompanyLearningDNA,
  CustomerLearningDNA,
  LearningBriefingLine,
  LearningSnapshot,
  ProjectLearningDNA,
} from "../learning/learning-types";

export type BangoReasoningContext = {
  role: {
    roleId: BangoRoleDefinition["roleId"];
    version: string;
    riskClassification: BangoRoleDefinition["riskClassification"];
    allowedCapabilities: BangoCapabilityId[];
    deniedCapabilities: BangoCapabilityId[];
  };
  request: BangoBusinessContext["request"];
  identity: Pick<BangoBusinessContext["identity"], "companyId" | "companyRole">;
  scope: BangoBusinessContext["scope"];
  company: BangoBusinessContext["company"];
  project: BangoBusinessContext["project"];
  grounding: BriefingGroundingContext | null;
  evidence: BangoEvidence[];
  memory: {
    summary: MemorySummary;
    rankedEvidence: MemoryEvidence[];
    projectDNA: ProjectDNA | null;
    companyDNA: CompanyDNA;
    customerProfileSummary: CustomerProfileSummary | null;
    recommendationHistory: RecommendationHistoryEntry[];
    briefing: string;
  };
  learning: {
    snapshot: LearningSnapshot | null;
    briefingLines: LearningBriefingLine[];
    companyDNA: CompanyLearningDNA | null;
    projectDNA: ProjectLearningDNA | null;
    customerDNA: CustomerLearningDNA | null;
  };
  capabilityRestrictions: {
    allowedCapabilities: BangoCapabilityId[];
    deniedCapabilities: BangoCapabilityId[];
  };
  approvalRequirements: BangoBusinessContext["permissions"]["approvalRequirements"];
  limitations: string[];
};

export function createReasoningContext(
  role: BangoRoleDefinition,
  context: BangoBusinessContext,
  evidence: BangoEvidence[],
  memoryContext?: BangoReasoningContext["memory"],
  learningContext?: BangoReasoningContext["learning"],
): BangoReasoningContext {
  const grounding: BriefingGroundingContext | null = context.project
    ? {
      projectName: context.project.name,
      projectStatus: context.project.status,
      briefingDate: context.project.briefing.briefingDate,
      briefingState: context.project.briefing.state,
      healthScore: context.project.intelligence.healthScore,
      healthStatus: context.project.intelligence.healthStatus,
      completionPercent: context.project.intelligence.completionPercent,
      activeTasks: context.project.intelligence.activeTasks,
      overdueTasks: context.project.intelligence.overdueTasks,
      blockedTasks: context.project.intelligence.blockedTasks,
      activePhasesCount: context.project.intelligence.activePhasesCount,
      tasksDueToday: context.project.intelligence.tasksDueToday,
      tasksDueThisWeek: context.project.intelligence.tasksDueThisWeek,
      daysUntilDue: context.project.intelligence.daysUntilDue,
      photosCount: context.project.intelligence.photosCount,
      documentationPresent: context.project.intelligence.documentationPresent,
      assignedWorkers: context.project.intelligence.assignedWorkers,
      unassignedTaskCount: context.project.intelligence.unassignedTaskCount,
      contractAmount: context.project.intelligence.contractAmount,
      invoicePaid: context.project.intelligence.invoicePaid,
      invoiceTotal: context.project.intelligence.invoiceTotal,
      budgetVariance: context.project.intelligence.budgetVariance,
      overdueInvoices: context.project.intelligence.overdueInvoices,
      estimatesCount: context.project.intelligence.estimatesCount,
      changeOrdersCount: context.project.intelligence.changeOrdersCount,
      highestRisk: context.project.intelligence.highestRiskSeverity,
      risks: context.project.intelligence.risks,
    }
    : null;

  return {
    role: {
      roleId: role.roleId,
      version: role.version,
      riskClassification: role.riskClassification,
      allowedCapabilities: [...context.permissions.allowedCapabilities],
      deniedCapabilities: [...context.permissions.deniedCapabilities],
    },
    request: context.request,
    identity: {
      companyId: context.identity.companyId,
      companyRole: context.identity.companyRole,
    },
    scope: context.scope,
    company: context.company,
    project: context.project,
    grounding,
    evidence,
    memory: memoryContext ?? {
      summary: {
        topLessons: [],
        knownRisks: [],
        knownPreferences: [],
        knownDecisions: [],
        knownPatterns: [],
        sections: [],
        memoryCount: 0,
        categoriesUsed: [],
        rankedEvidence: [],
      },
      rankedEvidence: [],
      projectDNA: null,
      companyDNA: { traits: [], confidence: "low", evidenceCount: 0 },
      customerProfileSummary: null,
      recommendationHistory: [],
      briefing: "Memory count: 0\nCategories used: none\nCompany DNA: unsupported (low)\nProject DNA: not enough evidence\nCustomer profile: not enough evidence",
    },
    learning: learningContext ?? {
      snapshot: null,
      briefingLines: [],
      companyDNA: null,
      projectDNA: null,
      customerDNA: null,
    },
    capabilityRestrictions: {
      allowedCapabilities: [...context.permissions.allowedCapabilities],
      deniedCapabilities: [...context.permissions.deniedCapabilities],
    },
    approvalRequirements: context.permissions.approvalRequirements,
    limitations: [...context.limitations],
  };
}
