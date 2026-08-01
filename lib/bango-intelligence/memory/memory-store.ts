import { logMemoryAuditEvent } from "./memory-audit";
import { canActorWriteMemory } from "./memory-write-policy";
import { decideMemoryDeduplication } from "./memory-deduplication";
import { validateMemoryCreateInput, validateMemoryUpdateInput } from "./memory-validation";
import { canActorReadMemory, defaultCategoriesForRole } from "./memory-access-policy";
import type {
  MemoryActor,
  MemoryArchiveInput,
  MemoryCategory,
  MemoryCreateInput,
  MemoryProvider,
  MemoryRecommendationOutcomeInput,
  MemoryRecord,
  MemoryRetrievalQuery,
  MemoryUpdateInput,
  MemoryVerifyInput,
  MemoryWriteResult,
} from "./memory-index";

const VERIFY_ALLOWED_ROLES = new Set([
  "owner",
  "administrator",
  "operations_manager",
  "project_manager",
]);

const RECOMMENDATION_OUTCOME_SET = new Set([
  "accepted",
  "rejected",
  "implemented",
  "ignored",
  "expired",
]);

export class MemoryStore {
  constructor(private readonly provider: MemoryProvider) {}

  async list(actor: MemoryActor, query: Omit<MemoryRetrievalQuery, "companyId" | "roleId" | "allowedCapabilities">): Promise<MemoryRecord[]> {
    const startedAt = Date.now();
    try {
      const records = await this.provider.findRecords({
        ...query,
        companyId: actor.companyId,
        roleId: actor.companyRole ?? "employee",
        allowedCapabilities: actor.allowedCapabilities,
        categories: query.categories && query.categories.length > 0
          ? query.categories
          : defaultCategoriesForRole(actor),
      });

      const filtered = records.filter((record) => canActorReadMemory(actor, record));

      logMemoryAuditEvent({
        requestId: actor.requestId,
        userId: actor.userId,
        companyId: actor.companyId,
        operation: "list",
        memoryId: null,
        scope: null,
        category: null,
        source: null,
        success: true,
        validationResult: "pass",
        authorizationResult: "pass",
        deduplicationOutcome: null,
        durationMs: Date.now() - startedAt,
        failureReason: null,
      });

      return filtered;
    } catch (error) {
      logMemoryAuditEvent({
        requestId: actor.requestId,
        userId: actor.userId,
        companyId: actor.companyId,
        operation: "list",
        memoryId: null,
        scope: null,
        category: null,
        source: null,
        success: false,
        validationResult: "pass",
        authorizationResult: "pass",
        deduplicationOutcome: null,
        durationMs: Date.now() - startedAt,
        failureReason: error instanceof Error ? error.message : "unknown_error",
      });
      throw error;
    }
  }

  async retrieve(actor: MemoryActor, memoryId: string): Promise<MemoryRecord | null> {
    const startedAt = Date.now();
    const record = await this.provider.findRecordById(actor.companyId, memoryId);
    if (!record) {
      this.logOperation(actor, "retrieve", null, startedAt, true, "pass", "pass", null, null);
      return null;
    }

    if (!canActorReadMemory(actor, record)) {
      this.logOperation(actor, "retrieve", record, startedAt, false, "pass", "fail", null, "Not authorized to view this memory.");
      throw new Error("Not authorized to view this memory.");
    }

    this.logOperation(actor, "retrieve", record, startedAt, true, "pass", "pass", null, null);
    return record;
  }

  async create(actor: MemoryActor, input: MemoryCreateInput): Promise<MemoryWriteResult> {
    const startedAt = Date.now();

    const validation = validateMemoryCreateInput(input);
    if (!validation.ok) {
      this.logWriteFailure(actor, "create", input, startedAt, validation.error, "fail", "pass", null);
      throw new Error(validation.error);
    }

    const writePermission = canActorWriteMemory(actor, input.source, input.category);
    if (!writePermission.allowed) {
      this.logWriteFailure(actor, "create", input, startedAt, writePermission.reason ?? "not_authorized", "pass", "fail", null);
      throw new Error(writePermission.reason ?? "Not authorized to write memory.");
    }

    const existing = await this.provider.findRecords({
      companyId: actor.companyId,
      scope: input.scope,
      categories: [input.category],
      projectId: input.projectId ?? undefined,
      customerId: input.customerId ?? undefined,
      taskId: input.taskId ?? undefined,
      phaseId: input.phaseId ?? undefined,
      includeArchived: true,
      includeExpired: true,
      maxResults: 50,
    });

    const dedupe = decideMemoryDeduplication(existing, input);
    if (dedupe.outcome === "rejected_exact_duplicate") {
      this.logWriteFailure(actor, "create", input, startedAt, "Exact duplicate memory exists.", "pass", "pass", dedupe.outcome);
      throw new Error("Exact duplicate memory exists.");
    }

    if (dedupe.outcome === "updated_existing" && dedupe.existingRecord) {
      const updated = await this.provider.updateRecord(actor, dedupe.existingRecord.id, {
        title: input.title,
        summary: input.summary,
        details: attachWriteMetadata(input.details, input.source, input.reason),
        importance: input.importance,
        confidence: input.confidence,
        sourceReferences: input.sourceReferences,
        tags: input.tags,
        expiresAt: input.expiresAt ?? null,
        recommendationStatus: input.recommendationStatus ?? null,
      });

      const result: MemoryWriteResult = {
        record: updated,
        deduplicationOutcome: "updated_existing",
      };

      this.logWriteSuccess(actor, "create", result, input, startedAt);
      return result;
    }

    if (dedupe.outcome === "archived_previous_created_new" && dedupe.existingRecord) {
      await this.provider.archiveRecord(actor, dedupe.existingRecord.id, {
        reason: "superseded_by_newer_memory_version",
      });
    }

    const created = await this.provider.createRecord(actor, {
      ...input,
      details: attachWriteMetadata(input.details, input.source, input.reason),
    });

    const result: MemoryWriteResult = {
      ...created,
      deduplicationOutcome: dedupe.outcome === "archived_previous_created_new"
        ? "archived_previous_created_new"
        : created.deduplicationOutcome,
    };

    this.logWriteSuccess(actor, "create", result, input, startedAt);
    return result;
  }

  async update(actor: MemoryActor, memoryId: string, input: MemoryUpdateInput): Promise<MemoryRecord> {
    const startedAt = Date.now();

    const existing = await this.provider.findRecordById(actor.companyId, memoryId);
    if (!existing) {
      this.logOperation(actor, "update", null, startedAt, false, "pass", "fail", null, "Memory not found.");
      throw new Error("Memory not found.");
    }

    if (!canActorReadMemory(actor, existing)) {
      this.logOperation(actor, "update", existing, startedAt, false, "pass", "fail", null, "Not authorized to update this memory.");
      throw new Error("Not authorized to update this memory.");
    }

    const updatePermission = canActorWriteMemory(actor, "user_explicit_save", existing.category);
    if (!updatePermission.allowed) {
      this.logOperation(actor, "update", existing, startedAt, false, "pass", "fail", null, updatePermission.reason ?? "Not authorized to update this memory.");
      throw new Error(updatePermission.reason ?? "Not authorized to update this memory.");
    }

    const validation = validateMemoryUpdateInput(input);
    if (!validation.ok) {
      this.logOperation(actor, "update", existing, startedAt, false, "fail", "pass", null, validation.error);
      throw new Error(validation.error);
    }

    const updated = await this.provider.updateRecord(actor, memoryId, input);
    this.logOperation(actor, "update", updated, startedAt, true, "pass", "pass", null, null);
    return updated;
  }

  async archive(actor: MemoryActor, memoryId: string, input: MemoryArchiveInput): Promise<MemoryRecord> {
    const startedAt = Date.now();

    const existing = await this.provider.findRecordById(actor.companyId, memoryId);
    if (!existing) {
      this.logOperation(actor, "archive", null, startedAt, false, "pass", "fail", null, "Memory not found.");
      throw new Error("Memory not found.");
    }

    const archivePermission = canActorWriteMemory(actor, "user_explicit_save", existing.category);
    if (!archivePermission.allowed) {
      this.logOperation(actor, "archive", existing, startedAt, false, "pass", "fail", null, archivePermission.reason ?? "Not authorized to archive this memory.");
      throw new Error(archivePermission.reason ?? "Not authorized to archive this memory.");
    }

    const archived = await this.provider.archiveRecord(actor, memoryId, input);
    this.logOperation(actor, "archive", archived, startedAt, true, "pass", "pass", null, null);
    return archived;
  }

  async verify(actor: MemoryActor, memoryId: string, input: MemoryVerifyInput): Promise<MemoryRecord> {
    const startedAt = Date.now();
    const existing = await this.provider.findRecordById(actor.companyId, memoryId);
    if (!existing) {
      this.logOperation(actor, "verify", null, startedAt, false, "pass", "fail", null, "Memory not found.");
      throw new Error("Memory not found.");
    }

    const role = actor.companyRole ?? "employee";
    if (!VERIFY_ALLOWED_ROLES.has(role)) {
      this.logOperation(actor, "verify", existing, startedAt, false, "pass", "fail", null, "Role is not allowed to verify memories.");
      throw new Error("Role is not allowed to verify memories.");
    }

    if (!canActorReadMemory(actor, existing)) {
      this.logOperation(actor, "verify", existing, startedAt, false, "pass", "fail", null, "Not authorized to verify this memory.");
      throw new Error("Not authorized to verify this memory.");
    }

    const verified = await this.provider.verifyRecord(actor, memoryId, input);
    this.logOperation(actor, "verify", verified, startedAt, true, "pass", "pass", null, null);
    return verified;
  }

  async recordRecommendationOutcome(
    actor: MemoryActor,
    memoryId: string,
    input: MemoryRecommendationOutcomeInput,
  ): Promise<MemoryRecord> {
    const startedAt = Date.now();
    const existing = await this.provider.findRecordById(actor.companyId, memoryId);
    if (!existing) {
      this.logOperation(actor, "record_recommendation_outcome", null, startedAt, false, "pass", "fail", null, "Memory not found.");
      throw new Error("Memory not found.");
    }

    if (existing.category !== "recommendation") {
      this.logOperation(actor, "record_recommendation_outcome", existing, startedAt, false, "pass", "fail", null, "Only recommendation memories can record outcomes.");
      throw new Error("Only recommendation memories can record outcomes.");
    }

    if (!RECOMMENDATION_OUTCOME_SET.has(input.status)) {
      this.logOperation(actor, "record_recommendation_outcome", existing, startedAt, false, "fail", "pass", null, "Invalid recommendation outcome status.");
      throw new Error("Invalid recommendation outcome status.");
    }

    const writePermission = canActorWriteMemory(actor, "recommendation_outcome", existing.category);
    if (!writePermission.allowed) {
      this.logOperation(actor, "record_recommendation_outcome", existing, startedAt, false, "pass", "fail", null, writePermission.reason ?? "Not authorized to record recommendation outcome.");
      throw new Error(writePermission.reason ?? "Not authorized to record recommendation outcome.");
    }

    const updated = await this.provider.recordRecommendationOutcome(actor, memoryId, input);
    this.logOperation(actor, "record_recommendation_outcome", updated, startedAt, true, "pass", "pass", null, null);
    return updated;
  }

  private logOperation(
    actor: MemoryActor,
    operation: "list" | "retrieve" | "update" | "archive" | "verify" | "record_recommendation_outcome",
    record: MemoryRecord | null,
    startedAt: number,
    success: boolean,
    validationResult: "pass" | "fail",
    authorizationResult: "pass" | "fail",
    source: MemoryCreateInput["source"] | null,
    failureReason: string | null,
  ): void {
    logMemoryAuditEvent({
      requestId: actor.requestId,
      userId: actor.userId,
      companyId: actor.companyId,
      operation,
      memoryId: record?.id ?? null,
      scope: record?.scope ?? null,
      category: (record?.category as MemoryCategory | undefined) ?? null,
      source,
      success,
      validationResult,
      authorizationResult,
      deduplicationOutcome: null,
      durationMs: Date.now() - startedAt,
      failureReason,
    });
  }

  private logWriteSuccess(
    actor: MemoryActor,
    operation: "create",
    result: MemoryWriteResult,
    input: MemoryCreateInput,
    startedAt: number,
  ): void {
    logMemoryAuditEvent({
      requestId: actor.requestId,
      userId: actor.userId,
      companyId: actor.companyId,
      operation,
      memoryId: result.record.id,
      scope: input.scope,
      category: input.category,
      source: input.source,
      success: true,
      validationResult: "pass",
      authorizationResult: "pass",
      deduplicationOutcome: result.deduplicationOutcome,
      durationMs: Date.now() - startedAt,
      failureReason: null,
    });
  }

  private logWriteFailure(
    actor: MemoryActor,
    operation: "create",
    input: MemoryCreateInput,
    startedAt: number,
    reason: string,
    validationResult: "pass" | "fail",
    authorizationResult: "pass" | "fail",
    deduplicationOutcome: MemoryWriteResult["deduplicationOutcome"] | null,
  ): void {
    logMemoryAuditEvent({
      requestId: actor.requestId,
      userId: actor.userId,
      companyId: actor.companyId,
      operation,
      memoryId: null,
      scope: input.scope,
      category: input.category,
      source: input.source,
      success: false,
      validationResult,
      authorizationResult,
      deduplicationOutcome,
      durationMs: Date.now() - startedAt,
      failureReason: reason,
    });
  }
}

function attachWriteMetadata(details: MemoryRecord["details"], source: MemoryCreateInput["source"], reason: string): MemoryRecord["details"] {
  const base = typeof details === "object" && details !== null && !Array.isArray(details)
    ? details
    : { value: details };

  return {
    ...base,
    source,
    reason,
  };
}
