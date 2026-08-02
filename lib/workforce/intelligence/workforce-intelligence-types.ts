import type {
  WorkforceAssignmentRow,
  WorkforceCrewRow,
  WorkforceEmployeeRow,
  WorkforceMembershipRow,
  WorkforcePhaseRow,
  WorkforceProfileRow,
  WorkforceProjectRow,
  WorkforceTaskRow,
} from "../workforce-types";

export type WorkforceIntelligenceSeverity = "critical" | "high" | "medium" | "low";

export type WorkforceIntelligenceCategory = "coverage" | "conflict" | "relationship" | "data_quality";

export type WorkforceSignalType =
  | "ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT"
  | "ACTIVE_CREW_WITHOUT_ASSIGNMENT"
  | "EMPLOYEE_ASSIGNMENT_OVERLAP"
  | "CREW_ASSIGNMENT_OVERLAP"
  | "EMPLOYEE_WITHOUT_ACTIVE_CREW"
  | "CREW_WITHOUT_ACTIVE_LEAD"
  | "ASSIGNMENT_MISSING_PROJECT_CONTEXT"
  | "ASSIGNMENT_MISSING_REQUIRED_ENTITY"
  | "STALE_WORKFORCE_RECORD"
  | "INCOMPLETE_WORKFORCE_RELATIONSHIP"
  | "UPCOMING_ASSIGNMENT_WITHOUT_STAFFING"
  | "WORKFORCE_CONDITION_UNVERIFIABLE_STALE_DATA";

export type WorkforceFindingType = WorkforceSignalType;

export type WorkforceAffectedEntityType =
  | "employee"
  | "crew"
  | "assignment"
  | "membership"
  | "project"
  | "phase"
  | "task"
  | "profile"
  | "workspace";

export type WorkforceAffectedEntity = {
  entityType: WorkforceAffectedEntityType;
  entityId: string;
  displayName: string | null;
};

export type WorkforceDataFreshness = {
  staleThresholdHours: number;
  isStale: boolean;
  latestUpdatedAt: string | null;
  evaluatedAt: string;
};

export type WorkforceDataCompleteness = {
  isComplete: boolean;
  missingFields: string[];
  missingRelationships: string[];
};

export type WorkforceSignal = {
  id: string;
  companyId: string;
  domain: "workforce";
  type: WorkforceSignalType;
  category: WorkforceIntelligenceCategory;
  severity: WorkforceIntelligenceSeverity;
  confidence: number;
  detectedAt: string;
  affectedEntities: WorkforceAffectedEntity[];
  evidence: Record<string, unknown>;
  dataFreshness: WorkforceDataFreshness;
  dataCompleteness: WorkforceDataCompleteness;
  ruleId: string;
  ruleVersion: string;
};

export type WorkforceFindingStatus = "open";

export type WorkforceFinding = {
  id: string;
  companyId: string;
  type: WorkforceFindingType;
  category: WorkforceIntelligenceCategory;
  severity: WorkforceIntelligenceSeverity;
  title: string;
  observation: string;
  explanation: string;
  confidence: number;
  affectedEntities: WorkforceAffectedEntity[];
  supportingSignalIds: string[];
  evidence: Record<string, unknown>;
  assumptions: string[];
  limitations: string[];
  recommendedNextStep: string;
  detectedAt: string;
  freshness: WorkforceDataFreshness;
  status: WorkforceFindingStatus;
};

export type WorkforceFreshnessConfig = {
  workforceRecordStaleAfterHours: number;
};

export type WorkforceIntelligenceEvaluationInput = {
  companyId: string;
  employees: WorkforceEmployeeRow[];
  crews: WorkforceCrewRow[];
  memberships: WorkforceMembershipRow[];
  assignments: WorkforceAssignmentRow[];
  projects: WorkforceProjectRow[];
  phases: WorkforcePhaseRow[];
  tasks: WorkforceTaskRow[];
  profiles: WorkforceProfileRow[];
  now?: Date;
  freshness?: Partial<WorkforceFreshnessConfig>;
  availability: {
    projects: "live" | "unavailable";
    phases: "live" | "unavailable";
    tasks: "live" | "unavailable";
    profiles: "live" | "unavailable";
  };
};

export type WorkforceEvaluationLimitation = {
  code: string;
  message: string;
};

export type WorkforceSignalEvaluationResult = {
  signals: WorkforceSignal[];
  partialNotices: string[];
  limitations: WorkforceEvaluationLimitation[];
};

export type WorkforceIntelligenceResult = {
  companyId: string;
  evaluatedAt: string;
  partialNotices: string[];
  limitations: WorkforceEvaluationLimitation[];
  signals: WorkforceSignal[];
  findings: WorkforceFinding[];
};

export type WorkforceIntelligenceService = {
  evaluateCompany: (
    companyId: string,
    options?: { now?: Date; freshness?: Partial<WorkforceFreshnessConfig> },
  ) => Promise<WorkforceIntelligenceResult>;
};
