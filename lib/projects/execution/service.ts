import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import type { Database } from "@/types/database.types";

type LooseDb = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type ActorContext = {
  companyId: string;
  actorProfileId: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
};

type InspectionStatus = "draft" | "scheduled" | "in_progress" | "passed" | "failed" | "cancelled" | "reinspection_required";
type PermitStatus = "required" | "preparing" | "submitted" | "under_review" | "approved" | "issued" | "rejected" | "expired" | "renewal_required" | "closed" | "not_required" | "cancelled";

type CloseoutChecklistItem = {
  key: string;
  title: string;
  category: string;
  required: boolean;
};

type CloseoutException = {
  blockerKey: string;
  reason: string;
};

const CLOSEOUT_CHECKLIST: CloseoutChecklistItem[] = [
  { key: "work_complete", title: "Work complete", category: "work_complete", required: true },
  { key: "punch_items_complete", title: "Punch items complete", category: "punch_items", required: true },
  { key: "final_inspection_passed", title: "Final inspection passed", category: "inspection", required: true },
  { key: "required_permits_closed", title: "Required permits closed", category: "permit", required: true },
  { key: "change_orders_resolved", title: "Change orders resolved", category: "change_orders", required: true },
  { key: "invoices_issued", title: "Invoices issued", category: "invoices", required: true },
  { key: "final_balance_paid", title: "Final balance paid", category: "payment", required: true },
  { key: "customer_handover_completed", title: "Customer handover completed", category: "handover", required: true },
  { key: "warranty_information_provided", title: "Warranty information provided", category: "warranty", required: true },
  { key: "project_documents_complete", title: "Project documents complete", category: "documents", required: true },
  { key: "equipment_returned", title: "Equipment returned", category: "equipment", required: true },
  { key: "crew_assignments_ended", title: "Crew assignments ended", category: "crew", required: true },
];

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function parseInspectionStatus(value: unknown): InspectionStatus {
  const status = asString(value) as InspectionStatus | null;
  if (!status) {
    return "draft";
  }

  return status;
}

function parsePermitStatus(value: unknown): PermitStatus {
  const status = asString(value) as PermitStatus | null;
  if (!status) {
    return "required";
  }

  return status;
}

function isInspectionTransitionAllowed(current: InspectionStatus, next: InspectionStatus) {
  const transitions: Record<InspectionStatus, InspectionStatus[]> = {
    draft: ["draft", "scheduled", "cancelled"],
    scheduled: ["scheduled", "in_progress", "cancelled", "rescheduled", "reinspection_required"] as unknown as InspectionStatus[],
    in_progress: ["in_progress", "passed", "failed", "cancelled", "reinspection_required"],
    passed: ["passed"],
    failed: ["failed", "reinspection_required", "cancelled"],
    cancelled: ["cancelled"],
    reinspection_required: ["reinspection_required", "scheduled", "in_progress", "passed", "failed", "cancelled"],
  };

  return transitions[current]?.includes(next) || false;
}

function isPermitTransitionAllowed(current: PermitStatus, next: PermitStatus) {
  const transitions: Record<PermitStatus, PermitStatus[]> = {
    required: ["required", "preparing", "submitted", "not_required", "cancelled"],
    preparing: ["preparing", "submitted", "cancelled", "not_required"],
    submitted: ["submitted", "under_review", "approved", "rejected", "cancelled"],
    under_review: ["under_review", "approved", "rejected", "cancelled"],
    approved: ["approved", "issued", "closed", "cancelled"],
    issued: ["issued", "expired", "renewal_required", "closed", "cancelled"],
    rejected: ["rejected", "preparing", "submitted", "cancelled", "not_required"],
    expired: ["expired", "renewal_required", "closed"],
    renewal_required: ["renewal_required", "preparing", "submitted", "approved", "issued", "closed"],
    closed: ["closed"],
    not_required: ["not_required"],
    cancelled: ["cancelled"],
  };

  return transitions[current]?.includes(next) || false;
}

export function createProjectExecutionService(supabase: SupabaseClient<Database>) {
  const db = supabase as unknown as LooseDb;
  const publisher = createSupabaseOrionEventPublisher(supabase);

  async function ensureProjectScope(companyId: string, projectId: string) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, company_id, customer_id, status, name")
      .eq("company_id", companyId)
      .eq("id", projectId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("Project not found for company scope.");
    }

    return data;
  }

  async function ensureCloseoutRecord(input: ActorContext & { projectId: string }) {
    const existing = await db
      .from("project_closeouts")
      .select("id, status, handover_status, required_documents_completed, permit_closure_completed, equipment_return_completed, crew_removal_completed, final_payment_recorded, customer_approval_recorded, authorized_exceptions")
      .eq("company_id", input.companyId)
      .eq("project_id", input.projectId)
      .maybeSingle();

    if (existing.error) {
      throw new Error(existing.error.message || "Unable to load closeout.");
    }

    if (existing.data?.id) {
      return existing.data;
    }

    const inserted = await db
      .from("project_closeouts")
      .insert({
        company_id: input.companyId,
        project_id: input.projectId,
        status: "in_progress",
        started_at: nowIso(),
        created_by: input.actorProfileId,
        updated_by: input.actorProfileId,
        idempotency_key: input.idempotencyKey || null,
      })
      .select("id, status, handover_status, required_documents_completed, permit_closure_completed, equipment_return_completed, crew_removal_completed, final_payment_recorded, customer_approval_recorded, authorized_exceptions")
      .single();

    if (inserted.error || !inserted.data) {
      throw new Error(inserted.error?.message || "Unable to create closeout.");
    }

    await ensureCloseoutChecklist({ ...input, closeoutId: inserted.data.id });

    return inserted.data;
  }

  async function ensureCloseoutChecklist(input: ActorContext & { closeoutId: string }) {
    const existing = await db
      .from("project_closeout_items")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("closeout_id", input.closeoutId)
      .limit(1);

    if (existing.error) {
      throw new Error(existing.error.message || "Unable to load closeout checklist.");
    }

    if ((existing.data || []).length > 0) {
      return;
    }

    const closeout = await db
      .from("project_closeouts")
      .select("project_id")
      .eq("company_id", input.companyId)
      .eq("id", input.closeoutId)
      .maybeSingle();

    if (closeout.error || !closeout.data?.project_id) {
      throw new Error(closeout.error?.message || "Closeout is not available.");
    }

    const rows = CLOSEOUT_CHECKLIST.map((item) => ({
      company_id: input.companyId,
      closeout_id: input.closeoutId,
      project_id: closeout.data.project_id,
      category: item.category,
      item_key: item.key,
      title: item.title,
      required: item.required,
      completed: false,
      created_by: input.actorProfileId,
      updated_by: input.actorProfileId,
    }));

    const inserted = await db.from("project_closeout_items").insert(rows);
    if (inserted.error) {
      throw new Error(inserted.error.message || "Unable to initialize closeout checklist.");
    }
  }

  async function publish(input: ActorContext & {
    eventType: string;
    aggregateType: "inspection" | "permit" | "project" | "punch_item" | "warranty" | "communication";
    aggregateId: string;
    sourceModule: "projects" | "communications";
    payload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    await publisher.publishEvent({
      company_id: input.companyId,
      actor_profile_id: input.actorProfileId,
      event_type: input.eventType as never,
      aggregate_type: input.aggregateType as never,
      aggregate_id: input.aggregateId,
      source_module: input.sourceModule as never,
      correlation_id: input.correlationId || null,
      causation_id: null,
      idempotency_key: input.idempotencyKey || undefined,
      payload: input.payload,
      metadata: input.metadata || {},
    });
  }

  async function getInspection(companyId: string, inspectionId: string) {
    const { data, error } = await db
      .from("project_inspections")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", inspectionId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message || "Inspection not found.");
    }

    return data;
  }

  async function transitionInspection(input: ActorContext & {
    inspectionId: string;
    nextStatus: InspectionStatus;
    eventType: string;
    patch?: Record<string, unknown>;
    summary?: string;
  }) {
    const current = await getInspection(input.companyId, input.inspectionId);
    const currentStatus = parseInspectionStatus(current.status);

    if (!isInspectionTransitionAllowed(currentStatus, input.nextStatus)) {
      throw new Error(`Inspection transition not allowed: ${currentStatus} -> ${input.nextStatus}`);
    }

    const updatedAt = nowIso();
    const updateResult = await db
      .from("project_inspections")
      .update({
        ...input.patch,
        status: input.nextStatus,
        updated_at: updatedAt,
        updated_by: input.actorProfileId,
        idempotency_key: input.idempotencyKey || current.idempotency_key || null,
      })
      .eq("company_id", input.companyId)
      .eq("id", input.inspectionId)
      .select("*")
      .single();

    if (updateResult.error || !updateResult.data) {
      throw new Error(updateResult.error?.message || "Unable to update inspection.");
    }

    await publish({
      companyId: input.companyId,
      actorProfileId: input.actorProfileId,
      correlationId: input.correlationId,
      idempotencyKey: `${input.idempotencyKey || `inspection:${input.inspectionId}`}:${input.eventType}`,
      eventType: input.eventType,
      aggregateType: "inspection",
      aggregateId: input.inspectionId,
      sourceModule: "projects",
      payload: {
        inspection_id: input.inspectionId,
        project_id: current.project_id,
        inspection_type: current.inspection_type,
        status: input.nextStatus,
        result: updateResult.data.result,
        scheduled_at: updateResult.data.scheduled_at,
        inspector_name: updateResult.data.inspector_name,
        correction_notes: updateResult.data.correction_notes,
        reinspection_date: updateResult.data.reinspection_date,
        deep_link: `/projects/${current.project_id}/inspections?inspectionId=${input.inspectionId}`,
        summary: input.summary || null,
      },
      metadata: {
        deep_link: `/projects/${current.project_id}/inspections?inspectionId=${input.inspectionId}`,
      },
    });

    return updateResult.data;
  }

  async function getPermit(companyId: string, permitId: string) {
    const result = await db
      .from("project_permits")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", permitId)
      .maybeSingle();

    if (result.error || !result.data) {
      throw new Error(result.error?.message || "Permit not found.");
    }

    return result.data;
  }

  async function transitionPermit(input: ActorContext & {
    permitId: string;
    nextStatus: PermitStatus;
    eventType: string;
    patch?: Record<string, unknown>;
    summary?: string;
  }) {
    const current = await getPermit(input.companyId, input.permitId);
    const currentStatus = parsePermitStatus(current.status);

    if (!isPermitTransitionAllowed(currentStatus, input.nextStatus)) {
      throw new Error(`Permit transition not allowed: ${currentStatus} -> ${input.nextStatus}`);
    }

    const updateResult = await db
      .from("project_permits")
      .update({
        ...input.patch,
        status: input.nextStatus,
        updated_at: nowIso(),
        updated_by: input.actorProfileId,
        idempotency_key: input.idempotencyKey || current.idempotency_key || null,
      })
      .eq("company_id", input.companyId)
      .eq("id", input.permitId)
      .select("*")
      .single();

    if (updateResult.error || !updateResult.data) {
      throw new Error(updateResult.error?.message || "Unable to update permit.");
    }

    await publish({
      companyId: input.companyId,
      actorProfileId: input.actorProfileId,
      correlationId: input.correlationId,
      idempotencyKey: `${input.idempotencyKey || `permit:${input.permitId}`}:${input.eventType}`,
      eventType: input.eventType,
      aggregateType: "permit",
      aggregateId: input.permitId,
      sourceModule: "projects",
      payload: {
        permit_id: input.permitId,
        project_id: current.project_id,
        permit_type: current.permit_type,
        permit_number: updateResult.data.permit_number,
        status: input.nextStatus,
        expiration_date: updateResult.data.expiration_date,
        rejection_reason: updateResult.data.rejection_reason,
        deep_link: `/projects/${current.project_id}/permits?permitId=${input.permitId}`,
        summary: input.summary || null,
      },
      metadata: {
        deep_link: `/projects/${current.project_id}/permits?permitId=${input.permitId}`,
      },
    });

    return updateResult.data;
  }

  async function closeoutBlockers(input: ActorContext & { projectId: string; closeoutId: string }) {
    const [finalInspectionRes, openPunchRes, openPermitRes, openChangeOrdersRes, unpaidInvoicesRes, activeAssignmentsRes, closeoutRes] = await Promise.all([
      db
        .from("project_inspections")
        .select("id")
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId)
        .eq("status", "passed")
        .order("completed_at", { ascending: false })
        .limit(1),
      db
        .from("project_punch_items")
        .select("id", { count: "exact", head: true })
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId)
        .in("status", ["open", "assigned", "in_progress", "reopened"]),
      db
        .from("project_permits")
        .select("id", { count: "exact", head: true })
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId)
        .in("status", ["required", "preparing", "submitted", "under_review", "approved", "issued", "expired", "renewal_required", "rejected"]),
      db
        .from("change_orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId)
        .in("status", ["draft", "pending_approval", "sent", "needs_revision"]),
      db
        .from("invoices")
        .select("id, total_amount, amount_paid")
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId),
      db
        .from("workforce_assignments")
        .select("id", { count: "exact", head: true })
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId)
        .in("status", ["planned", "confirmed", "in_progress"]),
      db
        .from("project_closeouts")
        .select("id, handover_status, required_documents_completed, final_payment_recorded, permit_closure_completed, equipment_return_completed, crew_removal_completed, customer_approval_recorded")
        .eq("company_id", input.companyId)
        .eq("id", input.closeoutId)
        .maybeSingle(),
    ]);

    const blockers: Array<{ key: string; message: string }> = [];

    if ((finalInspectionRes.data || []).length === 0) {
      blockers.push({ key: "final_inspection_incomplete", message: "Final inspection is not marked passed." });
    }

    if ((openPunchRes.count || 0) > 0) {
      blockers.push({ key: "punch_items_open", message: "Punch items are still open." });
    }

    if ((openPermitRes.count || 0) > 0) {
      blockers.push({ key: "permits_open", message: "Required permits are still open." });
    }

    if ((openChangeOrdersRes.count || 0) > 0) {
      blockers.push({ key: "change_orders_unresolved", message: "Outstanding change orders are unresolved." });
    }

    const unpaid = (unpaidInvoicesRes.data || []).some((row: Record<string, unknown>) => {
      const total = typeof row.total_amount === "number" ? row.total_amount : 0;
      const paid = typeof row.amount_paid === "number" ? row.amount_paid : 0;
      return total - paid > 0.01;
    });

    if (unpaid) {
      blockers.push({ key: "final_invoice_unpaid", message: "Final invoice balance remains unpaid." });
    }

    const closeout = closeoutRes.data;
    if (!closeout || closeout.handover_status !== "completed" || !closeout.customer_approval_recorded) {
      blockers.push({ key: "customer_handover_incomplete", message: "Customer handover is incomplete." });
    }

    if (!closeout?.required_documents_completed) {
      blockers.push({ key: "warranty_information_missing", message: "Required documents and warranty handover are incomplete." });
    }

    if ((activeAssignmentsRes.count || 0) > 0 && !closeout?.crew_removal_completed) {
      blockers.push({ key: "crew_assignments_active", message: "Crew assignments are still active." });
    }

    if (!closeout?.equipment_return_completed) {
      blockers.push({ key: "equipment_return_incomplete", message: "Equipment return is incomplete." });
    }

    return blockers;
  }

  function supportsProvider(channel: string) {
    if (channel === "phone_note" || channel === "in_person_note") {
      return { supported: true, loggedOnly: true, reason: null as string | null };
    }

    if (channel === "email") {
      const provider = process.env.BANGO_EMAIL_PROVIDER;
      const adapter = process.env.BANGO_EMAIL_ADAPTER;
      if (!provider || !adapter) {
        return { supported: false, loggedOnly: false, reason: "Email provider is not configured." };
      }

      return { supported: true, loggedOnly: false, reason: null as string | null };
    }

    if (channel === "sms") {
      const provider = process.env.BANGO_SMS_PROVIDER;
      const adapter = process.env.BANGO_SMS_ADAPTER;
      if (!provider || !adapter) {
        return { supported: false, loggedOnly: false, reason: "SMS provider is not configured." };
      }

      return { supported: true, loggedOnly: false, reason: null as string | null };
    }

    if (channel === "portal") {
      if (process.env.BANGO_PORTAL_MESSAGING_ENABLED === "true") {
        return { supported: true, loggedOnly: false, reason: null as string | null };
      }

      return { supported: false, loggedOnly: false, reason: "Portal messaging is not configured." };
    }

    if (channel === "system_notification") {
      return { supported: true, loggedOnly: false, reason: null as string | null };
    }

    return { supported: false, loggedOnly: false, reason: "Unsupported delivery channel." };
  }

  return {
    async listInspections(input: ActorContext & { projectId: string }) {
      await ensureProjectScope(input.companyId, input.projectId);
      const result = await db
        .from("project_inspections")
        .select("*")
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId)
        .order("scheduled_at", { ascending: true })
        .order("created_at", { ascending: false });

      if (result.error) {
        throw new Error(result.error.message || "Unable to load inspections.");
      }

      return result.data || [];
    },

    async createInspection(input: ActorContext & {
      projectId: string;
      inspectionType: string;
      jurisdiction?: string | null;
      authority?: string | null;
      inspectorName?: string | null;
      inspectorContact?: string | null;
      scheduledAt?: string | null;
      location?: string | null;
      notes?: string | null;
      attachments?: unknown;
    }) {
      await ensureProjectScope(input.companyId, input.projectId);

      if (input.idempotencyKey) {
        const existing = await db
          .from("project_inspections")
          .select("*")
          .eq("company_id", input.companyId)
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();

        if (existing.data) {
          return existing.data;
        }
      }

      const inspection = await db
        .from("project_inspections")
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          inspection_type: input.inspectionType,
          jurisdiction: input.jurisdiction || null,
          authority: input.authority || null,
          inspector_name: input.inspectorName || null,
          inspector_contact: input.inspectorContact || null,
          scheduled_at: input.scheduledAt || null,
          status: input.scheduledAt ? "scheduled" : "draft",
          location: input.location || null,
          notes: input.notes || null,
          attachments: Array.isArray(input.attachments) ? input.attachments : [],
          created_by: input.actorProfileId,
          updated_by: input.actorProfileId,
          idempotency_key: input.idempotencyKey || null,
        })
        .select("*")
        .single();

      if (inspection.error || !inspection.data) {
        throw new Error(inspection.error?.message || "Unable to create inspection.");
      }

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `inspection:${inspection.data.id}`}:created`,
        eventType: "inspection.created",
        aggregateType: "inspection",
        aggregateId: inspection.data.id,
        sourceModule: "projects",
        payload: {
          inspection_id: inspection.data.id,
          project_id: input.projectId,
          inspection_type: inspection.data.inspection_type,
          status: inspection.data.status,
          schedule_date: inspection.data.scheduled_at,
          inspector_name: inspection.data.inspector_name,
          deep_link: `/projects/${input.projectId}/inspections?inspectionId=${inspection.data.id}`,
        },
      });

      if (inspection.data.status === "scheduled") {
        await publish({
          companyId: input.companyId,
          actorProfileId: input.actorProfileId,
          correlationId: input.correlationId,
          idempotencyKey: `${input.idempotencyKey || `inspection:${inspection.data.id}`}:scheduled`,
          eventType: "inspection.scheduled",
          aggregateType: "inspection",
          aggregateId: inspection.data.id,
          sourceModule: "projects",
          payload: {
            inspection_id: inspection.data.id,
            project_id: input.projectId,
            inspection_type: inspection.data.inspection_type,
            schedule_date: inspection.data.scheduled_at,
            inspector_name: inspection.data.inspector_name,
            deep_link: `/projects/${input.projectId}/inspections?inspectionId=${inspection.data.id}`,
          },
        });
      }

      return inspection.data;
    },

    async updateInspection(input: ActorContext & {
      inspectionId: string;
      patch: Record<string, unknown>;
    }) {
      const current = await getInspection(input.companyId, input.inspectionId);

      const updateResult = await db
        .from("project_inspections")
        .update({
          ...input.patch,
          updated_at: nowIso(),
          updated_by: input.actorProfileId,
          idempotency_key: input.idempotencyKey || current.idempotency_key || null,
        })
        .eq("company_id", input.companyId)
        .eq("id", input.inspectionId)
        .select("*")
        .single();

      if (updateResult.error || !updateResult.data) {
        throw new Error(updateResult.error?.message || "Unable to update inspection.");
      }

      return updateResult.data;
    },

    async scheduleInspection(input: ActorContext & { inspectionId: string; scheduledAt: string }) {
      return transitionInspection({
        ...input,
        nextStatus: "scheduled",
        eventType: "inspection.scheduled",
        patch: { scheduled_at: input.scheduledAt },
      });
    },

    async rescheduleInspection(input: ActorContext & { inspectionId: string; scheduledAt: string }) {
      return transitionInspection({
        ...input,
        nextStatus: "scheduled",
        eventType: "inspection.rescheduled",
        patch: { scheduled_at: input.scheduledAt },
      });
    },

    async startInspection(input: ActorContext & { inspectionId: string }) {
      return transitionInspection({
        ...input,
        nextStatus: "in_progress",
        eventType: "inspection.started",
      });
    },

    async passInspection(input: ActorContext & { inspectionId: string; notes?: string | null }) {
      return transitionInspection({
        ...input,
        nextStatus: "passed",
        eventType: "inspection.passed",
        patch: {
          completed_at: nowIso(),
          result: "passed",
          correction_notes: null,
          reinspection_required: false,
          notes: input.notes || null,
        },
      });
    },

    async failInspection(input: ActorContext & {
      inspectionId: string;
      correctionNotes?: string | null;
      reinspectionRequired?: boolean;
      reinspectionDate?: string | null;
    }) {
      const failed = await transitionInspection({
        ...input,
        nextStatus: "failed",
        eventType: "inspection.failed",
        patch: {
          completed_at: nowIso(),
          result: "failed",
          correction_notes: input.correctionNotes || null,
          reinspection_required: asBool(input.reinspectionRequired, false),
          reinspection_date: input.reinspectionDate || null,
        },
      });

      if (asBool(input.reinspectionRequired, false)) {
        await transitionInspection({
          ...input,
          nextStatus: "reinspection_required",
          eventType: "inspection.reinspection_required",
          patch: {
            reinspection_required: true,
            reinspection_date: input.reinspectionDate || null,
            correction_notes: input.correctionNotes || null,
          },
        });
      }

      return failed;
    },

    async cancelInspection(input: ActorContext & { inspectionId: string; notes?: string | null }) {
      return transitionInspection({
        ...input,
        nextStatus: "cancelled",
        eventType: "inspection.cancelled",
        patch: {
          result: "cancelled",
          notes: input.notes || null,
        },
      });
    },

    async scheduleReinspection(input: ActorContext & { inspectionId: string; reinspectionDate: string }) {
      return transitionInspection({
        ...input,
        nextStatus: "reinspection_required",
        eventType: "inspection.reinspection_required",
        patch: {
          reinspection_required: true,
          reinspection_date: input.reinspectionDate,
          status: "reinspection_required",
        },
      });
    },

    async listInspectionHistory(input: ActorContext & { inspectionId: string }) {
      const inspection = await getInspection(input.companyId, input.inspectionId);
      const events = await db
        .from("workflow_events")
        .select("id, event_type, occurred_at, payload, metadata")
        .eq("company_id", input.companyId)
        .eq("reference_entity", "inspection")
        .eq("reference_id", input.inspectionId)
        .order("occurred_at", { ascending: false });

      if (events.error) {
        throw new Error(events.error.message || "Unable to load inspection history.");
      }

      return {
        inspection,
        events: events.data || [],
      };
    },

    async listPermits(input: ActorContext & { projectId: string }) {
      await ensureProjectScope(input.companyId, input.projectId);
      const result = await db
        .from("project_permits")
        .select("*")
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId)
        .order("expiration_date", { ascending: true })
        .order("created_at", { ascending: false });

      if (result.error) {
        throw new Error(result.error.message || "Unable to load permits.");
      }

      return result.data || [];
    },

    async createPermit(input: ActorContext & {
      projectId: string;
      permitType: string;
      permitNumber?: string | null;
      issuingAuthority?: string | null;
      jurisdiction?: string | null;
      applicationDate?: string | null;
      responsibleParty?: string | null;
      notes?: string | null;
    }) {
      await ensureProjectScope(input.companyId, input.projectId);

      if (input.idempotencyKey) {
        const existing = await db
          .from("project_permits")
          .select("*")
          .eq("company_id", input.companyId)
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();

        if (existing.data) {
          return existing.data;
        }
      }

      const created = await db
        .from("project_permits")
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          permit_type: input.permitType,
          permit_number: input.permitNumber || null,
          issuing_authority: input.issuingAuthority || null,
          jurisdiction: input.jurisdiction || null,
          application_date: input.applicationDate || null,
          status: "required",
          responsible_party: input.responsibleParty || null,
          notes: input.notes || null,
          created_by: input.actorProfileId,
          updated_by: input.actorProfileId,
          idempotency_key: input.idempotencyKey || null,
        })
        .select("*")
        .single();

      if (created.error || !created.data) {
        throw new Error(created.error?.message || "Unable to create permit.");
      }

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `permit:${created.data.id}`}:created`,
        eventType: "permit.created",
        aggregateType: "permit",
        aggregateId: created.data.id,
        sourceModule: "projects",
        payload: {
          permit_id: created.data.id,
          project_id: input.projectId,
          permit_type: created.data.permit_type,
          status: created.data.status,
          deep_link: `/projects/${input.projectId}/permits?permitId=${created.data.id}`,
        },
      });

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `permit:${created.data.id}`}:required`,
        eventType: "permit.required",
        aggregateType: "permit",
        aggregateId: created.data.id,
        sourceModule: "projects",
        payload: {
          permit_id: created.data.id,
          project_id: input.projectId,
          permit_type: created.data.permit_type,
          status: "required",
          deep_link: `/projects/${input.projectId}/permits?permitId=${created.data.id}`,
        },
      });

      return created.data;
    },

    async markPermitNotRequired(input: ActorContext & { permitId: string; notes?: string | null }) {
      return transitionPermit({
        ...input,
        nextStatus: "not_required",
        eventType: "permit.not_required",
        patch: {
          notes: input.notes || null,
        },
      });
    },

    async submitPermit(input: ActorContext & { permitId: string; submittedAt?: string | null; notes?: string | null }) {
      return transitionPermit({
        ...input,
        nextStatus: "submitted",
        eventType: "permit.submitted",
        patch: {
          submitted_at: input.submittedAt || nowIso(),
          notes: input.notes || null,
        },
      });
    },

    async approvePermit(input: ActorContext & { permitId: string; approvedAt?: string | null }) {
      return transitionPermit({
        ...input,
        nextStatus: "approved",
        eventType: "permit.approved",
        patch: {
          approved_at: input.approvedAt || nowIso(),
        },
      });
    },

    async issuePermit(input: ActorContext & { permitId: string; issuedAt?: string | null; expirationDate?: string | null }) {
      return transitionPermit({
        ...input,
        nextStatus: "issued",
        eventType: "permit.issued",
        patch: {
          issued_at: input.issuedAt || nowIso(),
          expiration_date: input.expirationDate || null,
        },
      });
    },

    async rejectPermit(input: ActorContext & { permitId: string; reason: string }) {
      return transitionPermit({
        ...input,
        nextStatus: "rejected",
        eventType: "permit.rejected",
        patch: {
          rejection_reason: input.reason,
        },
      });
    },

    async expirePermit(input: ActorContext & { permitId: string }) {
      return transitionPermit({
        ...input,
        nextStatus: "expired",
        eventType: "permit.expired",
      });
    },

    async markPermitRenewalRequired(input: ActorContext & { permitId: string; notes?: string | null }) {
      return transitionPermit({
        ...input,
        nextStatus: "renewal_required",
        eventType: "permit.renewal_required",
        patch: {
          renewal_required: true,
          notes: input.notes || null,
        },
      });
    },

    async renewPermit(input: ActorContext & { permitId: string; expirationDate?: string | null; notes?: string | null }) {
      const updated = await transitionPermit({
        ...input,
        nextStatus: "issued",
        eventType: "permit.renewed",
        patch: {
          renewal_required: false,
          expiration_date: input.expirationDate || null,
          notes: input.notes || null,
        },
      });

      return updated;
    },

    async closePermit(input: ActorContext & { permitId: string }) {
      return transitionPermit({
        ...input,
        nextStatus: "closed",
        eventType: "permit.closed",
        patch: {
          closed_at: nowIso(),
        },
      });
    },

    async listPermitHistory(input: ActorContext & { permitId: string }) {
      const permit = await getPermit(input.companyId, input.permitId);
      const events = await db
        .from("workflow_events")
        .select("id, event_type, occurred_at, payload, metadata")
        .eq("company_id", input.companyId)
        .eq("reference_entity", "permit")
        .eq("reference_id", input.permitId)
        .order("occurred_at", { ascending: false });

      if (events.error) {
        throw new Error(events.error.message || "Unable to load permit history.");
      }

      return {
        permit,
        events: events.data || [],
      };
    },

    async startCloseout(input: ActorContext & { projectId: string; notes?: string | null }) {
      await ensureProjectScope(input.companyId, input.projectId);
      const closeout = await ensureCloseoutRecord(input);

      await db
        .from("project_closeouts")
        .update({
          status: "in_progress",
          closeout_notes: input.notes || null,
          updated_by: input.actorProfileId,
          updated_at: nowIso(),
          idempotency_key: input.idempotencyKey || null,
        })
        .eq("company_id", input.companyId)
        .eq("id", closeout.id);

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `closeout:${closeout.id}`}:started`,
        eventType: "project.closeout_started",
        aggregateType: "project",
        aggregateId: input.projectId,
        sourceModule: "projects",
        payload: {
          closeout_id: closeout.id,
          project_id: input.projectId,
          deep_link: `/projects/${input.projectId}/closeout`,
        },
      });

      return closeout;
    },

    async createPunchItem(input: ActorContext & {
      projectId: string;
      title: string;
      description?: string | null;
      location?: string | null;
      priority?: string | null;
      dueDate?: string | null;
      assignedProfileId?: string | null;
    }) {
      await ensureProjectScope(input.companyId, input.projectId);
      const closeout = await ensureCloseoutRecord(input);

      const created = await db
        .from("project_punch_items")
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          closeout_id: closeout.id,
          title: input.title,
          description: input.description || null,
          location: input.location || null,
          priority: input.priority || "medium",
          due_date: input.dueDate || null,
          assigned_profile_id: input.assignedProfileId || null,
          status: input.assignedProfileId ? "assigned" : "open",
          created_by: input.actorProfileId,
          updated_by: input.actorProfileId,
          idempotency_key: input.idempotencyKey || null,
        })
        .select("*")
        .single();

      if (created.error || !created.data) {
        throw new Error(created.error?.message || "Unable to create punch item.");
      }

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `punch:${created.data.id}`}:created`,
        eventType: "punch_item.created",
        aggregateType: "punch_item",
        aggregateId: created.data.id,
        sourceModule: "projects",
        payload: {
          project_id: input.projectId,
          closeout_id: closeout.id,
          punch_item_id: created.data.id,
          title: created.data.title,
          status: created.data.status,
          deep_link: `/projects/${input.projectId}/closeout?punchItemId=${created.data.id}`,
        },
      });

      return created.data;
    },

    async assignPunchItem(input: ActorContext & { punchItemId: string; assignedProfileId: string }) {
      const updated = await db
        .from("project_punch_items")
        .update({
          assigned_profile_id: input.assignedProfileId,
          status: "assigned",
          updated_at: nowIso(),
          updated_by: input.actorProfileId,
        })
        .eq("company_id", input.companyId)
        .eq("id", input.punchItemId)
        .select("*")
        .single();

      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message || "Unable to assign punch item.");
      }

      return updated.data;
    },

    async completePunchItem(input: ActorContext & { punchItemId: string }) {
      const updated = await db
        .from("project_punch_items")
        .update({
          status: "completed",
          completed_at: nowIso(),
          updated_at: nowIso(),
          updated_by: input.actorProfileId,
        })
        .eq("company_id", input.companyId)
        .eq("id", input.punchItemId)
        .select("*")
        .single();

      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message || "Unable to complete punch item.");
      }

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `punch:${updated.data.id}`}:completed`,
        eventType: "punch_item.completed",
        aggregateType: "punch_item",
        aggregateId: updated.data.id,
        sourceModule: "projects",
        payload: {
          project_id: updated.data.project_id,
          punch_item_id: updated.data.id,
          title: updated.data.title,
          deep_link: `/projects/${updated.data.project_id}/closeout?punchItemId=${updated.data.id}`,
        },
      });

      return updated.data;
    },

    async reopenPunchItem(input: ActorContext & { punchItemId: string; notes?: string | null }) {
      const updated = await db
        .from("project_punch_items")
        .update({
          status: "reopened",
          reopened_at: nowIso(),
          notes: input.notes || null,
          updated_at: nowIso(),
          updated_by: input.actorProfileId,
        })
        .eq("company_id", input.companyId)
        .eq("id", input.punchItemId)
        .select("*")
        .single();

      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message || "Unable to reopen punch item.");
      }

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `punch:${updated.data.id}`}:reopened`,
        eventType: "punch_item.reopened",
        aggregateType: "punch_item",
        aggregateId: updated.data.id,
        sourceModule: "projects",
        payload: {
          project_id: updated.data.project_id,
          punch_item_id: updated.data.id,
          title: updated.data.title,
          notes: input.notes || null,
          deep_link: `/projects/${updated.data.project_id}/closeout?punchItemId=${updated.data.id}`,
        },
      });

      return updated.data;
    },

    async recordWalkthrough(input: ActorContext & { projectId: string; notes?: string | null }) {
      const closeout = await ensureCloseoutRecord(input);

      const updated = await db
        .from("project_closeouts")
        .update({
          handover_status: "walkthrough_completed",
          customer_approval_recorded: true,
          closeout_notes: input.notes || null,
          updated_at: nowIso(),
          updated_by: input.actorProfileId,
        })
        .eq("company_id", input.companyId)
        .eq("id", closeout.id)
        .select("*")
        .single();

      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message || "Unable to record walkthrough.");
      }

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `closeout:${updated.data.id}`}:walkthrough`,
        eventType: "project.walkthrough_completed",
        aggregateType: "project",
        aggregateId: input.projectId,
        sourceModule: "projects",
        payload: {
          closeout_id: updated.data.id,
          project_id: input.projectId,
          deep_link: `/projects/${input.projectId}/closeout`,
          notes: input.notes || null,
        },
      });

      return updated.data;
    },

    async completeHandover(input: ActorContext & { projectId: string; notes?: string | null }) {
      const closeout = await ensureCloseoutRecord(input);

      const updated = await db
        .from("project_closeouts")
        .update({
          handover_status: "completed",
          customer_approval_recorded: true,
          closeout_notes: input.notes || null,
          updated_at: nowIso(),
          updated_by: input.actorProfileId,
        })
        .eq("company_id", input.companyId)
        .eq("id", closeout.id)
        .select("*")
        .single();

      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message || "Unable to complete handover.");
      }

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `closeout:${updated.data.id}`}:handover`,
        eventType: "project.handover_completed",
        aggregateType: "project",
        aggregateId: input.projectId,
        sourceModule: "projects",
        payload: {
          closeout_id: updated.data.id,
          project_id: input.projectId,
          deep_link: `/projects/${input.projectId}/closeout`,
          notes: input.notes || null,
        },
      });

      return updated.data;
    },

    async completeProject(input: ActorContext & {
      projectId: string;
      exceptions?: CloseoutException[];
      notes?: string | null;
      startWarranty?: boolean;
      warrantyEndsAt?: string | null;
    }) {
      const project = await ensureProjectScope(input.companyId, input.projectId);
      const closeout = await ensureCloseoutRecord(input);
      const blockers = await closeoutBlockers({ ...input, closeoutId: closeout.id });
      const exceptions = (input.exceptions || []).filter((entry) => asString(entry.blockerKey) && asString(entry.reason));

      const acceptedExceptionKeys = new Set(exceptions.map((entry) => entry.blockerKey));
      const unresolved = blockers.filter((blocker) => !acceptedExceptionKeys.has(blocker.key));

      if (unresolved.length > 0) {
        await db
          .from("project_closeouts")
          .update({
            status: "blocked",
            completion_blockers: unresolved,
            updated_at: nowIso(),
            updated_by: input.actorProfileId,
          })
          .eq("company_id", input.companyId)
          .eq("id", closeout.id);

        await publish({
          companyId: input.companyId,
          actorProfileId: input.actorProfileId,
          correlationId: input.correlationId,
          idempotencyKey: `${input.idempotencyKey || `closeout:${closeout.id}`}:blocked`,
          eventType: "project.closeout_blocked",
          aggregateType: "project",
          aggregateId: input.projectId,
          sourceModule: "projects",
          payload: {
            closeout_id: closeout.id,
            project_id: input.projectId,
            blockers: unresolved,
            deep_link: `/projects/${input.projectId}/closeout`,
          },
        });

        return {
          ok: false,
          blockers: unresolved,
          deepLink: `/projects/${input.projectId}/closeout`,
          message: "Closeout blockers must be resolved before project completion.",
        };
      }

      const authorizedExceptions = exceptions.map((entry) => ({
        blocker_key: entry.blockerKey,
        reason: entry.reason,
        actor_profile_id: input.actorProfileId,
        recorded_at: nowIso(),
      }));

      const completedAt = nowIso();

      const closeoutUpdate = await db
        .from("project_closeouts")
        .update({
          status: "completed",
          completion_date: completedAt,
          completion_blockers: [],
          authorized_exceptions: authorizedExceptions,
          closeout_notes: input.notes || null,
          completed_by: input.actorProfileId,
          updated_by: input.actorProfileId,
          updated_at: completedAt,
          final_payment_recorded: true,
          permit_closure_completed: true,
          crew_removal_completed: true,
          equipment_return_completed: true,
          required_documents_completed: true,
        })
        .eq("company_id", input.companyId)
        .eq("id", closeout.id)
        .select("*")
        .single();

      if (closeoutUpdate.error || !closeoutUpdate.data) {
        throw new Error(closeoutUpdate.error?.message || "Unable to complete closeout.");
      }

      await db
        .from("workforce_assignments")
        .update({
          status: "completed",
          ends_at: completedAt,
          updated_by: input.actorProfileId,
          updated_at: completedAt,
        })
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId)
        .in("status", ["planned", "confirmed", "in_progress"]);

      await supabase
        .from("projects")
        .update({
          status: "completed",
          actual_end_date: completedAt.slice(0, 10),
          updated_at: completedAt,
        })
        .eq("company_id", input.companyId)
        .eq("id", input.projectId);

      if (input.startWarranty) {
        const warranty = await db
          .from("project_warranties")
          .upsert({
            company_id: input.companyId,
            project_id: input.projectId,
            closeout_id: closeout.id,
            status: "active",
            starts_at: completedAt,
            ends_at: input.warrantyEndsAt || null,
            created_by: input.actorProfileId,
            updated_by: input.actorProfileId,
            updated_at: completedAt,
          }, { onConflict: "company_id,project_id" })
          .select("id")
          .single();

        if (!warranty.error && warranty.data?.id) {
          await publish({
            companyId: input.companyId,
            actorProfileId: input.actorProfileId,
            correlationId: input.correlationId,
            idempotencyKey: `${input.idempotencyKey || `closeout:${closeout.id}`}:warranty`,
            eventType: "warranty.started",
            aggregateType: "warranty",
            aggregateId: warranty.data.id,
            sourceModule: "projects",
            payload: {
              project_id: input.projectId,
              closeout_id: closeout.id,
              starts_at: completedAt,
              ends_at: input.warrantyEndsAt || null,
              deep_link: `/projects/${input.projectId}/closeout`,
            },
          });
        }
      }

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `closeout:${closeout.id}`}:completed`,
        eventType: "project.completed",
        aggregateType: "project",
        aggregateId: input.projectId,
        sourceModule: "projects",
        payload: {
          project_id: input.projectId,
          closeout_id: closeout.id,
          status: "completed",
          deep_link: `/projects/${input.projectId}`,
        },
      });

      return {
        ok: true,
        blockers: [],
        deepLink: `/projects/${input.projectId}`,
        message: `Project ${asString(project.name) || input.projectId} has been completed.`,
      };
    },

    async archiveProject(input: ActorContext & { projectId: string; reason?: string | null }) {
      await ensureProjectScope(input.companyId, input.projectId);
      const closeout = await ensureCloseoutRecord(input);

      if (closeout.status !== "completed") {
        throw new Error("Project cannot be archived before completion unless an authorized exception is recorded.");
      }

      await supabase
        .from("projects")
        .update({
          status: "cancelled",
          updated_at: nowIso(),
        })
        .eq("company_id", input.companyId)
        .eq("id", input.projectId);

      await db
        .from("project_closeouts")
        .update({
          status: "archived",
          updated_at: nowIso(),
          updated_by: input.actorProfileId,
        })
        .eq("company_id", input.companyId)
        .eq("id", closeout.id);

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || `closeout:${closeout.id}`}:archived`,
        eventType: "project.archived",
        aggregateType: "project",
        aggregateId: input.projectId,
        sourceModule: "projects",
        payload: {
          project_id: input.projectId,
          closeout_id: closeout.id,
          reason: input.reason || null,
          deep_link: `/projects/${input.projectId}`,
        },
      });

      return closeout;
    },

    async listCloseout(input: ActorContext & { projectId: string }) {
      const closeout = await ensureCloseoutRecord(input);
      const [checklist, punchItems, warranties] = await Promise.all([
        db
          .from("project_closeout_items")
          .select("*")
          .eq("company_id", input.companyId)
          .eq("closeout_id", closeout.id)
          .order("created_at", { ascending: true }),
        db
          .from("project_punch_items")
          .select("*")
          .eq("company_id", input.companyId)
          .eq("project_id", input.projectId)
          .order("created_at", { ascending: false }),
        db
          .from("project_warranties")
          .select("*")
          .eq("company_id", input.companyId)
          .eq("project_id", input.projectId)
          .order("created_at", { ascending: false }),
      ]);

      return {
        closeout,
        checklist: checklist.data || [],
        punchItems: punchItems.data || [],
        warranties: warranties.data || [],
      };
    },

    async createCommunicationDraft(input: ActorContext & {
      projectId: string;
      customerId?: string | null;
      channel: string;
      direction: "outbound" | "inbound" | "internal";
      recipientName?: string | null;
      recipientAddress?: string | null;
      subject?: string | null;
      message: string;
      metadata?: Record<string, unknown>;
      correlationIdValue?: string | null;
    }) {
      await ensureProjectScope(input.companyId, input.projectId);

      const correlationId = input.correlationIdValue || input.correlationId || input.idempotencyKey || `comm:${Date.now().toString(36)}`;
      const existing = await db
        .from("project_communications")
        .select("*")
        .eq("company_id", input.companyId)
        .eq("correlation_id", correlationId)
        .maybeSingle();

      if (existing.data) {
        return existing.data;
      }

      const created = await db
        .from("project_communications")
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          customer_id: input.customerId || null,
          channel: input.channel,
          direction: input.direction,
          recipient_name: input.recipientName || null,
          recipient_address: input.recipientAddress || null,
          subject: input.subject || null,
          message: input.message,
          status: "draft",
          created_by: input.actorProfileId,
          correlation_id: correlationId,
          metadata: input.metadata || {},
        })
        .select("*")
        .single();

      if (created.error || !created.data) {
        throw new Error(created.error?.message || "Unable to create communication draft.");
      }

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || correlationId}:drafted`,
        eventType: "customer_update.drafted",
        aggregateType: "communication",
        aggregateId: created.data.id,
        sourceModule: "communications",
        payload: {
          communication_id: created.data.id,
          project_id: input.projectId,
          customer_id: input.customerId || null,
          channel: input.channel,
          status: "draft",
          subject: input.subject || null,
          recipient_name: input.recipientName || null,
          deep_link: `/projects/${input.projectId}/communications?communicationId=${created.data.id}`,
        },
      });

      return created.data;
    },

    async previewCommunication(input: ActorContext & { communicationId: string }) {
      const result = await db
        .from("project_communications")
        .select("*")
        .eq("company_id", input.companyId)
        .eq("id", input.communicationId)
        .maybeSingle();

      if (result.error || !result.data) {
        throw new Error(result.error?.message || "Communication draft not found.");
      }

      return {
        recipient: {
          name: result.data.recipient_name,
          address: result.data.recipient_address,
          channel: result.data.channel,
        },
        subject: result.data.subject,
        message: result.data.message,
        relatedProject: result.data.project_id,
        attachments: toRecord(result.data.metadata).attachments || [],
      };
    },

    async sendCommunication(input: ActorContext & { communicationId: string; confirmed: boolean }) {
      if (!input.confirmed) {
        throw new Error("Send confirmation is required before delivery.");
      }

      const result = await db
        .from("project_communications")
        .select("*")
        .eq("company_id", input.companyId)
        .eq("id", input.communicationId)
        .maybeSingle();

      if (result.error || !result.data) {
        throw new Error(result.error?.message || "Communication not found.");
      }

      const support = supportsProvider(result.data.channel);

      if (!support.supported) {
        const failedAt = nowIso();
        await db
          .from("project_communications")
          .update({
            status: "failed",
            failed_at: failedAt,
            failure_reason: support.reason,
            metadata: {
              ...toRecord(result.data.metadata),
              unsupported_delivery: true,
            },
          })
          .eq("company_id", input.companyId)
          .eq("id", input.communicationId);

        await publish({
          companyId: input.companyId,
          actorProfileId: input.actorProfileId,
          correlationId: input.correlationId,
          idempotencyKey: `${input.idempotencyKey || result.data.correlation_id}:failed`,
          eventType: "customer_update.failed",
          aggregateType: "communication",
          aggregateId: input.communicationId,
          sourceModule: "communications",
          payload: {
            communication_id: input.communicationId,
            project_id: result.data.project_id,
            customer_id: result.data.customer_id,
            channel: result.data.channel,
            status: "failed",
            failure_reason: support.reason,
            deep_link: `/projects/${result.data.project_id}/communications?communicationId=${input.communicationId}`,
          },
        });

        return {
          status: "failed",
          message: support.reason || "Delivery provider is not configured.",
        };
      }

      if (support.loggedOnly) {
        await db
          .from("project_communications")
          .update({
            status: "logged_only",
            sent_at: nowIso(),
          })
          .eq("company_id", input.companyId)
          .eq("id", input.communicationId);

        await publish({
          companyId: input.companyId,
          actorProfileId: input.actorProfileId,
          correlationId: input.correlationId,
          idempotencyKey: `${input.idempotencyKey || result.data.correlation_id}:logged`,
          eventType: "customer_update.logged",
          aggregateType: "communication",
          aggregateId: input.communicationId,
          sourceModule: "communications",
          payload: {
            communication_id: input.communicationId,
            project_id: result.data.project_id,
            customer_id: result.data.customer_id,
            channel: result.data.channel,
            status: "logged_only",
            deep_link: `/projects/${result.data.project_id}/communications?communicationId=${input.communicationId}`,
          },
        });

        return {
          status: "logged_only",
          message: "Communication was logged only (non-delivery channel).",
        };
      }

      const sentAt = nowIso();
      await db
        .from("project_communications")
        .update({
          status: "queued",
          sent_at: sentAt,
        })
        .eq("company_id", input.companyId)
        .eq("id", input.communicationId);

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || result.data.correlation_id}:sent`,
        eventType: "customer_update.sent",
        aggregateType: "communication",
        aggregateId: input.communicationId,
        sourceModule: "communications",
        payload: {
          communication_id: input.communicationId,
          project_id: result.data.project_id,
          customer_id: result.data.customer_id,
          channel: result.data.channel,
          status: "queued",
          deep_link: `/projects/${result.data.project_id}/communications?communicationId=${input.communicationId}`,
        },
      });

      return {
        status: "queued",
        message: "Communication queued for delivery provider.",
      };
    },

    async cancelCommunication(input: ActorContext & { communicationId: string; reason?: string | null }) {
      const updated = await db
        .from("project_communications")
        .update({
          status: "cancelled",
          failure_reason: input.reason || null,
        })
        .eq("company_id", input.companyId)
        .eq("id", input.communicationId)
        .select("*")
        .single();

      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message || "Unable to cancel communication.");
      }

      return updated.data;
    },

    async logInboundMessage(input: ActorContext & {
      projectId: string;
      customerId?: string | null;
      channel: string;
      message: string;
      recipientName?: string | null;
      recipientAddress?: string | null;
      metadata?: Record<string, unknown>;
      correlationIdValue?: string | null;
    }) {
      const created = await this.createCommunicationDraft({
        ...input,
        direction: "inbound",
        subject: "Customer message",
        correlationIdValue: input.correlationIdValue || input.correlationId || `incoming:${Date.now().toString(36)}`,
      });

      await db
        .from("project_communications")
        .update({
          status: "logged_only",
          sent_at: nowIso(),
        })
        .eq("company_id", input.companyId)
        .eq("id", created.id);

      await publish({
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        correlationId: input.correlationId,
        idempotencyKey: `${input.idempotencyKey || created.correlation_id}:incoming`,
        eventType: "customer_message.received",
        aggregateType: "communication",
        aggregateId: created.id,
        sourceModule: "communications",
        payload: {
          communication_id: created.id,
          project_id: input.projectId,
          customer_id: input.customerId || null,
          channel: input.channel,
          status: "logged_only",
          deep_link: `/projects/${input.projectId}/communications?communicationId=${created.id}`,
        },
      });

      return created;
    },

    async listCommunications(input: ActorContext & { projectId: string }) {
      await ensureProjectScope(input.companyId, input.projectId);
      const result = await db
        .from("project_communications")
        .select("*")
        .eq("company_id", input.companyId)
        .eq("project_id", input.projectId)
        .order("created_at", { ascending: false });

      if (result.error) {
        throw new Error(result.error.message || "Unable to load communications.");
      }

      return result.data || [];
    },

    async projectExecutionSummary(input: ActorContext & { projectId: string }) {
      await ensureProjectScope(input.companyId, input.projectId);

      const [inspections, permits, closeout, punch, communications] = await Promise.all([
        db
          .from("project_inspections")
          .select("id, status, scheduled_at, reinspection_required")
          .eq("company_id", input.companyId)
          .eq("project_id", input.projectId),
        db
          .from("project_permits")
          .select("id, status, expiration_date")
          .eq("company_id", input.companyId)
          .eq("project_id", input.projectId),
        db
          .from("project_closeouts")
          .select("id, status, handover_status, completion_blockers")
          .eq("company_id", input.companyId)
          .eq("project_id", input.projectId)
          .maybeSingle(),
        db
          .from("project_punch_items")
          .select("id, status")
          .eq("company_id", input.companyId)
          .eq("project_id", input.projectId),
        db
          .from("project_communications")
          .select("id, status, created_at")
          .eq("company_id", input.companyId)
          .eq("project_id", input.projectId)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const inspectionsData = inspections.data || [];
      const permitsData = permits.data || [];
      const punchData = punch.data || [];
      const latestComm = (communications.data || [])[0] || null;

      const openPermitCount = permitsData.filter((row: Record<string, unknown>) => {
        const status = asString(row.status) || "";
        return ["required", "preparing", "submitted", "under_review", "approved", "issued", "renewal_required", "expired", "rejected"].includes(status);
      }).length;

      const failedInspectionCount = inspectionsData.filter((row: Record<string, unknown>) => asString(row.status) === "failed").length;
      const upcomingInspectionCount = inspectionsData.filter((row: Record<string, unknown>) => {
        const status = asString(row.status) || "";
        return ["scheduled", "reinspection_required"].includes(status);
      }).length;

      const openPunchCount = punchData.filter((row: Record<string, unknown>) => {
        const status = asString(row.status) || "";
        return ["open", "assigned", "in_progress", "reopened"].includes(status);
      }).length;

      const closeoutStatus = asString(closeout.data?.status) || "draft";
      const blockers = Array.isArray(closeout.data?.completion_blockers) ? closeout.data.completion_blockers : [];

      return {
        inspectionsTotal: inspectionsData.length,
        inspectionsFailed: failedInspectionCount,
        inspectionsUpcoming: upcomingInspectionCount,
        permitsTotal: permitsData.length,
        permitsOpen: openPermitCount,
        punchOpen: openPunchCount,
        closeoutStatus,
        closeoutBlockers: blockers,
        communicationFreshnessAt: asString(latestComm?.created_at),
        communicationStatus: asString(latestComm?.status),
      };
    },
  };
}
