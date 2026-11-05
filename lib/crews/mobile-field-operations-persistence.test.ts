import type { DailyReportUpsertInput } from "@/lib/daily-reports";
import { createEmptyMobileDailyReportDraft } from "./mobile-field-operations-types";
import { createMobileFieldOperationsService } from "./mobile-field-operations-service";
import type {
  DailyChecklist,
  OfflineQueueItem,
  OfflineQueueProvider,
} from "./mobile-field-operations-types";

type WorkflowEventRow = {
  company_id: string;
  workflow_name: string;
  event_type: string;
  reference_entity: string;
  reference_id: string | null;
  actor_profile_id: string | null;
  current_state: string | null;
  next_state: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

function createQueueProvider(): { queue: OfflineQueueItem[]; provider: OfflineQueueProvider } {
  const queue: OfflineQueueItem[] = [];

  return {
    queue,
    provider: {
      async enqueue(item) {
        const next: OfflineQueueItem = {
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: item.type,
          payload: item.payload,
          createdAt: new Date().toISOString(),
          status: "queued",
        };
        queue.unshift(next);
        return next;
      },
      async list() {
        return [...queue];
      },
      async setStatus(id, status) {
        const item = queue.find((entry) => entry.id === id);
        if (item) item.status = status;
      },
    },
  };
}

function createWorkflowSupabaseStub(workflowEvents: WorkflowEventRow[], failInserts = 0) {
  let remainingFailures = failInserts;
  const api = {
    from(table: string) {
      if (table !== "workflow_events") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        insert(payload: Record<string, unknown>) {
          if (payload.reference_entity === "equipment_checkout" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(payload.reference_id))) return Promise.resolve({ error: { message: "Equipment checkout reference must be a UUID" } });
          if (remainingFailures > 0) { remainingFailures -= 1; return Promise.resolve({ error: { message: "Simulated connection interruption" } }); }
          workflowEvents.push(payload as unknown as WorkflowEventRow);
          return Promise.resolve({ error: null });
        },
        select() {
          let rows = [...workflowEvents];

          const chain = {
            eq(column: keyof WorkflowEventRow, value: unknown) {
              rows = rows.filter((row) => (row[column] as unknown) === value);
              return chain;
            },
            in(column: keyof WorkflowEventRow, values: unknown[]) {
              rows = rows.filter((row) => values.includes(row[column]));
              return chain;
            },
            order(column: keyof WorkflowEventRow, options?: { ascending?: boolean }) {
              const ascending = options?.ascending ?? true;
              rows.sort((a, b) => {
                const left = String(a[column] ?? "");
                const right = String(b[column] ?? "");
                return ascending ? left.localeCompare(right) : right.localeCompare(left);
              });
              return chain;
            },
            limit(value: number) {
              return Promise.resolve({
                data: rows.slice(0, value),
                error: null,
              });
            },
          };

          return chain;
        },
      };
    },
  };

  return api;
}

function createWorkforceStub() {
  return {
    async getDashboard() {
      return {
        generatedAt: new Date().toISOString(),
        summary: {
          activeEmployees: 4,
          activeCrews: 1,
          employeesClockedIn: 4,
          employeesOffToday: 0,
          employeesLate: 0,
          employeesAbsent: 0,
          openAssignments: 1,
          laborCostToday: null,
          averageCrewUtilization: 0,
          laborCostSource: "unavailable",
        },
        intelligence: {
          scores: [],
          recommendations: [],
          timeline: [],
        },
        crewStatus: [{
          crewId: "crew-1",
          crewName: "Concrete Crew A",
          supervisorName: "Alex Foreman",
          currentProjectName: "Northpoint",
          employeeCount: 4,
          status: "working",
          shiftStatus: "working",
          shiftProgressPercent: 50,
          equipmentAssignedCount: 0,
          assignmentStatus: null,
        }],
        employeeStatus: [],
        dailyAssignments: [{
          assignmentId: "assign-1",
          title: "Slab prep",
          projectId: "project-1",
          projectName: "Northpoint",
          crewId: "crew-1",
          crewName: "Concrete Crew A",
          assignedEmployeeIds: [],
          assignedEmployeeNames: [],
          requiredHeadcount: 4,
          missingHeadcount: 0,
          status: "published",
          startTime: "07:00",
          endTime: "15:00",
        }],
        assignmentConflicts: [],
        crewTaskBoards: [],
        projectStaffing: [],
        projectOperations: [],
        commandCenter: {
          todaysWorkforce: {
            activeEmployees: 4,
            activeCrews: 1,
            openStaffingIssues: 0,
          },
          crewsRequiringAttention: [],
          projectsAtRisk: [],
          employeesRequiringAction: [],
          openStaffingIssues: [],
          todaysRisks: [],
          todaysOpportunities: [],
          criticalWorkforceAlerts: [],
          recommendedSupervisorActions: [],
          upcomingStaffingIssues: [],
          forecastedLaborShortages: [],
        },
        overdueItems: {
          lateEmployees: [],
          missingCheckIns: [],
          missingAssignments: [],
          safetyFlags: [],
          missingEquipment: [],
        },
        options: {
          crewOptions: [{ id: "crew-1", label: "Concrete Crew A" }],
          employeeOptions: [],
          supervisorOptions: [],
          assignmentOptions: [],
        },
        dailyOperations: [],
        jobsAtRisk: [],
        partialNotices: [],
        integrations: {
          gpsSync: "connected",
          timeClockSync: "connected",
          mobileSync: "connected",
        },
      };
    },
    async setCrewShiftStatus() {
      return;
    },
    async assignEquipmentToCrew() {
      return;
    },
  };
}

function createDailyReportsStub() {
  return {
    async getDashboard() {
      return {
        metrics: {
          reportsCreatedToday: 0,
          reportsPendingReview: 0,
          reportsSubmitted: 0,
          lateReports: 0,
          safetyIncidents: 0,
          delaysLogged: 0,
          laborHours: 0,
          weatherSnapshot: "Sunny",
        },
        analytics: {
          laborHours: 0,
          productionUnits: 0,
          delayEvents: 0,
          incidentCount: 0,
          completionRate: 0,
          averageSubmissionHours: 0,
        },
        weatherSnapshotText: "Sunny",
        projectOptions: [],
        superintendentOptions: [],
      };
    },
    async createDraftFromSchedule() {
      throw new Error("not needed in this test");
    },
    async createReport() {
      throw new Error("not needed in this test");
    },
  };
}

function createServiceHarness(workflowEvents: WorkflowEventRow[], queueProvider?: OfflineQueueProvider, failInserts = 0) {
  return createMobileFieldOperationsService({
    workforceService: createWorkforceStub() as never,
    dailyReportsService: createDailyReportsStub() as never,
    offlineQueue: queueProvider,
    supabaseClient: createWorkflowSupabaseStub(workflowEvents, failInserts) as never,
    resolveWorkspace: async () => ({
      context: {
        userId: "user-1",
        companyId: "company-1",
        role: "foreman",
        companyName: "Bango",
        companySlug: null,
        membershipId: null,
        membershipStatus: "active",
      },
      errorMessage: null,
      errorCode: null,
    }),
  });
}

async function main() {
  let passed = 0;
  let failed = 0;

  function check(condition: boolean, message: string) {
    if (condition) {
      passed += 1;
      console.log(`  + ${message}`);
    } else {
      failed += 1;
      console.error(`  x FAIL: ${message}`);
    }
  }

  await test("1. equipment checkouts persist across service instances", async () => {
    const events: WorkflowEventRow[] = [];
    const first = createServiceHarness(events);

    const checkout = await first.checkoutEquipment({
      crewId: "crew-1",
      equipmentIds: ["equip-101", "equip-102"],
      conditionNotes: "Fuel topped up",
    });

    const second = createServiceHarness(events);
    const dashboardAfterCheckout = await second.getForemanDashboard();
    const persistedCheckout = dashboardAfterCheckout.equipmentCheckouts.find((row) => row.id === checkout.id) || null;

    check(Boolean(persistedCheckout), "checkout is visible after creating a fresh service instance");
    check((persistedCheckout?.returnedAt || null) === null, "new checkout is marked as active");

    await second.returnEquipment({
      checkoutId: checkout.id,
      conditionNotes: "Returned clean",
    });

    const third = createServiceHarness(events);
    const dashboardAfterReturn = await third.getForemanDashboard();
    const returned = dashboardAfterReturn.equipmentCheckouts.find((row) => row.id === checkout.id) || null;

    check(Boolean(returned?.returnedAt), "equipment return persists and survives another instance refresh");
    check(returned?.conditionNotes === "Returned clean", "return notes are persisted for the checkout record");
  });

  await test("2. checklist persistence and queue status distinguish saved records", async () => {
    const events: WorkflowEventRow[] = [];
    const { queue, provider } = createQueueProvider();
    const first = createServiceHarness(events, provider);

    const checklist: DailyChecklist = {
      safetyBriefing: true,
      ppeVerification: true,
      equipmentInspection: false,
      dailyGoals: "Pour slab section B",
      supervisorNotes: "Watch wind conditions",
      updatedAt: null,
    };

    await first.saveDailyChecklist({
      crewId: "crew-1",
      checklist,
    });

    const second = createServiceHarness(events, provider);
    const dashboard = await second.getForemanDashboard();

    check(dashboard.checklistByCrew["crew-1"]?.dailyGoals === "Pour slab section B", "checklist data reloads from persisted workflow events");
    check(queue.length === 1, "a queue audit entry is recorded");
    check(queue[0]?.status === "synced", "saved checklist entry is marked as synced rather than queued");
  });


  await test("3. mobile reports preserve the selected crew and historical date draft", async () => {
    const baseDraft: DailyReportUpsertInput = {
      header: { projectId: "historical-project", projectName: "Historical job", date: "2026-11-03", shift: "night", superintendentId: "", superintendentName: "Historical supervisor", projectManagerName: "", weather: "mixed", temperatureF: 0, siteConditions: "dry", overallStatus: "draft" },
      schedulingPreload: { assignmentId: "historical-assignment", assignmentTitle: "Yesterday's work", plannedHours: 6, scheduledProjectId: "historical-project", scheduledProjectName: "Historical job", assignedCrewNames: ["Selected crew"], scheduledEmployees: ["Historical employee"], supervisor: "Historical supervisor" },
      labor: [{ id: "labor-1", crewName: "Selected crew", employeeName: "Historical employee", trade: "", scheduled: true, present: true, late: false, regularHours: 6, overtimeHours: 0, notes: "" }],
      workCompleted: [], materials: [], equipment: [], safety: [], delays: [], attachments: [], timeline: [], aiSummaryVersion: 1,
    };
    let created: DailyReportUpsertInput | null = null;
    const service = createMobileFieldOperationsService({
      workforceService: { getDashboard: async () => { throw new Error("Today's assignments must not choose a historical report's project."); } } as never,
      dailyReportsService: {
        createDraftFromSchedule: async (date: string, crewId?: string) => {
          check(date === "2026-11-03" && crewId === "crew-2", "draft lookup uses both the report date and selected crew");
          return baseDraft;
        },
        createReport: async (input: DailyReportUpsertInput) => { created = input; return { id: "report-1" }; },
      } as never,
      supabaseClient: createWorkflowSupabaseStub([]) as never,
    });
    await service.submitMobileDailyReport({ crewId: "crew-2", reportDate: "2026-11-03", status: "draft", draft: createEmptyMobileDailyReportDraft() });
    const saved = created as DailyReportUpsertInput | null;
    check(saved?.header.projectId === "historical-project" && saved?.header.superintendentName === "Historical supervisor", "project and supervisor stay aligned with the dated draft");
    check(saved?.schedulingPreload?.assignmentId === "historical-assignment" && saved?.labor[0]?.employeeName === "Historical employee", "labor and schedule evidence remain attached to the same assignment");
  });

  await test("4. missing crew assignments stop before report creation", async () => {
    let created = false;
    const service = createMobileFieldOperationsService({
      workforceService: createWorkforceStub() as never,
      dailyReportsService: {
        createDraftFromSchedule: async () => { throw new Error("No scheduled assignment matches this crew and report date."); },
        createReport: async () => { created = true; return { id: "unexpected" }; },
      } as never,
      supabaseClient: createWorkflowSupabaseStub([]) as never,
    });
    let rejected = false;
    try {
      await service.submitMobileDailyReport({ crewId: "crew-without-assignment", reportDate: "2026-11-03", status: "draft", draft: createEmptyMobileDailyReportDraft() });
    } catch { rejected = true; }
    check(rejected && !created, "an unmatched assignment cannot create a report for another crew's project");
  });


  await test("5. equipment condition notes survive queued checkout and return replay", async () => {
    const events: WorkflowEventRow[] = [];
    const { queue, provider } = createQueueProvider();
    const first = createServiceHarness(events, provider, 1);
    const checkout = await first.checkoutEquipment({ crewId: "crew-1", equipmentIds: ["equip-queued-notes"], conditionNotes: "Synthetic checkout: cracked handle, do not operate" });
    check(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(checkout.id), "checkout identity is compatible with the database UUID reference");
    check(queue[0]?.status === "queued", "interrupted checkout remains queued");
    const checkoutSync = await first.syncOfflineActions();
    check(checkoutSync.synced === 1 && checkoutSync.failed === 0, "queued checkout passes the persisted UUID reference boundary");
    const second = createServiceHarness(events, provider, 1);
    const afterCheckout = await second.getForemanDashboard();
    check(afterCheckout.equipmentCheckouts.find((row) => row.id === checkout.id)?.conditionNotes === "Synthetic checkout: cracked handle, do not operate", "checkout condition notes survive synchronization and reload");
    await second.returnEquipment({ checkoutId: checkout.id, conditionNotes: "Synthetic return: isolated for repair" });
    check(queue.some((item) => item.type === "equipment_return" && item.status === "queued"), "interrupted return remains queued");
    await second.syncOfflineActions();
    for (const event of events) event.occurred_at = "2026-11-04T18:00:00.000Z";
    const third = createServiceHarness(events, provider);
    const afterReturn = await third.getForemanDashboard();
    const returned = afterReturn.equipmentCheckouts.find((row) => row.id === checkout.id);
    check(Boolean(returned?.returnedAt) && returned?.conditionNotes === "Synthetic return: isolated for repair", "return condition notes survive synchronization and reload even with tied event timestamps");
  });


  await test("6. field actions distinguish server saves from queued recovery", async () => {
    const events: WorkflowEventRow[] = [];
    const { provider } = createQueueProvider();
    const checklist: DailyChecklist = { safetyBriefing: true, ppeVerification: false, equipmentInspection: false, dailyGoals: "Synthetic", supervisorNotes: "", updatedAt: null };
    const first = createServiceHarness(events, provider, 1);
    const queuedChecklist = await first.saveDailyChecklist({ crewId: "crew-1", checklist });
    check(queuedChecklist.persistenceState === "queued", "interrupted checklist reports pending synchronization");
    const savedCheckIn = await first.runCheckInAction({ crewId: "crew-1", action: "start_shift" });
    check(savedCheckIn.persistenceState === "saved", "persisted check-in reports a server save");
    const second = createServiceHarness(events, provider, 1);
    const queuedCheckIn = await second.runCheckInAction({ crewId: "crew-1", action: "end_shift" });
    check(queuedCheckIn.persistenceState === "queued", "interrupted check-in reports pending synchronization");
    const savedChecklist = await second.saveDailyChecklist({ crewId: "crew-1", checklist });
    check(savedChecklist.persistenceState === "saved", "persisted checklist reports a server save");
  });


  await test("7. overlapping synchronization shares one replay pass", async () => {
    const events: WorkflowEventRow[] = [];
    const { provider } = createQueueProvider();
    const service = createServiceHarness(events, provider, 1);
    await service.saveDailyChecklist({ crewId: "crew-1", checklist: { safetyBriefing: true, ppeVerification: false, equipmentInspection: false, dailyGoals: "Synthetic concurrency", supervisorNotes: "", updatedAt: null } });
    const results = await Promise.all([service.syncOfflineActions(), service.syncOfflineActions()]);
    check(results.every((result) => result.synced === 1 && result.failed === 0), "overlapping callers share a successful synchronization result");
    check(events.filter((event) => event.event_type === "mobile_field.checklist.saved").length === 1, "one queued action produces one persisted event");
    const next = await service.syncOfflineActions();
    check(next.synced === 0 && next.failed === 0, "a finished synchronization releases its lock for subsequent passes");
  });

  await test("8. failed synchronization releases its lock", async () => {
    const events: WorkflowEventRow[] = [];
    const { provider } = createQueueProvider();
    let interrupted = false;
    const service = createServiceHarness(events, {
      ...provider,
      async list() {
        if (!interrupted) { interrupted = true; throw new Error("Synthetic local storage interruption"); }
        return provider.list();
      },
    });
    let rejected = false;
    try { await service.syncOfflineActions(); } catch { rejected = true; }
    const recovered = await service.syncOfflineActions();
    check(rejected && recovered.synced === 0 && recovered.failed === 0, "storage failure does not leave future synchronization stuck");
  });

  console.log(`\nMobile field persistence results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function test(name: string, run: () => Promise<void>) {
  console.log(`\n${name}`);
  await run();
}

void main();
