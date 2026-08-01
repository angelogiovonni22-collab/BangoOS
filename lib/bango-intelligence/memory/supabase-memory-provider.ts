import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { canActorReadMemory } from "./memory-access-policy";
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
import type { MemoryProvider } from "./memory-provider";

type MemoryRow = {
  id: string;
  company_id: string;
  scope: string;
  category: string;
  project_id: string | null;
  customer_id: string | null;
  user_id: string | null;
  task_id: string | null;
  phase_id: string | null;
  title: string;
  summary: string;
  details: unknown;
  importance: string;
  confidence: string;
  status: string;
  recommendation_status: string | null;
  tags: string[];
  source_references: unknown;
  created_by: string | null;
  updated_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  expires_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export class SupabaseMemoryProvider implements MemoryProvider {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async findRecords(query: MemoryRetrievalQuery): Promise<MemoryRecord[]> {
    const db = this.supabase as unknown as SupabaseClient<Record<string, unknown>>;
    let builder = db
      .from("bango_memories")
      .select("*")
      .eq("company_id", query.companyId)
      .order("updated_at", { ascending: false });

    if (query.scope) {
      const scopes = Array.isArray(query.scope) ? query.scope : [query.scope];
      builder = builder.in("scope", scopes);
    }

    if (query.projectId) builder = builder.eq("project_id", query.projectId);
    if (query.customerId) builder = builder.eq("customer_id", query.customerId);
    if (query.userId) builder = builder.eq("user_id", query.userId);
    if (query.taskId) builder = builder.eq("task_id", query.taskId);
    if (query.phaseId) builder = builder.eq("phase_id", query.phaseId);

    if (query.categories && query.categories.length > 0) {
      builder = builder.in("category", query.categories);
    }

    if (!query.includeArchived) {
      builder = builder.neq("status", "archived").is("archived_at", null);
    }

    if (!query.includeExpired) {
      builder = builder.or("expires_at.is.null,expires_at.gt.now()")
        .neq("status", "expired");
    }

    const limit = query.maxResults ?? 50;
    const { data, error } = await builder.limit(limit);
    if (error) {
      throw new Error(`Memory retrieval failed: ${error.message}`);
    }

    const records = (data as unknown as MemoryRow[]).map(mapRowToRecord);
    if (!query.roleId) {
      return records;
    }

    const actor: Pick<MemoryActor, "companyRole" | "allowedCapabilities"> = {
      companyRole: query.roleId,
      allowedCapabilities: query.allowedCapabilities ?? [],
    };

    return records.filter((record) => canActorReadMemory(actor, record));
  }

  async findRecordById(companyId: string, memoryId: string): Promise<MemoryRecord | null> {
    const db = this.supabase as unknown as SupabaseClient<Record<string, unknown>>;
    const { data, error } = await db
      .from("bango_memories")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", memoryId)
      .maybeSingle();

    if (error) {
      throw new Error(`Memory lookup failed: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapRowToRecord(data as unknown as MemoryRow);
  }

  async createRecord(actor: MemoryActor, input: MemoryCreateInput): Promise<MemoryWriteResult> {
    const db = this.supabase as unknown as SupabaseClient<Record<string, unknown>>;
    const payload = {
      company_id: actor.companyId,
      scope: input.scope,
      category: input.category,
      project_id: input.projectId ?? null,
      customer_id: input.customerId ?? null,
      user_id: input.userId ?? null,
      task_id: input.taskId ?? null,
      phase_id: input.phaseId ?? null,
      title: input.title,
      summary: input.summary,
      details: input.details,
      importance: input.importance,
      confidence: input.confidence,
      recommendation_status: input.recommendationStatus ?? null,
      source_references: input.sourceReferences,
      tags: input.tags,
      created_by: actor.userId,
      updated_by: actor.userId,
      expires_at: input.expiresAt ?? null,
    };

    const { data, error } = await (db
      .from("bango_memories") as unknown as {
        insert: (values: unknown) => {
          select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      })
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Memory create failed: ${error.message}`);
    }

    return {
      record: mapRowToRecord(data as unknown as MemoryRow),
      deduplicationOutcome: "created_new",
    };
  }

  async updateRecord(actor: MemoryActor, memoryId: string, input: MemoryUpdateInput): Promise<MemoryRecord> {
    const db = this.supabase as unknown as SupabaseClient<Record<string, unknown>>;
    const payload = {
      title: input.title,
      summary: input.summary,
      details: input.details,
      importance: input.importance,
      confidence: input.confidence,
      status: input.status,
      recommendation_status: input.recommendationStatus,
      source_references: input.sourceReferences,
      tags: input.tags,
      expires_at: input.expiresAt,
      updated_by: actor.userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (db
      .from("bango_memories") as unknown as {
        update: (values: unknown) => {
          eq: (column: string, value: unknown) => {
            eq: (column: string, value: unknown) => {
              select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
            };
          };
        };
      })
      .update(payload)
      .eq("company_id", actor.companyId)
      .eq("id", memoryId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Memory update failed: ${error.message}`);
    }

    return mapRowToRecord(data as unknown as MemoryRow);
  }

  async archiveRecord(actor: MemoryActor, memoryId: string, input: MemoryArchiveInput): Promise<MemoryRecord> {
    void input;
    const db = this.supabase as unknown as SupabaseClient<Record<string, unknown>>;
    const { data, error } = await (db
      .from("bango_memories") as unknown as {
        update: (values: unknown) => {
          eq: (column: string, value: unknown) => {
            eq: (column: string, value: unknown) => {
              select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
            };
          };
        };
      })
      .update({
        status: "archived",
        archived_at: new Date().toISOString(),
        updated_by: actor.userId,
      })
      .eq("company_id", actor.companyId)
      .eq("id", memoryId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Memory archive failed: ${error.message}`);
    }

    return mapRowToRecord(data as unknown as MemoryRow);
  }

  async verifyRecord(actor: MemoryActor, memoryId: string, input: MemoryVerifyInput): Promise<MemoryRecord> {
    void input;
    const db = this.supabase as unknown as SupabaseClient<Record<string, unknown>>;
    const { data, error } = await (db
      .from("bango_memories") as unknown as {
        update: (values: unknown) => {
          eq: (column: string, value: unknown) => {
            eq: (column: string, value: unknown) => {
              select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
            };
          };
        };
      })
      .update({
        confidence: "verified",
        verified_by: actor.userId,
        verified_at: new Date().toISOString(),
        updated_by: actor.userId,
      })
      .eq("company_id", actor.companyId)
      .eq("id", memoryId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Memory verify failed: ${error.message}`);
    }

    return mapRowToRecord(data as unknown as MemoryRow);
  }

  async recordRecommendationOutcome(actor: MemoryActor, memoryId: string, input: MemoryRecommendationOutcomeInput): Promise<MemoryRecord> {
    const db = this.supabase as unknown as SupabaseClient<Record<string, unknown>>;
    const { data, error } = await (db
      .from("bango_memories") as unknown as {
        update: (values: unknown) => {
          eq: (column: string, value: unknown) => {
            eq: (column: string, value: unknown) => {
              select: (columns: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
            };
          };
        };
      })
      .update({
        recommendation_status: input.status,
        updated_by: actor.userId,
      })
      .eq("company_id", actor.companyId)
      .eq("id", memoryId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Recommendation outcome update failed: ${error.message}`);
    }

    return mapRowToRecord(data as unknown as MemoryRow);
  }
}

function mapRowToRecord(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    scope: row.scope as MemoryRecord["scope"],
    category: row.category as MemoryRecord["category"],
    projectId: row.project_id,
    customerId: row.customer_id,
    userId: row.user_id,
    taskId: row.task_id,
    phaseId: row.phase_id,
    title: row.title,
    summary: row.summary,
    details: (row.details ?? {}) as MemoryRecord["details"],
    importance: row.importance as MemoryRecord["importance"],
    confidence: row.confidence as MemoryRecord["confidence"],
    recommendationStatus: row.recommendation_status as MemoryRecord["recommendationStatus"],
    createdBy: row.created_by ?? "",
    updatedBy: row.updated_by,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceReferences: Array.isArray(row.source_references) ? (row.source_references as MemoryRecord["sourceReferences"]) : [],
    tags: row.tags ?? [],
    status: row.status as MemoryRecord["status"],
    expiresAt: row.expires_at,
    archivedAt: row.archived_at,
    roleRestrictions: [],
  };
}
