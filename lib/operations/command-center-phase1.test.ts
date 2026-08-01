import { buildActivityFeed, buildAvailabilityMap, buildPendingDecisions, buildProjectStatusRows, buildSummaryMetrics, buildTodaySchedule, buildWorkforceBoard } from "./command-center-normalizer";
import { computePriorityRank, rankPriorityActionItems } from "./command-center-priority";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

async function main() {
  await test("1. priority ranking is deterministic", () => {
    const ranked = rankPriorityActionItems([
      {
        id: "task-overdue",
        title: "Overdue concrete task",
        sourceModule: "Tasks",
        severity: "high",
        projectName: "Project Oak",
        owner: "Alex",
        dueAt: "2026-08-01",
        ageHours: 18,
        recommendedAction: "Review",
        href: "/projects/p1",
        focus: "today",
      },
      {
        id: "approval",
        title: "Pending change order",
        sourceModule: "Approvals",
        severity: "high",
        projectName: "Project Oak",
        owner: null,
        dueAt: "2026-08-02",
        ageHours: 4,
        recommendedAction: "Approve",
        href: "/change-orders/co1",
        focus: "approvals",
      },
      {
        id: "critical-blocked",
        title: "Blocked task",
        sourceModule: "Tasks",
        severity: "critical",
        projectName: "Dock Expansion",
        owner: null,
        dueAt: "2026-08-01",
        ageHours: 6,
        recommendedAction: "Assign owner",
        href: "/projects/p2",
        focus: "workforce",
      },
    ]);

    assert(ranked[0].id === "critical-blocked", "critical blocked item ranks first");
    assert(computePriorityRank(ranked[0]) > computePriorityRank(ranked[1]), "rank scores are ordered deterministically");
  });

  await test("2. live vs partial availability is classified explicitly", () => {
    const availability = buildAvailabilityMap({
      hasLiveProjects: true,
      hasLiveTasks: true,
      hasLivePhotos: true,
      hasLiveApprovals: true,
      hasLiveProfiles: true,
      hasRealScheduling: false,
      hasRealWorkforce: false,
      hasOrionBrief: true,
    });

    assert(availability.summary === "live", "summary remains live when core project/task data exists");
    assert(availability.workforce === "partial", "workforce is marked partial without live crew service");
    assert(availability.schedule === "partial", "schedule is marked partial without live scheduling service");
    assert(availability.orionBrief === "live", "Orion brief is marked live when deterministic service exists");
  });

  await test("3. project risk ordering and workforce conflict detection work on supported inputs", () => {
    const rows = buildProjectStatusRows({
      projects: [
        { id: "p1", name: "Oak", customerId: "c1", status: "in_progress", estimatedEndDate: "2026-08-10", contractAmount: 100, estimatedCost: 80, description: "A" },
        { id: "p2", name: "Dock", customerId: "c2", status: "in_progress", estimatedEndDate: "2026-08-10", contractAmount: 100, estimatedCost: 80, description: "B" },
      ],
      customersById: new Map([
        ["c1", { id: "c1", companyName: "Customer A", firstName: null, lastName: null }],
        ["c2", { id: "c2", companyName: "Customer B", firstName: null, lastName: null }],
      ]),
      tasksByProject: new Map([
        ["p1", [{ id: "t1", projectId: "p1", title: "On track", status: "in_progress", completionPercentage: 70, plannedStart: "2026-08-01", plannedFinish: "2099-08-02", estimatedCompletionDate: null, assignedProfileId: "u1", phaseId: "ph1", actualHours: 2, estimatedHours: 4 }]],
        ["p2", [
          { id: "t2", projectId: "p2", title: "Blocked", status: "blocked", completionPercentage: 20, plannedStart: "2026-08-01", plannedFinish: "2026-01-01", estimatedCompletionDate: null, assignedProfileId: null, phaseId: "ph2", actualHours: null, estimatedHours: 4 },
          { id: "t3", projectId: "p2", title: "Overdue", status: "not_started", completionPercentage: 0, plannedStart: "2026-08-01", plannedFinish: "2026-01-01", estimatedCompletionDate: null, assignedProfileId: null, phaseId: "ph2", actualHours: null, estimatedHours: 4 },
        ]],
      ]),
      phasesById: new Map([
        ["ph1", { id: "ph1", projectId: "p1", name: "Framing", sortOrder: 0 }],
        ["ph2", { id: "ph2", projectId: "p2", name: "Concrete", sortOrder: 0 }],
      ]),
      photosByProject: new Map(),
      invoicesByProject: new Map(),
    });

    assert(rows[0].projectName === "Dock", "higher-risk project sorts first");

    const workforce = buildWorkforceBoard({
      tasks: [
        { id: "t1", projectId: "p1", title: "A", status: "in_progress", completionPercentage: 10, plannedStart: "2026-08-01", plannedFinish: "2026-08-01", estimatedCompletionDate: null, assignedProfileId: "u1", phaseId: "ph1", actualHours: 1, estimatedHours: 2 },
        { id: "t2", projectId: "p1", title: "B", status: "blocked", completionPercentage: 10, plannedStart: "2026-08-01", plannedFinish: "2026-08-01", estimatedCompletionDate: null, assignedProfileId: "u1", phaseId: "ph1", actualHours: 1, estimatedHours: 2 },
        { id: "t3", projectId: "p1", title: "C", status: "not_started", completionPercentage: 0, plannedStart: "2026-08-01", plannedFinish: "2026-08-01", estimatedCompletionDate: null, assignedProfileId: "u1", phaseId: "ph1", actualHours: 0, estimatedHours: 2 },
      ],
      projectNameById: new Map([["p1", "Oak"]]),
      phasesById: new Map([["ph1", { id: "ph1", projectId: "p1", name: "Framing", sortOrder: 0 }]]),
      profilesById: new Map([["u1", { id: "u1", firstName: "Alex", lastName: "Stone" }]]),
    });

    assert(workforce[0].status === "overloaded", "multiple active tasks flag overloaded workforce row");
    assert(workforce[0].hasConflict, "multiple active tasks flag conflict support where detectable");
  });

  await test("4. schedule grouping and activity ordering stay deterministic", () => {
    const schedule = buildTodaySchedule([
      { id: "t1", projectId: "p1", title: "Morning task", status: "in_progress", completionPercentage: 0, plannedStart: `${new Date().toISOString().slice(0, 10)}T09:00:00.000Z`, plannedFinish: null, estimatedCompletionDate: null, assignedProfileId: "u1", phaseId: null, actualHours: null, estimatedHours: null },
      { id: "t2", projectId: "p1", title: "Untimed task", status: "not_started", completionPercentage: 0, plannedStart: `${new Date().toISOString().slice(0, 10)}`, plannedFinish: null, estimatedCompletionDate: null, assignedProfileId: null, phaseId: null, actualHours: null, estimatedHours: null },
    ], new Map([["p1", "Oak"]]), new Date().toISOString().slice(0, 10));

    assert(schedule.some((item) => item.id === "task-t1" && item.period === "morning"), "timed task is grouped into the correct period");
    assert(schedule.some((item) => item.id === "task-t2" && item.period === "time_unavailable"), "date-only task is marked time unavailable");

    const feed = buildActivityFeed({
      photos: [
        { id: "ph-old", projectId: "p1", capturedAt: new Date(Date.now() - 60 * 60000).toISOString(), createdAt: new Date(Date.now() - 60 * 60000).toISOString(), uploadedBy: "u1" },
        { id: "ph-new", projectId: "p1", capturedAt: new Date(Date.now() - 10 * 60000).toISOString(), createdAt: new Date(Date.now() - 10 * 60000).toISOString(), uploadedBy: "u1" },
      ],
      invoices: [],
      changeOrders: [],
      profileNameById: new Map([["u1", "Alex Stone"]]),
      projectNameById: new Map([["p1", "Oak"]]),
    });

    assert(feed[0].id === "photo-ph-new", "activity feed sorts newest activity first via smaller minutes-ago value");
  });

  await test("5. summary metrics do not fabricate unavailable workforce or scheduling states", () => {
    const metrics = buildSummaryMetrics({
      projects: [],
      tasks: [],
      schedule: [],
      photos: [],
      changeOrders: [],
      workforceRows: [],
      equipment: [],
      todayIso: new Date().toISOString().slice(0, 10),
      alertCount: 0,
      workforceAvailability: "partial",
      scheduleAvailability: "partial",
    });

    const assignedWorkforce = metrics.find((metric) => metric.id === "assignedWorkforce");
    const scheduleEvents = metrics.find((metric) => metric.id === "scheduleEventsToday");

    assert(assignedWorkforce?.availability === "partial", "assigned workforce metric is explicitly marked partial");
    assert(scheduleEvents?.availability === "partial", "schedule events metric is explicitly marked partial");
  });

  await test("6. equipment metrics and pending decisions are deterministic and route-safe", () => {
    const metrics = buildSummaryMetrics({
      projects: [],
      tasks: [],
      schedule: [],
      photos: [],
      changeOrders: [],
      workforceRows: [],
      equipment: [
        { id: "eq1", equipmentNumber: "EQ-001", name: "Excavator", status: "active", maintenanceStatus: "current", assignedJobId: "p1", nextServiceDate: null },
        { id: "eq2", equipmentNumber: "EQ-002", name: "Loader", status: "active", maintenanceStatus: "due_soon", assignedJobId: null, nextServiceDate: "2026-08-03" },
        { id: "eq3", equipmentNumber: "EQ-003", name: "Dozer", status: "out_of_service", maintenanceStatus: "overdue", assignedJobId: "p2", nextServiceDate: "2026-08-01" },
      ],
      todayIso: new Date().toISOString().slice(0, 10),
      alertCount: 0,
      workforceAvailability: "partial",
      scheduleAvailability: "partial",
    });

    const metricMap = new Map(metrics.map((metric) => [metric.id, metric.value]));
    assert(metricMap.get("equipmentInUse") === 1, "equipment in-use metric counts active assigned equipment");
    assert(metricMap.get("equipmentMaintenanceDue") === 2, "equipment maintenance-due metric counts due_soon and overdue");
    assert(metricMap.get("equipmentConflicts") === 1, "equipment conflict metric counts maintenance/out_of_service conflict conditions");

    const decisions = buildPendingDecisions({
      tasks: [],
      projectNameById: new Map([
        ["p1", "Project Oak"],
        ["p2", "Project Dock"],
      ]),
      profileNameById: new Map(),
      changeOrders: [],
      estimates: [],
      invoices: [],
      equipment: [
        { id: "eq-a", equipmentNumber: "EQ-010", name: "Crane", status: "maintenance", maintenanceStatus: "current", assignedJobId: "p1", nextServiceDate: "2026-08-04" },
        { id: "eq-b", equipmentNumber: "EQ-011", name: "Forklift", status: "active", maintenanceStatus: "overdue", assignedJobId: "p2", nextServiceDate: "2026-08-02" },
      ],
    });

    assert(decisions.length === 2, "equipment decision items are generated for conflict/overdue cases");
    assert(decisions[0].decisionType === "equipment", "equipment decision type is preserved");
    assert(decisions[0].href === "/equipment/eq-b", "equipment decision item routes to equipment detail");
    assert(decisions[0].severity === "critical", "overdue maintenance equipment decision sorts ahead as critical");
    assert(decisions[1].severity === "high", "maintenance status equipment decision ranks below critical");
  });

  await test("7. equipment metrics remain present with zero values when equipment is empty", () => {
    const metrics = buildSummaryMetrics({
      projects: [],
      tasks: [],
      schedule: [],
      photos: [],
      changeOrders: [],
      workforceRows: [],
      equipment: [],
      todayIso: new Date().toISOString().slice(0, 10),
      alertCount: 0,
      workforceAvailability: "partial",
      scheduleAvailability: "partial",
    });

    const metricMap = new Map(metrics.map((metric) => [metric.id, metric.value]));
    assert(metricMap.get("equipmentInUse") === 0, "equipment in-use metric does not fabricate non-zero values");
    assert(metricMap.get("equipmentMaintenanceDue") === 0, "maintenance-due metric does not fabricate non-zero values");
    assert(metricMap.get("equipmentConflicts") === 0, "conflict metric does not fabricate non-zero values");
  });

  await test("8. operations hook refresh dependency remains data-agnostic to prevent reload loops", () => {
    const hookPath = join(process.cwd(), "lib", "operations", "use-operations-command-center.ts");
    const source = readFileSync(hookPath, "utf8");

    assert(source.includes("const hasDataRef = useRef(false);"), "hook tracks presence of data via ref");
    assert(source.includes("const preserveData = options?.preserveData ?? hasDataRef.current;"), "refresh default preserve behavior uses stable ref");
    assert(source.includes("}, [localeTag, supabase, t]);"), "refresh callback dependencies exclude data state");
  });

  console.log(`\nOperations Command Center Phase 1 results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();