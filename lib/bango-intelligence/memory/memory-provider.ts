import type {
  MemoryActor,
  MemoryArchiveInput,
  MemoryCreateInput,
  MemoryRecommendationOutcomeInput,
  MemoryRecord,
  MemoryRetrievalQuery,
  MemoryUpdateInput,
  MemoryVerifyInput,
  MemoryWriteResult,
} from "./memory-types";

export interface MemoryProvider {
  findRecords(query: MemoryRetrievalQuery): Promise<MemoryRecord[]>;
  findRecordById(companyId: string, memoryId: string): Promise<MemoryRecord | null>;
  createRecord(actor: MemoryActor, input: MemoryCreateInput): Promise<MemoryWriteResult>;
  updateRecord(actor: MemoryActor, memoryId: string, input: MemoryUpdateInput): Promise<MemoryRecord>;
  archiveRecord(actor: MemoryActor, memoryId: string, input: MemoryArchiveInput): Promise<MemoryRecord>;
  verifyRecord(actor: MemoryActor, memoryId: string, input: MemoryVerifyInput): Promise<MemoryRecord>;
  recordRecommendationOutcome(actor: MemoryActor, memoryId: string, input: MemoryRecommendationOutcomeInput): Promise<MemoryRecord>;
}

export class InMemoryMemoryProvider implements MemoryProvider {
  private readonly records = new Map<string, MemoryRecord>();

  constructor(initialRecords: MemoryRecord[] = []) {
    for (const record of initialRecords) {
      this.records.set(record.id, record);
    }
  }

  async findRecords(query: MemoryRetrievalQuery): Promise<MemoryRecord[]> {
    return [...this.records.values()].filter((record) => matchesQuery(record, query));
  }

  async findRecordById(companyId: string, memoryId: string): Promise<MemoryRecord | null> {
    const record = this.records.get(memoryId);
    if (!record || record.companyId !== companyId) {
      return null;
    }
    return record;
  }

  async createRecord(actor: MemoryActor, input: MemoryCreateInput): Promise<MemoryWriteResult> {
    const createdAt = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: MemoryRecord = {
      id,
      companyId: actor.companyId,
      scope: input.scope,
      category: input.category,
      projectId: input.projectId ?? null,
      customerId: input.customerId ?? null,
      userId: input.userId ?? null,
      taskId: input.taskId ?? null,
      phaseId: input.phaseId ?? null,
      title: input.title,
      summary: input.summary,
      details: input.details,
      importance: input.importance,
      confidence: input.confidence,
      recommendationStatus: input.recommendationStatus ?? null,
      createdBy: actor.userId,
      updatedBy: actor.userId,
      verifiedBy: null,
      verifiedAt: null,
      createdAt,
      updatedAt: createdAt,
      sourceReferences: input.sourceReferences,
      tags: input.tags,
      status: "active",
      archivedAt: null,
      expiresAt: input.expiresAt ?? null,
      roleRestrictions: [],
    };

    this.records.set(record.id, record);
    return { record, deduplicationOutcome: "created_new" };
  }

  async updateRecord(actor: MemoryActor, memoryId: string, input: MemoryUpdateInput): Promise<MemoryRecord> {
    const record = await this.findRecordById(actor.companyId, memoryId);
    if (!record) {
      throw new Error("Memory not found.");
    }

    const updated: MemoryRecord = {
      ...record,
      title: input.title ?? record.title,
      summary: input.summary ?? record.summary,
      details: input.details ?? record.details,
      importance: input.importance ?? record.importance,
      confidence: input.confidence ?? record.confidence,
      tags: input.tags ?? record.tags,
      sourceReferences: input.sourceReferences ?? record.sourceReferences,
      expiresAt: input.expiresAt !== undefined ? input.expiresAt : record.expiresAt,
      recommendationStatus: input.recommendationStatus !== undefined ? input.recommendationStatus : record.recommendationStatus,
      status: input.status ?? record.status,
      updatedBy: actor.userId,
      updatedAt: new Date().toISOString(),
    };

    this.records.set(memoryId, updated);
    return updated;
  }

  async archiveRecord(actor: MemoryActor, memoryId: string, input: MemoryArchiveInput): Promise<MemoryRecord> {
    void input;
    return this.updateRecord(actor, memoryId, {
      status: "archived",
      expiresAt: null,
    });
  }

  async verifyRecord(actor: MemoryActor, memoryId: string, input: MemoryVerifyInput): Promise<MemoryRecord> {
    void input;
    const record = await this.updateRecord(actor, memoryId, {
      confidence: "verified",
    });

    const verified: MemoryRecord = {
      ...record,
      verifiedBy: actor.userId,
      verifiedAt: new Date().toISOString(),
    };

    this.records.set(memoryId, verified);
    return verified;
  }

  async recordRecommendationOutcome(actor: MemoryActor, memoryId: string, input: MemoryRecommendationOutcomeInput): Promise<MemoryRecord> {
    return this.updateRecord(actor, memoryId, {
      recommendationStatus: input.status,
    });
  }
}

function matchesQuery(record: MemoryRecord, query: MemoryRetrievalQuery): boolean {
  if (record.companyId !== query.companyId) {
    return false;
  }

  if (!query.includeArchived && record.status === "archived") {
    return false;
  }

  if (!query.includeExpired && record.status === "expired") {
    return false;
  }

  if (!query.includeExpired && record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
    return false;
  }

  if (query.scope) {
    const scopes = Array.isArray(query.scope) ? query.scope : [query.scope];
    if (!scopes.includes(record.scope)) {
      return false;
    }
  }

  if (query.scopeId) {
    const recordScopeId = record.projectId ?? record.customerId ?? record.userId ?? record.taskId ?? record.phaseId ?? record.companyId;
    if (recordScopeId !== query.scopeId) {
      return false;
    }
  }

  if (query.projectId !== undefined && record.projectId !== undefined && record.projectId !== query.projectId) {
    return false;
  }
  if (query.customerId !== undefined && record.customerId !== undefined && record.customerId !== query.customerId) {
    return false;
  }
  if (query.userId !== undefined && record.userId !== undefined && record.userId !== query.userId) {
    return false;
  }
  if (query.taskId !== undefined && record.taskId !== undefined && record.taskId !== query.taskId) {
    return false;
  }
  if (query.phaseId !== undefined && record.phaseId !== undefined && record.phaseId !== query.phaseId) {
    return false;
  }

  if (query.categories && query.categories.length > 0 && !query.categories.includes(record.category)) {
    return false;
  }

  if (query.minImportance && importanceRank(record.importance) < importanceRank(query.minImportance)) {
    return false;
  }

  return true;
}

function importanceRank(value: MemoryRecord["importance"]): number {
  switch (value) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
  }
}
