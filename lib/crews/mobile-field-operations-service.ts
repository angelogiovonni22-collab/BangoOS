import {
  createDailyReportsService,
  type DailyReportUpsertInput,
  type DailyReportsService,
  type DailyReportStatus,
} from "@/lib/daily-reports";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import { createWorkforceOperationsService, type WorkforceOperationsService } from "./workforce-operations-service";
import {
  createEmptyChecklist,
  type CrewCheckInAction,
  type CrewCheckInProvider,
  type DailyChecklist,
  type EquipmentCheckoutRecord,
  type EquipmentCheckoutProvider,
  type ForemanDashboardData,
  type MobileFieldOperationsService,
  type OfflineConflictResolutionProvider,
  type OfflineQueueItem,
  type OfflineQueueProvider,
  type OfflineSyncProvider,
  type SubmitMobileDailyReportInput,
  toShiftStatus,
} from "./mobile-field-operations-types";
import { normalizeFieldProduction } from "./field-production";

const checklistStore = new Map<string, DailyChecklist>();
const checkoutStore = new Map<string, { id: string; crewId: string; equipmentIds: string[]; conditionNotes: string; checkedOutAt: string; returnedAt: string | null }>();
const offlineQueueStore: OfflineQueueItem[] = [];

const MOBILE_CHECK_IN_EVENT = "mobile_field.check_in.logged";
const MOBILE_CHECKLIST_EVENT = "mobile_field.checklist.saved";
const MOBILE_EQUIPMENT_CHECKOUT_EVENT = "mobile_field.equipment.checkout";
const MOBILE_EQUIPMENT_RETURN_EVENT = "mobile_field.equipment.returned";

type WorkflowMobileEventRow = {
  event_type: string;
  occurred_at: string;
  reference_id: string | null;
  payload: Record<string, unknown> | null;
};

const noopCheckInProvider: CrewCheckInProvider = {
  async logAction() {
    return;
  },
};

const inMemoryQueueProvider: OfflineQueueProvider = {
  async enqueue(item) {
    const next: OfflineQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: item.type,
      payload: item.payload,
      createdAt: new Date().toISOString(),
      status: "queued",
    };

    offlineQueueStore.unshift(next);
    return next;
  },
  async list() {
    return [...offlineQueueStore];
  },
};

const inMemorySyncProvider: OfflineSyncProvider = {
  async getStatus() {
    const hasQueued = offlineQueueStore.some((item) => item.status === "queued");
    return {
      state: hasQueued ? "pending" : "idle",
      lastSyncedAt: null,
    };
  },
};

const inMemoryConflictProvider: OfflineConflictResolutionProvider = {
  async listConflicts() {
    return [];
  },
};

const inMemoryEquipmentCheckoutProvider: EquipmentCheckoutProvider = {
  async createCheckout(input) {
    const record = {
      id: `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      crewId: input.crewId,
      equipmentIds: input.equipmentIds,
      conditionNotes: input.conditionNotes,
      checkedOutAt: input.at,
      returnedAt: null,
    };

    checkoutStore.set(record.id, record);
    return record;
  },
  async returnEquipment(input) {
    const existing = checkoutStore.get(input.checkoutId);
    if (!existing) {
      return null;
    }

    const next = {
      ...existing,
      conditionNotes: input.conditionNotes || existing.conditionNotes,
      returnedAt: input.at,
    };

    checkoutStore.set(input.checkoutId, next);
    return next;
  },
  async list() {
    return Array.from(checkoutStore.values()).sort((a, b) => b.checkedOutAt.localeCompare(a.checkedOutAt));
  },
};

type CreateMobileFieldOperationsServiceDeps = {
  workforceService?: WorkforceOperationsService;
  dailyReportsService?: DailyReportsService;
  supabaseClient?: ReturnType<typeof createClient>;
  resolveWorkspace?: typeof resolveWorkspaceContext;
  checkInProvider?: CrewCheckInProvider;
  offlineQueue?: OfflineQueueProvider;
  offlineSync?: OfflineSyncProvider;
  conflictResolution?: OfflineConflictResolutionProvider;
  equipmentCheckoutProvider?: EquipmentCheckoutProvider;
};

type ResolvedContext = {
  supabase: NonNullable<ReturnType<typeof createClient>>;
  workspace: NonNullable<Awaited<ReturnType<typeof resolveWorkspaceContext>>["context"]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function createRuntimeId(prefix: string): string {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function extractChecklistByCrew(events: WorkflowMobileEventRow[]): Record<string, DailyChecklist> {
  const result: Record<string, DailyChecklist> = {};

  for (const event of events) {
    if (event.event_type !== MOBILE_CHECKLIST_EVENT || !isRecord(event.payload)) {
      continue;
    }

    const payloadCrewId = typeof event.payload.crewId === "string" ? event.payload.crewId : event.reference_id;
    if (!payloadCrewId || result[payloadCrewId]) {
      continue;
    }

    const rawChecklist = event.payload.checklist;
    if (!isRecord(rawChecklist)) {
      continue;
    }

    result[payloadCrewId] = {
      safetyBriefing: rawChecklist.safetyBriefing === true,
      ppeVerification: rawChecklist.ppeVerification === true,
      equipmentInspection: rawChecklist.equipmentInspection === true,
      dailyGoals: typeof rawChecklist.dailyGoals === "string" ? rawChecklist.dailyGoals : "",
      supervisorNotes: typeof rawChecklist.supervisorNotes === "string" ? rawChecklist.supervisorNotes : "",
      updatedAt: typeof rawChecklist.updatedAt === "string" ? rawChecklist.updatedAt : event.occurred_at,
    };
  }

  return result;
}

function extractEquipmentCheckouts(events: WorkflowMobileEventRow[]) {
  const records = new Map<string, { id: string; crewId: string; equipmentIds: string[]; conditionNotes: string; checkedOutAt: string; returnedAt: string | null }>();

  for (const event of [...events].reverse()) {
    if (!isRecord(event.payload)) {
      continue;
    }

    if (event.event_type === MOBILE_EQUIPMENT_CHECKOUT_EVENT) {
      const payloadRecord = isRecord(event.payload.record) ? event.payload.record : event.payload;
      const id = typeof payloadRecord.id === "string" ? payloadRecord.id : null;
      const crewId = typeof payloadRecord.crewId === "string" ? payloadRecord.crewId : null;

      if (!id || !crewId) {
        continue;
      }

      records.set(id, {
        id,
        crewId,
        equipmentIds: asStringArray(payloadRecord.equipmentIds),
        conditionNotes: typeof payloadRecord.conditionNotes === "string" ? payloadRecord.conditionNotes : "",
        checkedOutAt: typeof payloadRecord.checkedOutAt === "string" ? payloadRecord.checkedOutAt : event.occurred_at,
        returnedAt: null,
      });
    }

    if (event.event_type === MOBILE_EQUIPMENT_RETURN_EVENT) {
      const checkoutId = typeof event.payload.checkoutId === "string" ? event.payload.checkoutId : event.reference_id;
      if (!checkoutId) {
        continue;
      }

      const existing = records.get(checkoutId);
      if (!existing) {
        continue;
      }

      records.set(checkoutId, {
        ...existing,
        conditionNotes: typeof event.payload.conditionNotes === "string" && event.payload.conditionNotes
          ? event.payload.conditionNotes
          : existing.conditionNotes,
        returnedAt: typeof event.payload.returnedAt === "string" ? event.payload.returnedAt : event.occurred_at,
      });
    }
  }

  return Array.from(records.values()).sort((a, b) => b.checkedOutAt.localeCompare(a.checkedOutAt));
}

async function markQueueStatus(provider: OfflineQueueProvider, item: OfflineQueueItem | null, status: OfflineQueueItem["status"]) {
  if (item) {
    item.status = status;
    await provider.setStatus?.(item.id, status);
  }
}

function createMobileReportInput(params: {
  baseDraft: DailyReportUpsertInput;
  source: SubmitMobileDailyReportInput;
  projectId: string;
  projectName: string;
  superintendentName: string;
}): DailyReportUpsertInput {
  const now = new Date().toISOString();
  const { source } = params;
  const production = normalizeFieldProduction({
    activity: source.draft.completedWork,
    quantity: source.draft.productionQuantity,
    unit: source.draft.productionUnit,
    percentComplete: source.draft.productionPercentComplete,
  });

  return {
    ...params.baseDraft,
    header: {
      ...params.baseDraft.header,
      date: source.reportDate,
      projectId: params.projectId,
      projectName: params.projectName,
      superintendentName: params.superintendentName,
      overallStatus: source.status,
    },
    workCompleted: production
      ? [{
          id: `work-${Date.now()}`,
          activity: production.activity,
          quantity: production.quantity,
          unit: production.unit,
          percentComplete: production.percentComplete,
          productionNotes: source.draft.notes,
          milestoneCompleted: production.percentComplete === 100,
        }]
      : [],
    materials: source.draft.materialsUsed.trim()
      ? [{
          id: `mat-${Date.now()}`,
          delivery: source.draft.materialsUsed,
          supplier: "",
          quantity: 1,
          unit: "item",
          receivedTime: now,
          shortages: false,
          rejected: false,
          notes: "",
        }]
      : [],
    safety: source.draft.safetyObservations.trim()
      ? [{
          id: `safe-${Date.now()}`,
          type: source.draft.safetyEventType,
          attendees: 0,
          severity: source.draft.safetySeverity,
          status: "open",
          notes: [source.draft.safetyObservations.trim(), source.draft.safetyImmediateAction.trim() ? `Immediate action: ${source.draft.safetyImmediateAction.trim()}` : ""].filter(Boolean).join("\n"),
        }]
      : [],
    delays: source.draft.delays.trim()
      ? [{
          id: `delay-${Date.now()}`,
          category: source.draft.delayCategory,
          durationHours: Math.max(0, Number(source.draft.delayDurationHours) || 0),
          description: source.draft.delays,
          impact: source.draft.delayImpact.trim(),
          correctiveAction: source.draft.delayCorrectiveAction.trim(),
        }]
      : [],
    attachments: source.draft.photos.map((photo, index) => ({
      id: `photo-${index}-${Date.now()}`,
      fileName: photo,
      caption: "Field photo",
      category: "progress",
      uploadedAt: now,
    })),
    timeline: [
      {
        id: `event-${Date.now()}`,
        happenedAt: now,
        eventType: "shift_complete",
        description: source.draft.notes || "Mobile field report submitted.",
      },
    ],
  };
}

export function createMobileFieldOperationsService(
  deps: CreateMobileFieldOperationsServiceDeps = {},
): MobileFieldOperationsService {
  const workforce = deps.workforceService || createWorkforceOperationsService();
  const dailyReports = deps.dailyReportsService || createDailyReportsService();
  const supabase = deps.supabaseClient ?? createClient();
  const resolveWorkspace = deps.resolveWorkspace ?? resolveWorkspaceContext;
  const checkInProvider = deps.checkInProvider || noopCheckInProvider;
  const offlineQueue = deps.offlineQueue || inMemoryQueueProvider;
  const offlineSync = deps.offlineSync || inMemorySyncProvider;
  const conflictResolution = deps.conflictResolution || inMemoryConflictProvider;
  const equipmentCheckoutProvider = deps.equipmentCheckoutProvider || inMemoryEquipmentCheckoutProvider;
  let inFlightContext: Promise<ResolvedContext | null> | null = null;

  const resolveContext = async (): Promise<ResolvedContext | null> => {
    if (inFlightContext) {
      return inFlightContext;
    }

    inFlightContext = (async () => {
      if (!supabase) {
        return null;
      }

      const workspace = await resolveWorkspace(supabase);
      if (workspace.errorMessage || !workspace.context) {
        return null;
      }

      return {
        supabase,
        workspace: workspace.context,
      };
    })();

    try {
      return await inFlightContext;
    } finally {
      inFlightContext = null;
    }
  };

  const listMobileEvents = async (context: ResolvedContext): Promise<WorkflowMobileEventRow[]> => {
    const { data, error } = await context.supabase
      .from("workflow_events")
      .select("event_type, occurred_at, reference_id, payload")
      .eq("company_id", context.workspace.companyId)
      .eq("workflow_name", "mobile_field_operations")
      .in("event_type", [
        MOBILE_CHECKLIST_EVENT,
        MOBILE_EQUIPMENT_CHECKOUT_EVENT,
        MOBILE_EQUIPMENT_RETURN_EVENT,
      ])
      .order("occurred_at", { ascending: false })
      .limit(600);

    if (error) {
      throw error;
    }

    return (data as WorkflowMobileEventRow[] | null) || [];
  };

  const recordMobileEvent = async (context: ResolvedContext, input: {
    eventType: string;
    currentState?: string | null;
    nextState?: string | null;
    referenceEntity: string;
    referenceId: string | null;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<void> => {
    const { error } = await context.supabase
      .from("workflow_events")
      .insert({
        company_id: context.workspace.companyId,
        workflow_name: "mobile_field_operations",
        event_type: input.eventType,
        current_state: input.currentState || null,
        next_state: input.nextState || null,
        actor_profile_id: context.workspace.userId,
        reference_entity: input.referenceEntity,
        reference_id: input.referenceId,
        occurred_at: new Date().toISOString(),
        source_module: "crews",
        payload: input.payload as Database["public"]["Tables"]["workflow_events"]["Insert"]["payload"],
        metadata: {
          source: "mobile_field",
        } as Database["public"]["Tables"]["workflow_events"]["Insert"]["metadata"],
        idempotency_key: input.idempotencyKey ?? null,
      });

    if (error) {
      throw error;
    }
  };

  return {
    async syncOfflineActions() {
      const context = await resolveContext();
      if (!context) return { synced: 0, failed: 0 };
      const pending = (await offlineQueue.list())
        .filter((item) => item.status === "queued")
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      let synced = 0;
      let failed = 0;

      for (const item of pending) {
        try {
          const payload = item.payload;
          const crewId = typeof payload.crewId === "string" ? payload.crewId : null;
          const idempotencyKey = `mobile-field:${item.id}`;
          if (item.type === "check_in" && crewId && typeof payload.action === "string") {
            const action = payload.action as CrewCheckInAction;
            await workforce.setCrewShiftStatus({ crewId, status: toShiftStatus(action) });
            await recordMobileEvent(context, { eventType: MOBILE_CHECK_IN_EVENT, nextState: toShiftStatus(action), referenceEntity: "crew", referenceId: crewId, payload, idempotencyKey });
          } else if (item.type === "checklist" && crewId && isRecord(payload.checklist)) {
            await recordMobileEvent(context, { eventType: MOBILE_CHECKLIST_EVENT, referenceEntity: "crew", referenceId: crewId, payload, idempotencyKey });
          } else if (item.type === "equipment_checkout" && crewId && Array.isArray(payload.equipmentIds)) {
            const checkoutId = typeof payload.checkoutId === "string" ? payload.checkoutId : item.id;
            const record = { id: checkoutId, crewId, equipmentIds: asStringArray(payload.equipmentIds), conditionNotes: typeof payload.conditionNotes === "string" ? payload.conditionNotes : "", checkedOutAt: item.createdAt, returnedAt: null };
            await workforce.assignEquipmentToCrew({ crewId, equipmentIds: record.equipmentIds });
            await recordMobileEvent(context, { eventType: MOBILE_EQUIPMENT_CHECKOUT_EVENT, currentState: "available", nextState: "checked_out", referenceEntity: "equipment_checkout", referenceId: checkoutId, payload: { record }, idempotencyKey });
          } else if (item.type === "equipment_return" && typeof payload.checkoutId === "string") {
            await recordMobileEvent(context, { eventType: MOBILE_EQUIPMENT_RETURN_EVENT, currentState: "checked_out", nextState: "returned", referenceEntity: "equipment_checkout", referenceId: payload.checkoutId, payload: { ...payload, returnedAt: typeof payload.at === "string" ? payload.at : item.createdAt }, idempotencyKey });
          } else if (item.type === "mobile_report" && typeof payload.reportId === "string") {
            // The report is created transactionally before its local audit entry is queued.
          } else {
            throw new Error("Unsupported or incomplete queued field action.");
          }
          await offlineQueue.setStatus?.(item.id, "synced");
          synced += 1;
        } catch {
          await offlineQueue.setStatus?.(item.id, "failed");
          failed += 1;
        }
      }
      return { synced, failed };
    },
    async retryOfflineAction(id) {
      const item = (await offlineQueue.list()).find((entry) => entry.id === id && entry.status === "failed");
      if (!item) return { synced: 0, failed: 0 };
      await offlineQueue.setStatus?.(id, "queued");
      return this.syncOfflineActions();
    },
    async discardOfflineAction(id) {
      const item = (await offlineQueue.list()).find((entry) => entry.id === id && entry.status === "failed");
      if (item) await offlineQueue.remove?.(id);
    },
    async getForemanDashboard(): Promise<ForemanDashboardData> {
      const [workforceData, dailyReportsDashboard, queue, sync, conflicts, context] = await Promise.all([
        workforce.getDashboard(),
        dailyReports.getDashboard(),
        offlineQueue.list(),
        offlineSync.getStatus(),
        conflictResolution.listConflicts(),
        resolveContext(),
      ]);

      let checklistByCrew: Record<string, DailyChecklist> = {};
      let equipmentCheckouts = await equipmentCheckoutProvider.list();

      if (context) {
        try {
          const events = await listMobileEvents(context);
          checklistByCrew = extractChecklistByCrew(events);
          equipmentCheckouts = extractEquipmentCheckouts(events);
        } catch {
          // Fall back to local stores when persistence is unavailable.
        }
      }

      for (const crew of workforceData.crewStatus) {
        if (!checklistByCrew[crew.crewId]) {
          checklistByCrew[crew.crewId] = checklistStore.get(crew.crewId) || createEmptyChecklist();
        }
      }

      return {
        generatedAt: new Date().toISOString(),
        workforce: workforceData,
        weather: dailyReportsDashboard.weatherSnapshotText,
        quickActions: [
          { id: "check-in", label: "Crew Check-In" },
          { id: "checklist", label: "Daily Checklist" },
          { id: "mobile-report", label: "Mobile Report" },
          { id: "equipment", label: "Equipment Checkout" },
        ],
        crewDirectory: workforceData.employeeStatus.map((employee) => ({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          crewName: employee.assignedCrewName,
          projectName: employee.assignedJobName,
          phone: employee.contactPhone,
        })),
        checklistByCrew,
        equipmentCheckouts,
        offline: {
          queue,
          sync,
          conflicts: [
            ...conflicts,
            ...queue.filter((item) => item.status === "failed").map((item) => ({ id: item.id, entityType: item.type, message: "This offline action could not be synchronized. Retry it or discard the local copy.", createdAt: item.createdAt })),
          ],
        },
      };
    },

    async runCheckInAction(input) {
      const now = new Date().toISOString();
      const context = await resolveContext();
      await workforce.setCrewShiftStatus({
        crewId: input.crewId,
        status: toShiftStatus(input.action),
      });

      await checkInProvider.logAction({
        crewId: input.crewId,
        action: input.action,
        at: now,
      });

      let saved = false;
      if (context) {
        try {
          await recordMobileEvent(context, {
            eventType: MOBILE_CHECK_IN_EVENT,
            currentState: null,
            nextState: toShiftStatus(input.action),
            referenceEntity: "crew",
            referenceId: input.crewId,
            payload: {
              crewId: input.crewId,
              action: input.action,
              at: now,
            },
          });
          saved = true;
        } catch {
          saved = false;
        }
      }

      const queued = await offlineQueue.enqueue({
        type: "check_in",
        payload: {
          crewId: input.crewId,
          action: input.action,
          at: now,
          persistenceState: saved ? "saved" : "queued",
        },
      });
      await markQueueStatus(offlineQueue, queued, saved ? "synced" : "queued");
    },

    async saveDailyChecklist(input) {
      const nextChecklist: DailyChecklist = {
        ...input.checklist,
        updatedAt: new Date().toISOString(),
      };

      const context = await resolveContext();
      let saved = false;

      if (context) {
        try {
          await recordMobileEvent(context, {
            eventType: MOBILE_CHECKLIST_EVENT,
            currentState: null,
            nextState: null,
            referenceEntity: "crew",
            referenceId: input.crewId,
            payload: {
              crewId: input.crewId,
              checklist: nextChecklist,
            },
          });
          saved = true;
        } catch {
          saved = false;
        }
      }

      const queued = await offlineQueue.enqueue({
        type: "checklist",
        payload: {
          crewId: input.crewId,
          checklist: nextChecklist,
          persistenceState: saved ? "saved" : "queued",
        },
      });
      await markQueueStatus(offlineQueue, queued, saved ? "synced" : "queued");

      if (!saved) {
        checklistStore.set(input.crewId, nextChecklist);
      }
    },

    async submitMobileDailyReport(input) {
      const [workforceData, baseDraft] = await Promise.all([
        workforce.getDashboard(),
        dailyReports.createDraftFromSchedule(input.reportDate),
      ]);

      const assignment = workforceData.dailyAssignments.find((item) => item.crewId === input.crewId) || null;
      const crew = workforceData.crewStatus.find((item) => item.crewId === input.crewId) || null;

      const reportInput = createMobileReportInput({
        baseDraft,
        source: input,
        projectId: assignment?.projectId || baseDraft.header.projectId,
        projectName: assignment?.projectName || baseDraft.header.projectName,
        superintendentName: crew?.supervisorName || baseDraft.header.superintendentName,
      });

      const created = await dailyReports.createReport(reportInput, input.status as DailyReportStatus);

      const queued = await offlineQueue.enqueue({
        type: "mobile_report",
        payload: { crewId: input.crewId, reportId: created.id, status: input.status },
      });
      await markQueueStatus(offlineQueue, queued, "synced");

      return {
        reportId: created.id,
      };
    },

    async checkoutEquipment(input) {
      const now = new Date().toISOString();
      const context = await resolveContext();
      await workforce.assignEquipmentToCrew({
        crewId: input.crewId,
        equipmentIds: input.equipmentIds,
      });

      let checkout: EquipmentCheckoutRecord = {
        id: createRuntimeId("checkout"),
        crewId: input.crewId,
        equipmentIds: input.equipmentIds,
        conditionNotes: input.conditionNotes,
        checkedOutAt: now,
        returnedAt: null,
      };
      let saved = false;

      if (context) {
        try {
          await recordMobileEvent(context, {
            eventType: MOBILE_EQUIPMENT_CHECKOUT_EVENT,
            currentState: "available",
            nextState: "checked_out",
            referenceEntity: "equipment_checkout",
            referenceId: checkout.id,
            payload: {
              record: checkout,
            },
          });
          saved = true;
        } catch {
          saved = false;
        }
      }

      if (!saved) {
        checkout = await equipmentCheckoutProvider.createCheckout({
          crewId: input.crewId,
          equipmentIds: input.equipmentIds,
          conditionNotes: input.conditionNotes,
          at: now,
        });
      }

      const queued = await offlineQueue.enqueue({
        type: "equipment_checkout",
        payload: {
          checkoutId: checkout.id,
          crewId: input.crewId,
          equipmentIds: input.equipmentIds,
          persistenceState: saved ? "saved" : "queued",
        },
      });
      await markQueueStatus(offlineQueue, queued, saved ? "synced" : "queued");

      return checkout;
    },

    async returnEquipment(input) {
      const now = new Date().toISOString();
      const context = await resolveContext();
      let returned = await equipmentCheckoutProvider.returnEquipment({
        checkoutId: input.checkoutId,
        conditionNotes: input.conditionNotes,
        at: now,
      });
      let saved = false;

      if (context) {
        try {
          const events = await listMobileEvents(context);
          const persisted = extractEquipmentCheckouts(events).find((record) => record.id === input.checkoutId) || null;

          if (persisted) {
            returned = {
              ...persisted,
              conditionNotes: input.conditionNotes || persisted.conditionNotes,
              returnedAt: now,
            };

            await recordMobileEvent(context, {
              eventType: MOBILE_EQUIPMENT_RETURN_EVENT,
              currentState: "checked_out",
              nextState: "returned",
              referenceEntity: "equipment_checkout",
              referenceId: input.checkoutId,
              payload: {
                checkoutId: input.checkoutId,
                crewId: persisted.crewId,
                equipmentIds: persisted.equipmentIds,
                conditionNotes: returned.conditionNotes,
                returnedAt: now,
              },
            });

            saved = true;
          }
        } catch {
          saved = false;
        }
      }

      if (returned) {
        const queued = await offlineQueue.enqueue({
          type: "equipment_return",
          payload: {
            checkoutId: input.checkoutId,
            at: now,
            persistenceState: saved ? "saved" : "queued",
          },
        });
        await markQueueStatus(offlineQueue, queued, saved ? "synced" : "queued");
      }

      return returned;
    },
  };
}
