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
    },
  };
}

function createWorkflowSupabaseStub(workflowEvents: WorkflowEventRow[]) {
  const api = {
    from(table: string) {
      if (table !== "workflow_events") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        insert(payload: Record<string, unknown>) {
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

function createServiceHarness(workflowEvents: WorkflowEventRow[], queueProvider?: OfflineQueueProvider) {
  return createMobileFieldOperationsService({
    workforceService: createWorkforceStub() as never,
    dailyReportsService: createDailyReportsStub() as never,
    offlineQueue: queueProvider,
    supabaseClient: createWorkflowSupabaseStub(workflowEvents) as never,
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
