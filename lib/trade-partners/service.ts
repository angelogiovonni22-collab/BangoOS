import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import {
  canTransitionAssignmentStatus,
  validateCreateTradePartnerAssignmentInput,
  validateUpdateTradePartnerAssignmentInput,
} from "./validation";
import type {
  CreateTradePartnerAssignmentInput,
  TradePartnerAssignment,
  TradePartnerAssignmentListFilters,
  TradePartnerAssignmentRow,
  TradePartnerAssignmentStatus,
  UpdateTradePartnerAssignmentInput,
} from "./types";

type TradePartnerAssignmentInsert = Database["public"]["Tables"]["trade_partner_assignments"]["Insert"];
type TradePartnerAssignmentUpdate = Database["public"]["Tables"]["trade_partner_assignments"]["Update"];

type WorkspaceContext = NonNullable<Awaited<ReturnType<typeof resolveWorkspaceContext>>["context"]>;

type TradePartnerAssignmentsRepository = {
  listByProject: (companyId: string, projectId: string, assignmentStatus?: TradePartnerAssignmentStatus | "all") => Promise<{ data: TradePartnerAssignmentRow[]; error: string | null }>;
  getById: (companyId: string, assignmentId: string) => Promise<{ data: TradePartnerAssignmentRow | null; error: string | null }>;
  projectExists: (companyId: string, projectId: string) => Promise<{ exists: boolean; error: string | null }>;
  vendorExists: (companyId: string, vendorId: string) => Promise<{ exists: boolean; error: string | null }>;
  findActiveDuplicate: (companyId: string, projectId: string, vendorId: string, excludeId?: string) => Promise<{ data: TradePartnerAssignmentRow | null; error: string | null }>;
  create: (payload: TradePartnerAssignmentInsert) => Promise<{ data: TradePartnerAssignmentRow | null; error: string | null }>;
  update: (companyId: string, assignmentId: string, payload: TradePartnerAssignmentUpdate) => Promise<{ data: TradePartnerAssignmentRow | null; error: string | null }>;
};

type TradePartnerAssignmentsServiceDeps = {
  supabaseClient?: ReturnType<typeof createClient>;
  resolveWorkspace?: typeof resolveWorkspaceContext;
  repository?: TradePartnerAssignmentsRepository;
  now?: () => string;
};

export class TradePartnerAssignmentsError extends Error {
  readonly code: "VALIDATION" | "CONTEXT" | "NOT_FOUND" | "CONFLICT" | "PERSISTENCE";
  readonly details: Record<string, unknown>;

  constructor(
    code: TradePartnerAssignmentsError["code"],
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "TradePartnerAssignmentsError";
    this.code = code;
    this.details = details;
  }
}

export type TradePartnerAssignmentsService = {
  listProjectTradePartnerAssignments: (filters: TradePartnerAssignmentListFilters) => Promise<TradePartnerAssignment[]>;
  getTradePartnerAssignment: (assignmentId: string) => Promise<TradePartnerAssignment | null>;
  createTradePartnerAssignment: (input: CreateTradePartnerAssignmentInput) => Promise<TradePartnerAssignment>;
  updateTradePartnerAssignment: (assignmentId: string, input: UpdateTradePartnerAssignmentInput) => Promise<TradePartnerAssignment>;
  changeTradePartnerAssignmentStatus: (assignmentId: string, nextStatus: TradePartnerAssignmentStatus) => Promise<TradePartnerAssignment>;
  archiveTradePartnerAssignment: (assignmentId: string) => Promise<TradePartnerAssignment>;
};

function mapAssignment(row: TradePartnerAssignmentRow): TradePartnerAssignment {
  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    vendorId: row.vendor_id,
    tradeName: row.trade_name,
    scopeOfWork: row.scope_of_work,
    primaryContactName: row.primary_contact_name,
    primaryContactPhone: row.primary_contact_phone,
    primaryContactEmail: row.primary_contact_email,
    contractStatus: row.contract_status as TradePartnerAssignment["contractStatus"],
    contractAmount: row.contract_amount,
    paymentTerms: row.payment_terms,
    retainagePercent: row.retainage_percent,
    startDate: row.start_date,
    targetCompletionDate: row.target_completion_date,
    crewSize: row.crew_size,
    assignmentStatus: row.assignment_status as TradePartnerAssignmentStatus,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createSupabaseRepository(
  supabase: NonNullable<ReturnType<typeof createClient>>,
): TradePartnerAssignmentsRepository {
  return {
    async listByProject(companyId, projectId, assignmentStatus = "all") {
      let query = supabase
        .from("trade_partner_assignments")
        .select("*")
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (assignmentStatus !== "all") {
        query = query.eq("assignment_status", assignmentStatus);
      }

      const { data, error } = await query;
      return {
        data: data ?? [],
        error: error?.message || null,
      };
    },

    async getById(companyId, assignmentId) {
      const { data, error } = await supabase
        .from("trade_partner_assignments")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", assignmentId)
        .maybeSingle<TradePartnerAssignmentRow>();

      return {
        data: data ?? null,
        error: error?.message || null,
      };
    },

    async projectExists(companyId, projectId) {
      const { data, error } = await supabase
        .from("projects")
        .select("id")
        .eq("company_id", companyId)
        .eq("id", projectId)
        .maybeSingle<{ id: string }>();

      return {
        exists: Boolean(data?.id),
        error: error?.message || null,
      };
    },

    async vendorExists(companyId, vendorId) {
      const { data, error } = await supabase
        .from("vendors")
        .select("id")
        .eq("company_id", companyId)
        .eq("id", vendorId)
        .maybeSingle<{ id: string }>();

      return {
        exists: Boolean(data?.id),
        error: error?.message || null,
      };
    },

    async findActiveDuplicate(companyId, projectId, vendorId, excludeId) {
      let query = supabase
        .from("trade_partner_assignments")
        .select("*")
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .eq("vendor_id", vendorId)
        .eq("assignment_status", "active")
        .limit(1);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { data, error } = await query.maybeSingle<TradePartnerAssignmentRow>();
      return {
        data: data ?? null,
        error: error?.message || null,
      };
    },

    async create(payload) {
      const { data, error } = await supabase
        .from("trade_partner_assignments")
        .insert(payload)
        .select("*")
        .maybeSingle<TradePartnerAssignmentRow>();

      return {
        data: data ?? null,
        error: error?.message || null,
      };
    },

    async update(companyId, assignmentId, payload) {
      const { data, error } = await supabase
        .from("trade_partner_assignments")
        .update(payload)
        .eq("company_id", companyId)
        .eq("id", assignmentId)
        .select("*")
        .maybeSingle<TradePartnerAssignmentRow>();

      return {
        data: data ?? null,
        error: error?.message || null,
      };
    },
  };
}

export function createTradePartnerAssignmentsService(deps: TradePartnerAssignmentsServiceDeps = {}): TradePartnerAssignmentsService {
  const supabase = deps.supabaseClient ?? createClient();
  const resolveWorkspace = deps.resolveWorkspace ?? resolveWorkspaceContext;
  const now = deps.now ?? (() => new Date().toISOString());
  const repository = deps.repository ?? (supabase ? createSupabaseRepository(supabase) : null);

  async function resolveContext() {
    const workspace = await resolveWorkspace(supabase);

    if (!workspace.context) {
      throw new TradePartnerAssignmentsError("CONTEXT", workspace.errorMessage || "Unable to resolve workspace context.");
    }

    return workspace.context;
  }

  async function ensureProjectAndVendorScope(context: WorkspaceContext, projectId: string, vendorId: string) {
    if (!repository) {
      throw new TradePartnerAssignmentsError("PERSISTENCE", "Unable to connect to storage.");
    }

    const [projectResult, vendorResult] = await Promise.all([
      repository.projectExists(context.companyId, projectId),
      repository.vendorExists(context.companyId, vendorId),
    ]);

    if (projectResult.error) {
      throw new TradePartnerAssignmentsError("PERSISTENCE", projectResult.error);
    }

    if (vendorResult.error) {
      throw new TradePartnerAssignmentsError("PERSISTENCE", vendorResult.error);
    }

    if (!projectResult.exists) {
      throw new TradePartnerAssignmentsError("NOT_FOUND", "Project not found for current company scope.");
    }

    if (!vendorResult.exists) {
      throw new TradePartnerAssignmentsError("NOT_FOUND", "Vendor not found for current company scope.");
    }
  }

  async function ensureNoActiveDuplicate(context: WorkspaceContext, projectId: string, vendorId: string, excludeId?: string) {
    if (!repository) {
      throw new TradePartnerAssignmentsError("PERSISTENCE", "Unable to connect to storage.");
    }

    const duplicateResult = await repository.findActiveDuplicate(context.companyId, projectId, vendorId, excludeId);

    if (duplicateResult.error) {
      throw new TradePartnerAssignmentsError("PERSISTENCE", duplicateResult.error);
    }

    if (duplicateResult.data?.id) {
      throw new TradePartnerAssignmentsError(
        "CONFLICT",
        "An active trade partner assignment already exists for this vendor on the selected project.",
        { duplicateAssignmentId: duplicateResult.data.id },
      );
    }
  }

  async function loadAssignmentOrThrow(context: WorkspaceContext, assignmentId: string) {
    if (!repository) {
      throw new TradePartnerAssignmentsError("PERSISTENCE", "Unable to connect to storage.");
    }

    const result = await repository.getById(context.companyId, assignmentId);

    if (result.error) {
      throw new TradePartnerAssignmentsError("PERSISTENCE", result.error);
    }

    if (!result.data) {
      throw new TradePartnerAssignmentsError("NOT_FOUND", "Trade partner assignment not found.");
    }

    return result.data;
  }

  return {
    async listProjectTradePartnerAssignments(filters) {
      const context = await resolveContext();

      if (!repository) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", "Unable to connect to storage.");
      }

      const projectId = filters.projectId.trim();
      if (!projectId) {
        throw new TradePartnerAssignmentsError("VALIDATION", "projectId is required.");
      }

      const projectResult = await repository.projectExists(context.companyId, projectId);
      if (projectResult.error) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", projectResult.error);
      }

      if (!projectResult.exists) {
        throw new TradePartnerAssignmentsError("NOT_FOUND", "Project not found for current company scope.");
      }

      const result = await repository.listByProject(context.companyId, projectId, filters.assignmentStatus || "all");
      if (result.error) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", result.error);
      }

      return result.data.map(mapAssignment);
    },

    async getTradePartnerAssignment(assignmentId) {
      const context = await resolveContext();

      if (!repository) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", "Unable to connect to storage.");
      }

      const trimmedId = assignmentId.trim();
      if (!trimmedId) {
        throw new TradePartnerAssignmentsError("VALIDATION", "assignmentId is required.");
      }

      const result = await repository.getById(context.companyId, trimmedId);
      if (result.error) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", result.error);
      }

      return result.data ? mapAssignment(result.data) : null;
    },

    async createTradePartnerAssignment(input) {
      const context = await resolveContext();
      const validation = validateCreateTradePartnerAssignmentInput(input);

      if (!validation.ok) {
        throw new TradePartnerAssignmentsError("VALIDATION", validation.errors.join(" "), {
          validationErrors: validation.errors,
        });
      }

      const normalized = validation.normalized;

      await ensureProjectAndVendorScope(context, normalized.projectId, normalized.vendorId);

      if (normalized.assignmentStatus === "active") {
        await ensureNoActiveDuplicate(context, normalized.projectId, normalized.vendorId);
      }

      if (!repository) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", "Unable to connect to storage.");
      }

      const insertPayload: TradePartnerAssignmentInsert = {
        company_id: context.companyId,
        project_id: normalized.projectId,
        vendor_id: normalized.vendorId,
        trade_name: normalized.tradeName,
        scope_of_work: normalized.scopeOfWork || null,
        primary_contact_name: normalized.primaryContactName || null,
        primary_contact_phone: normalized.primaryContactPhone || null,
        primary_contact_email: normalized.primaryContactEmail || null,
        contract_status: normalized.contractStatus || "draft",
        contract_amount: normalized.contractAmount ?? null,
        payment_terms: normalized.paymentTerms || null,
        retainage_percent: normalized.retainagePercent ?? null,
        start_date: normalized.startDate || null,
        target_completion_date: normalized.targetCompletionDate || null,
        crew_size: normalized.crewSize ?? null,
        assignment_status: normalized.assignmentStatus || "active",
        notes: normalized.notes || null,
        created_by: context.userId,
        updated_by: context.userId,
      };

      const result = await repository.create(insertPayload);
      if (result.error || !result.data) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", result.error || "Unable to create trade partner assignment.");
      }

      return mapAssignment(result.data);
    },

    async updateTradePartnerAssignment(assignmentId, input) {
      const context = await resolveContext();
      const trimmedId = assignmentId.trim();

      if (!trimmedId) {
        throw new TradePartnerAssignmentsError("VALIDATION", "assignmentId is required.");
      }

      const validation = validateUpdateTradePartnerAssignmentInput(input);

      if (!validation.ok) {
        throw new TradePartnerAssignmentsError("VALIDATION", validation.errors.join(" "), {
          validationErrors: validation.errors,
        });
      }

      const current = await loadAssignmentOrThrow(context, trimmedId);
      await ensureProjectAndVendorScope(context, current.project_id, current.vendor_id);

      if (!repository) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", "Unable to connect to storage.");
      }

      const normalized = validation.normalized;
      const updatePayload: TradePartnerAssignmentUpdate = {
        updated_at: now(),
        updated_by: context.userId,
      };

      if (normalized.tradeName !== undefined) updatePayload.trade_name = normalized.tradeName;
      if (normalized.scopeOfWork !== undefined) updatePayload.scope_of_work = normalized.scopeOfWork;
      if (normalized.primaryContactName !== undefined) updatePayload.primary_contact_name = normalized.primaryContactName;
      if (normalized.primaryContactPhone !== undefined) updatePayload.primary_contact_phone = normalized.primaryContactPhone;
      if (normalized.primaryContactEmail !== undefined) updatePayload.primary_contact_email = normalized.primaryContactEmail;
      if (normalized.contractStatus !== undefined) updatePayload.contract_status = normalized.contractStatus;
      if (normalized.contractAmount !== undefined) updatePayload.contract_amount = normalized.contractAmount;
      if (normalized.paymentTerms !== undefined) updatePayload.payment_terms = normalized.paymentTerms;
      if (normalized.retainagePercent !== undefined) updatePayload.retainage_percent = normalized.retainagePercent;
      if (normalized.startDate !== undefined) updatePayload.start_date = normalized.startDate;
      if (normalized.targetCompletionDate !== undefined) updatePayload.target_completion_date = normalized.targetCompletionDate;
      if (normalized.crewSize !== undefined) updatePayload.crew_size = normalized.crewSize;
      if (normalized.notes !== undefined) updatePayload.notes = normalized.notes;

      const result = await repository.update(context.companyId, trimmedId, updatePayload);
      if (result.error || !result.data) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", result.error || "Unable to update trade partner assignment.");
      }

      return mapAssignment(result.data);
    },

    async changeTradePartnerAssignmentStatus(assignmentId, nextStatus) {
      const context = await resolveContext();
      const trimmedId = assignmentId.trim();

      if (!trimmedId) {
        throw new TradePartnerAssignmentsError("VALIDATION", "assignmentId is required.");
      }

      const current = await loadAssignmentOrThrow(context, trimmedId);

      const currentStatus = current.assignment_status as TradePartnerAssignmentStatus;
      if (!canTransitionAssignmentStatus(currentStatus, nextStatus)) {
        throw new TradePartnerAssignmentsError(
          "VALIDATION",
          `Cannot transition assignment status from ${currentStatus} to ${nextStatus}.`,
        );
      }

      await ensureProjectAndVendorScope(context, current.project_id, current.vendor_id);

      if (nextStatus === "active") {
        await ensureNoActiveDuplicate(context, current.project_id, current.vendor_id, current.id);
      }

      if (!repository) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", "Unable to connect to storage.");
      }

      const result = await repository.update(context.companyId, trimmedId, {
        assignment_status: nextStatus,
        updated_at: now(),
        updated_by: context.userId,
      });

      if (result.error || !result.data) {
        throw new TradePartnerAssignmentsError("PERSISTENCE", result.error || "Unable to update assignment status.");
      }

      return mapAssignment(result.data);
    },

    async archiveTradePartnerAssignment(assignmentId) {
      return this.changeTradePartnerAssignmentStatus(assignmentId, "archived");
    },
  };
}
