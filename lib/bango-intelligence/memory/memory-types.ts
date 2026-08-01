export type MemoryScope = "global" | "company" | "project" | "customer" | "user" | "task" | "phase";

export type MemoryJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: MemoryJson | undefined }
  | MemoryJson[];

export type MemoryCategory =
  | "preference"
  | "decision"
  | "recommendation"
  | "outcome"
  | "lesson_learned"
  | "operational_pattern"
  | "customer_preference"
  | "vendor_preference"
  | "crew_performance"
  | "safety_observation"
  | "financial_insight"
  | "project_milestone"
  | "document_summary"
  | "conversation_summary";

export type MemoryImportance = "critical" | "high" | "medium" | "low";
export type MemoryConfidence = "verified" | "observed" | "inferred" | "draft";
export type MemoryStatus = "active" | "archived" | "expired";
export type MemoryRecommendationStatus = "accepted" | "rejected" | "ignored" | "expired" | "implemented";

export type MemorySourceReference = {
  id: string;
  label: string;
  type: string;
  href: string | null;
};

export type MemoryWriteSource =
  | "user_explicit_save"
  | "recommendation_outcome"
  | "verified_project_lesson"
  | "operational_observation"
  | "verified_system_event";

export type MemoryRoleRestriction = {
  deniedRoles?: string[];
  requiredCapabilities?: string[];
  prohibitedCategories?: MemoryCategory[];
};

export type MemoryRecord = {
  id: string;
  scope: MemoryScope;
  category: MemoryCategory;
  companyId: string;
  projectId?: string | null;
  customerId?: string | null;
  userId?: string | null;
  taskId?: string | null;
  phaseId?: string | null;
  title: string;
  summary: string;
  details: MemoryJson;
  importance: MemoryImportance;
  confidence: MemoryConfidence;
  recommendationStatus?: MemoryRecommendationStatus | null;
  createdBy: string;
  updatedBy?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceReferences: MemorySourceReference[];
  tags: string[];
  status: MemoryStatus;
  archivedAt?: string | null;
  expiresAt?: string | null;
  roleRestrictions?: MemoryRoleRestriction[];
};

export type MemoryCreateInput = {
  scope: MemoryScope;
  category: MemoryCategory;
  projectId?: string | null;
  customerId?: string | null;
  userId?: string | null;
  taskId?: string | null;
  phaseId?: string | null;
  title: string;
  summary: string;
  details: MemoryJson;
  importance: MemoryImportance;
  confidence: MemoryConfidence;
  source: MemoryWriteSource;
  reason: string;
  sourceReferences: MemorySourceReference[];
  tags: string[];
  expiresAt?: string | null;
  recommendationStatus?: MemoryRecommendationStatus | null;
};

export type MemoryUpdateInput = {
  title?: string;
  summary?: string;
  details?: MemoryJson;
  importance?: MemoryImportance;
  confidence?: MemoryConfidence;
  tags?: string[];
  sourceReferences?: MemorySourceReference[];
  expiresAt?: string | null;
  status?: MemoryStatus;
  recommendationStatus?: MemoryRecommendationStatus | null;
};

export type MemoryArchiveInput = {
  reason: string;
};

export type MemoryVerifyInput = {
  reason: string;
};

export type MemoryRecommendationOutcomeInput = {
  status: MemoryRecommendationStatus;
  notes?: string | null;
};

export type MemoryActor = {
  requestId: string;
  userId: string;
  companyId: string;
  companyRole: string | null;
  allowedCapabilities: string[];
};

export type MemoryRetrievalQuery = {
  companyId: string;
  scope?: MemoryScope | MemoryScope[];
  scopeId?: string;
  projectId?: string | null;
  customerId?: string | null;
  userId?: string | null;
  taskId?: string | null;
  phaseId?: string | null;
  categories?: MemoryCategory[];
  minImportance?: MemoryImportance;
  maxResults?: number;
  roleId?: string;
  allowedCapabilities?: string[];
  requestType?: string;
  includeArchived?: boolean;
  includeExpired?: boolean;
};

export type MemoryEvidence = {
  recordId: string;
  rank: number;
  scope: MemoryScope;
  category: MemoryCategory;
  title: string;
  summary: string;
  importance: MemoryImportance;
  confidence: MemoryConfidence;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  sourceReferences: MemorySourceReference[];
};

export type MemoryDeduplicationOutcome =
  | "created_new"
  | "rejected_exact_duplicate"
  | "updated_existing"
  | "archived_previous_created_new";

export type MemoryWriteResult = {
  record: MemoryRecord;
  deduplicationOutcome: MemoryDeduplicationOutcome;
};

export type MemorySummarySection = {
  title: string;
  items: string[];
};

export type MemorySummary = {
  topLessons: string[];
  knownRisks: string[];
  knownPreferences: string[];
  knownDecisions: string[];
  knownPatterns: string[];
  sections: MemorySummarySection[];
  memoryCount: number;
  categoriesUsed: MemoryCategory[];
  rankedEvidence: MemoryEvidence[];
};

export type MemoryCapabilities = {
  roleId: string;
  allowedCategories: MemoryCategory[];
  deniedCategories: MemoryCategory[];
  canReadRestrictedFinancials: boolean;
  canReadRestrictedHR: boolean;
};

export type MemoryDNAConfidence = "high" | "medium" | "low";

export type ProjectDNA = {
  preferredScheduleStyle: string;
  communicationStyle: string;
  changeOrderFrequency: string;
  inspectionHistory: string;
  documentationQuality: string;
  riskTrend: string;
  budgetTrend: string;
  crewReliabilityTrend: string;
  confidence: MemoryDNAConfidence;
  evidenceCount: number;
};

export type CompanyDNA = {
  traits: Array<
    | "Quality-first"
    | "Speed-first"
    | "Budget-first"
    | "Documentation-heavy"
    | "Inspection-heavy"
    | "Change-order-heavy"
    | "Safety-focused"
    | "Growth-focused"
    | "Risk-averse"
  >;
  confidence: MemoryDNAConfidence;
  evidenceCount: number;
};

export type CustomerProfileSummary = {
  traits: string[];
  confidence: MemoryDNAConfidence;
  evidenceCount: number;
};

export type RecommendationHistoryStatus = MemoryRecommendationStatus;

export type RecommendationHistoryEntry = {
  id: string;
  memoryId: string;
  companyId: string;
  projectId?: string | null;
  customerId?: string | null;
  status: RecommendationHistoryStatus;
  recordedAt: string;
  reviewedBy?: string | null;
  notes?: string | null;
};

export type MemoryIndexEntry = {
  id: string;
  companyId: string;
  scope: MemoryScope;
  category: MemoryCategory;
  importance: MemoryImportance;
  confidence: MemoryConfidence;
  status: MemoryStatus;
  scopeId: string;
  projectId: string | null;
  customerId: string | null;
  userId: string | null;
  taskId: string | null;
  phaseId: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  summary: string;
  tags: string[];
  roleRestrictions: MemoryRoleRestriction[];
};

export type MemoryRetrievalResult = {
  records: MemoryRecord[];
  rankedEvidence: MemoryEvidence[];
  summary: MemorySummary;
  projectDNA: ProjectDNA | null;
  companyDNA: CompanyDNA;
  customerProfileSummary: CustomerProfileSummary | null;
  recommendationHistory: RecommendationHistoryEntry[];
  audit: {
    memoryCount: number;
    categoriesUsed: MemoryCategory[];
    rankingDurationMs: number;
    retrievalDurationMs: number;
    summaryDurationMs: number;
  };
};

export type MemoryAuditEvent = {
  requestId: string;
  userId: string;
  companyId: string;
  operation: "create" | "list" | "retrieve" | "update" | "archive" | "verify" | "record_recommendation_outcome";
  memoryId: string | null;
  scope: MemoryScope | null;
  category: MemoryCategory | null;
  source: MemoryWriteSource | null;
  success: boolean;
  validationResult: "pass" | "fail";
  authorizationResult: "pass" | "fail";
  deduplicationOutcome: MemoryDeduplicationOutcome | null;
  durationMs: number;
  failureReason: string | null;
};
