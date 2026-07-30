import { buildDeterministicDailySummary } from "./ai-summary";
import type {
  DailyReport,
  DailyReportAnalytics,
  DailyReportDashboardPayload,
  DailyReportFilters,
  DailyReportListResult,
  DailyReportStatus,
  DailyReportUpsertInput,
  LaborEntry,
  LaborTotals,
  SchedulingPreload,
} from "./types";
import { createSchedulingService } from "@/lib/scheduling";

const STORAGE_KEY = "bangoos.mock.dailyReports.v1";

const superintendentDirectory = [
  { id: "sup-001", name: "Maya Rivera", manager: "Jordan Price" },
  { id: "sup-002", name: "Daniel Ortiz", manager: "Camila Reyes" },
  { id: "sup-003", name: "Nate McCall", manager: "Jordan Price" },
] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dayOffset(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function calculateLaborTotals(labor: LaborEntry[]): LaborTotals {
  const scheduledWorkers = labor.filter((item) => item.scheduled).length;
  const presentWorkers = labor.filter((item) => item.present).length;
  const lateWorkers = labor.filter((item) => item.late).length;
  const overtimeWorkers = labor.filter((item) => item.overtimeHours > 0).length;
  const totalLaborHours = labor.reduce((acc, item) => acc + item.regularHours + item.overtimeHours, 0);

  return {
    scheduledWorkers,
    presentWorkers,
    absentWorkers: Math.max(scheduledWorkers - presentWorkers, 0),
    lateWorkers,
    overtimeWorkers,
    totalLaborHours: Number(totalLaborHours.toFixed(2)),
  };
}

function seedReports(): DailyReport[] {
  const base: DailyReport[] = [
    {
      id: "dr-001",
      reportNumber: "DR-2401",
      header: {
        projectId: "prj-101",
        projectName: "Northpoint Medical Center",
        date: dayOffset(0),
        shift: "day",
        superintendentId: "sup-002",
        superintendentName: "Daniel Ortiz",
        projectManagerName: "Camila Reyes",
        weather: "sunny",
        temperatureF: 92,
        siteConditions: "dry",
        overallStatus: "submitted",
      },
      schedulingPreload: {
        assignmentId: "asg-001",
        assignmentTitle: "Tower B slab pour",
        plannedHours: 72,
        scheduledProjectId: "prj-101",
        scheduledProjectName: "Northpoint Medical Center",
        assignedCrewNames: ["Concrete Crew Alpha"],
        scheduledEmployees: ["Maya Rivera", "Liam Patel", "Marcus Johnson", "Naomi Brooks"],
        supervisor: "Daniel Ortiz",
      },
      labor: [
        { id: "l-1", crewName: "Concrete Crew Alpha", employeeName: "Liam Patel", trade: "General Labor", scheduled: true, present: true, late: false, regularHours: 8, overtimeHours: 1, notes: "Pump staging" },
        { id: "l-2", crewName: "Concrete Crew Alpha", employeeName: "Marcus Johnson", trade: "Concrete Finisher", scheduled: true, present: true, late: false, regularHours: 9, overtimeHours: 0, notes: "Finish pass" },
        { id: "l-3", crewName: "Concrete Crew Alpha", employeeName: "Naomi Brooks", trade: "Concrete Finisher", scheduled: true, present: true, late: true, regularHours: 8, overtimeHours: 0.5, notes: "30m late" },
      ],
      laborTotals: { scheduledWorkers: 0, presentWorkers: 0, absentWorkers: 0, lateWorkers: 0, overtimeWorkers: 0, totalLaborHours: 0 },
      workCompleted: [
        { id: "w-1", activity: "Deck pour zone A", quantity: 420, unit: "sqft", percentComplete: 100, productionNotes: "Passed finish inspection", milestoneCompleted: true },
        { id: "w-2", activity: "Rebar tie-in", quantity: 34, unit: "pcs", percentComplete: 85, productionNotes: "Hold for final tie", milestoneCompleted: false },
      ],
      materials: [
        { id: "m-1", delivery: "Ready mix truck 17", supplier: "Atlas Mix", quantity: 28, unit: "yd3", receivedTime: "08:15", shortages: false, rejected: false, notes: "On spec" },
      ],
      safety: [
        { id: "s-1", type: "toolbox_talk", attendees: 18, severity: "low", status: "resolved", notes: "Heat stress controls reviewed" },
        { id: "s-2", type: "ppe", attendees: 0, severity: "medium", status: "monitoring", notes: "Two eye-protection reminders" },
      ],
      delays: [
        { id: "d-1", category: "weather", durationHours: 0.75, description: "Morning fog hold", impact: "Pour start delayed", correctiveAction: "Shifted manpower to prep" },
      ],
      attachments: [
        { id: "a-1", fileName: "deck-pour-a.jpg", caption: "Zone A finish", category: "progress", uploadedAt: nowIso() },
      ],
      timeline: [
        { id: "t-1", happenedAt: `${dayOffset(0)}T06:10:00Z`, eventType: "crew_arrival", description: "Concrete crew checked in" },
        { id: "t-2", happenedAt: `${dayOffset(0)}T08:15:00Z`, eventType: "delivery", description: "Ready mix truck arrival" },
        { id: "t-3", happenedAt: `${dayOffset(0)}T16:20:00Z`, eventType: "shift_complete", description: "Deck pour shift wrapped" },
      ],
      aiSummary: "",
      aiSummaryVersion: 1,
      submittedAt: nowIso(),
      reviewedAt: null,
      approvedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "dr-002",
      reportNumber: "DR-2400",
      header: {
        projectId: "prj-104",
        projectName: "Project Oak",
        date: dayOffset(-1),
        shift: "day",
        superintendentId: "sup-001",
        superintendentName: "Maya Rivera",
        projectManagerName: "Jordan Price",
        weather: "cloudy",
        temperatureF: 86,
        siteConditions: "wet",
        overallStatus: "reviewed",
      },
      schedulingPreload: null,
      labor: [
        { id: "l-4", crewName: "Electrical Crew North", employeeName: "Priya Menon", trade: "Electrician", scheduled: true, present: true, late: false, regularHours: 8, overtimeHours: 0, notes: "Panel room" },
        { id: "l-5", crewName: "Electrical Crew North", employeeName: "Aaliyah Price", trade: "Electrician", scheduled: true, present: false, late: false, regularHours: 0, overtimeHours: 0, notes: "Sick" },
      ],
      laborTotals: { scheduledWorkers: 0, presentWorkers: 0, absentWorkers: 0, lateWorkers: 0, overtimeWorkers: 0, totalLaborHours: 0 },
      workCompleted: [
        { id: "w-3", activity: "Rough-in branch circuits", quantity: 560, unit: "lf", percentComplete: 70, productionNotes: "Awaiting conduit delivery", milestoneCompleted: false },
      ],
      materials: [
        { id: "m-2", delivery: "Conduit pallets", supplier: "Metro Electric", quantity: 24, unit: "bundles", receivedTime: "11:10", shortages: true, rejected: false, notes: "Short 2 bundles" },
      ],
      safety: [
        { id: "s-3", type: "inspection", attendees: 0, severity: "low", status: "resolved", notes: "Housekeeping pass" },
      ],
      delays: [
        { id: "d-2", category: "material", durationHours: 1.5, description: "Conduit shortage", impact: "Reduced output lane C", correctiveAction: "Re-sequenced pulls" },
      ],
      attachments: [],
      timeline: [
        { id: "t-4", happenedAt: `${dayOffset(-1)}T07:02:00Z`, eventType: "crew_arrival", description: "Electrical crew start" },
      ],
      aiSummary: "",
      aiSummaryVersion: 1,
      submittedAt: nowIso(),
      reviewedAt: nowIso(),
      approvedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "dr-003",
      reportNumber: "DR-2399",
      header: {
        projectId: "prj-103",
        projectName: "Dock Expansion",
        date: dayOffset(-2),
        shift: "night",
        superintendentId: "sup-003",
        superintendentName: "Nate McCall",
        projectManagerName: "Camila Reyes",
        weather: "rain",
        temperatureF: 79,
        siteConditions: "muddy",
        overallStatus: "approved",
      },
      schedulingPreload: null,
      labor: [
        { id: "l-6", crewName: "Mechanical Installation Crew", employeeName: "Hudson Clark", trade: "HVAC Technician", scheduled: true, present: true, late: false, regularHours: 8, overtimeHours: 2, notes: "Shutdown tie-in" },
      ],
      laborTotals: { scheduledWorkers: 0, presentWorkers: 0, absentWorkers: 0, lateWorkers: 0, overtimeWorkers: 0, totalLaborHours: 0 },
      workCompleted: [
        { id: "w-4", activity: "Tie-in completed", quantity: 1, unit: "ea", percentComplete: 100, productionNotes: "Verified by QA", milestoneCompleted: true },
      ],
      materials: [],
      safety: [
        { id: "s-4", type: "incident", attendees: 0, severity: "high", status: "resolved", notes: "Minor hand laceration first aid only" },
      ],
      delays: [
        { id: "d-3", category: "inspection", durationHours: 0.5, description: "Inspector late arrival", impact: "Hold on startup", correctiveAction: "Updated sequence" },
      ],
      attachments: [
        { id: "a-2", fileName: "mechanical-tie-in.png", caption: "Completed tie-in", category: "quality", uploadedAt: nowIso() },
      ],
      timeline: [
        { id: "t-5", happenedAt: `${dayOffset(-2)}T18:05:00Z`, eventType: "crew_arrival", description: "Night shift mobilized" },
      ],
      aiSummary: "",
      aiSummaryVersion: 1,
      submittedAt: nowIso(),
      reviewedAt: nowIso(),
      approvedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "dr-004",
      reportNumber: "DR-2402",
      header: {
        projectId: "prj-105",
        projectName: "Barton Creek Clubhouse",
        date: dayOffset(0),
        shift: "day",
        superintendentId: "sup-001",
        superintendentName: "Maya Rivera",
        projectManagerName: "Jordan Price",
        weather: "mixed",
        temperatureF: 90,
        siteConditions: "windy",
        overallStatus: "draft",
      },
      schedulingPreload: null,
      labor: [
        { id: "l-7", crewName: "Finish Carpentry Team", employeeName: "Avery Singh", trade: "Carpenter", scheduled: true, present: true, late: false, regularHours: 4, overtimeHours: 0, notes: "AM trim set" },
      ],
      laborTotals: { scheduledWorkers: 0, presentWorkers: 0, absentWorkers: 0, lateWorkers: 0, overtimeWorkers: 0, totalLaborHours: 0 },
      workCompleted: [
        { id: "w-5", activity: "Millwork prep", quantity: 12, unit: "ea", percentComplete: 40, productionNotes: "Awaiting final dimensions", milestoneCompleted: false },
      ],
      materials: [],
      safety: [],
      delays: [],
      attachments: [],
      timeline: [],
      aiSummary: "",
      aiSummaryVersion: 1,
      submittedAt: null,
      reviewedAt: null,
      approvedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  return base.map((report) => {
    const withTotals = {
      ...report,
      laborTotals: calculateLaborTotals(report.labor),
    };

    return {
      ...withTotals,
      aiSummary: buildDeterministicDailySummary(withTotals),
    };
  });
}

let stateCache: DailyReport[] | null = null;

function loadState() {
  if (stateCache) {
    return stateCache;
  }

  const seeded = seedReports();

  if (typeof window === "undefined") {
    stateCache = seeded;
    return stateCache;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    stateCache = seeded;
    return stateCache;
  }

  try {
    const parsed = JSON.parse(raw) as DailyReport[];
    stateCache = parsed;
    return stateCache;
  } catch {
    stateCache = seeded;
    return stateCache;
  }
}

function persistState(next: DailyReport[]) {
  stateCache = next;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}

function applySort(items: DailyReport[], sortBy: DailyReportFilters["sortBy"]) {
  const copy = [...items];

  if (sortBy === "date_desc") {
    return copy.sort((a, b) => b.header.date.localeCompare(a.header.date));
  }

  if (sortBy === "date_asc") {
    return copy.sort((a, b) => a.header.date.localeCompare(b.header.date));
  }

  if (sortBy === "project_asc") {
    return copy.sort((a, b) => a.header.projectName.localeCompare(b.header.projectName));
  }

  return copy.sort((a, b) => a.header.overallStatus.localeCompare(b.header.overallStatus));
}

export function toUpsertInput(report: DailyReport): DailyReportUpsertInput {
  return {
    header: deepClone(report.header),
    schedulingPreload: deepClone(report.schedulingPreload),
    labor: deepClone(report.labor),
    workCompleted: deepClone(report.workCompleted),
    materials: deepClone(report.materials),
    safety: deepClone(report.safety),
    delays: deepClone(report.delays),
    attachments: deepClone(report.attachments),
    timeline: deepClone(report.timeline),
    aiSummaryVersion: report.aiSummaryVersion,
  };
}

function hydrateFromInput(base: Pick<DailyReport, "id" | "reportNumber" | "createdAt" | "submittedAt" | "reviewedAt" | "approvedAt">, input: DailyReportUpsertInput): DailyReport {
  const laborTotals = calculateLaborTotals(input.labor);
  const now = nowIso();

  const next: DailyReport = {
    id: base.id,
    reportNumber: base.reportNumber,
    header: deepClone(input.header),
    schedulingPreload: deepClone(input.schedulingPreload),
    labor: deepClone(input.labor),
    laborTotals,
    workCompleted: deepClone(input.workCompleted),
    materials: deepClone(input.materials),
    safety: deepClone(input.safety),
    delays: deepClone(input.delays),
    attachments: deepClone(input.attachments),
    timeline: deepClone(input.timeline),
    aiSummary: "",
    aiSummaryVersion: input.aiSummaryVersion,
    submittedAt: base.submittedAt,
    reviewedAt: base.reviewedAt,
    approvedAt: base.approvedAt,
    createdAt: base.createdAt,
    updatedAt: now,
  };

  next.aiSummary = buildDeterministicDailySummary(next);
  return next;
}

export async function listDailyReports(filters: DailyReportFilters): Promise<DailyReportListResult> {
  const source = loadState();
  const query = filters.query.trim().toLowerCase();

  const filtered = source.filter((item) => {
    const matchesDate = !filters.date || item.header.date === filters.date;
    const matchesProject = filters.projectId === "all" || item.header.projectId === filters.projectId;
    const matchesSuperintendent = filters.superintendentId === "all" || item.header.superintendentId === filters.superintendentId;
    const matchesStatus = filters.status === "all" || item.header.overallStatus === filters.status;
    const matchesQuery = !query
      || item.reportNumber.toLowerCase().includes(query)
      || item.header.projectName.toLowerCase().includes(query)
      || item.header.superintendentName.toLowerCase().includes(query);

    return matchesDate && matchesProject && matchesSuperintendent && matchesStatus && matchesQuery;
  });

  const sorted = applySort(filtered, filters.sortBy);
  const total = sorted.length;
  const totalPages = Math.max(Math.ceil(total / filters.pageSize), 1);
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    items: sorted.slice(start, start + filters.pageSize),
    total,
    totalPages,
    page,
    pageSize: filters.pageSize,
  };
}

export async function getDailyReportById(reportId: string): Promise<DailyReport | null> {
  const source = loadState();
  return deepClone(source.find((item) => item.id === reportId) || null);
}

function applyStatusTransition(report: DailyReport, status: DailyReportStatus) {
  const now = nowIso();
  report.header.overallStatus = status;

  if (status === "submitted" && !report.submittedAt) {
    report.submittedAt = now;
  }

  if (status === "reviewed" && !report.reviewedAt) {
    report.reviewedAt = now;
  }

  if (status === "approved" && !report.approvedAt) {
    report.approvedAt = now;
  }
}

export async function createDailyReport(input: DailyReportUpsertInput, status: DailyReportStatus): Promise<DailyReport> {
  const source = loadState();
  const reportNumber = `DR-${String(2400 + source.length + 1)}`;
  const now = nowIso();
  const base = {
    id: createId("dr"),
    reportNumber,
    createdAt: now,
    submittedAt: null,
    reviewedAt: null,
    approvedAt: null,
  };

  const next = hydrateFromInput(base, { ...input, header: { ...input.header, overallStatus: status } });
  applyStatusTransition(next, status);
  persistState([next, ...source]);
  return deepClone(next);
}

export async function updateDailyReport(reportId: string, input: DailyReportUpsertInput, status: DailyReportStatus): Promise<DailyReport | null> {
  const source = loadState();
  const index = source.findIndex((item) => item.id === reportId);

  if (index < 0) {
    return null;
  }

  const current = source[index];
  const next = hydrateFromInput(
    {
      id: current.id,
      reportNumber: current.reportNumber,
      createdAt: current.createdAt,
      submittedAt: current.submittedAt,
      reviewedAt: current.reviewedAt,
      approvedAt: current.approvedAt,
    },
    { ...input, header: { ...input.header, overallStatus: status } },
  );

  applyStatusTransition(next, status);

  const updated = [...source];
  updated[index] = next;
  persistState(updated);
  return deepClone(next);
}

export async function regenerateDailyReportSummary(reportId: string): Promise<DailyReport | null> {
  const source = loadState();
  const index = source.findIndex((item) => item.id === reportId);

  if (index < 0) {
    return null;
  }

  const current = source[index];
  const next = {
    ...current,
    aiSummaryVersion: current.aiSummaryVersion + 1,
    updatedAt: nowIso(),
  };
  next.aiSummary = buildDeterministicDailySummary(next);

  const updated = [...source];
  updated[index] = next;
  persistState(updated);
  return deepClone(next);
}

export async function getDailyReportDashboardPayload(): Promise<DailyReportDashboardPayload> {
  const source = loadState();
  const today = todayIso();
  const previousDay = dayOffset(-1);

  const reportsCreatedToday = source.filter((item) => item.header.date === today).length;
  const reportsPendingReview = source.filter((item) => item.header.overallStatus === "submitted").length;
  const reportsSubmitted = source.filter((item) => item.header.overallStatus === "submitted" || item.header.overallStatus === "reviewed" || item.header.overallStatus === "approved").length;
  const lateReports = source.filter((item) => item.header.date < previousDay && item.header.overallStatus === "draft").length;
  const safetyIncidents = source.reduce((acc, item) => acc + item.safety.filter((entry) => entry.type === "incident" || entry.type === "near_miss").length, 0);
  const delaysLogged = source.reduce((acc, item) => acc + item.delays.length, 0);
  const laborHours = source.reduce((acc, item) => acc + item.laborTotals.totalLaborHours, 0);
  const weatherSnapshotText = source.find((item) => item.header.date === today)?.header.weather || "mixed";

  const analytics: DailyReportAnalytics = {
    laborHours: Number(laborHours.toFixed(1)),
    productionUnits: Number(source.flatMap((item) => item.workCompleted).reduce((acc, item) => acc + item.quantity, 0).toFixed(1)),
    delayEvents: delaysLogged,
    incidentCount: safetyIncidents,
    completionRate: source.length === 0 ? 0 : Math.round((reportsSubmitted / source.length) * 100),
    averageSubmissionHours: 3.8,
  };

  const projectOptions = Array.from(
    new Map(source.map((item) => [item.header.projectId, { id: item.header.projectId, name: item.header.projectName }])).values(),
  );

  return {
    metrics: {
      reportsCreatedToday,
      reportsPendingReview,
      reportsSubmitted,
      lateReports,
      safetyIncidents,
      delaysLogged,
      laborHours: Number(laborHours.toFixed(1)),
      weatherSnapshot: weatherSnapshotText,
    },
    analytics,
    weatherSnapshotText,
    projectOptions,
    superintendentOptions: superintendentDirectory.map((item) => ({ id: item.id, name: item.name })),
  };
}

export async function createDraftFromSchedule(date: string): Promise<DailyReportUpsertInput> {
  const scheduling = createSchedulingService();
  const schedulingPayload = await scheduling.getScheduling();
  const assignment = schedulingPayload.assignments.find((item) => item.date === date) || schedulingPayload.assignments[0];

  const superintendent = superintendentDirectory.find((item) => item.name === assignment.scope.supervisor)
    || superintendentDirectory[0];

  const schedulingPreload: SchedulingPreload = {
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    plannedHours: assignment.plannedLaborHours,
    scheduledProjectId: assignment.scope.projectId,
    scheduledProjectName: assignment.scope.projectName,
    assignedCrewNames: assignment.assignedCrewIds.map((crewId) => schedulingPayload.crewOptions.find((crew) => crew.id === crewId)?.name || crewId),
    scheduledEmployees: assignment.assignedEmployeeIds.map((employeeId) => schedulingPayload.employeeOptions.find((employee) => employee.id === employeeId)?.name || employeeId),
    supervisor: assignment.scope.supervisor,
  };

  const labor = assignment.assignedEmployeeIds.length > 0
    ? assignment.assignedEmployeeIds.map((employeeId, index) => {
      const employee = schedulingPayload.employeeOptions.find((item) => item.id === employeeId);
      return {
        id: createId("labor"),
        crewName: assignment.assignedCrewIds
          .map((crewId) => schedulingPayload.crewOptions.find((crew) => crew.id === crewId)?.name || crewId)
          .join(", "),
        employeeName: employee?.name || `Worker ${index + 1}`,
        trade: employee?.trade || assignment.requiredTrade,
        scheduled: true,
        present: true,
        late: false,
        regularHours: Math.min(8, assignment.plannedLaborHours / Math.max(assignment.requiredHeadcount, 1)),
        overtimeHours: 0,
        notes: "",
      };
    })
    : [
      {
        id: createId("labor"),
        crewName: assignment.assignedCrewIds
          .map((crewId) => schedulingPayload.crewOptions.find((crew) => crew.id === crewId)?.name || crewId)
          .join(", "),
        employeeName: "",
        trade: assignment.requiredTrade,
        scheduled: true,
        present: true,
        late: false,
        regularHours: 8,
        overtimeHours: 0,
        notes: "",
      },
    ];

  return {
    header: {
      projectId: assignment.scope.projectId,
      projectName: assignment.scope.projectName,
      date,
      shift: assignment.shift,
      superintendentId: superintendent.id,
      superintendentName: superintendent.name,
      projectManagerName: superintendent.manager,
      weather: "sunny",
      temperatureF: 88,
      siteConditions: "dry",
      overallStatus: "draft",
    },
    schedulingPreload,
    labor,
    workCompleted: [
      {
        id: createId("work"),
        activity: assignment.title,
        quantity: Math.max(assignment.requiredHeadcount * 10, 10),
        unit: "units",
        percentComplete: 0,
        productionNotes: "",
        milestoneCompleted: false,
      },
    ],
    materials: [],
    safety: [
      {
        id: createId("safe"),
        type: "toolbox_talk",
        attendees: assignment.assignedEmployeeIds.length,
        severity: "low",
        status: "monitoring",
        notes: "",
      },
    ],
    delays: [],
    attachments: [],
    timeline: [
      {
        id: createId("time"),
        happenedAt: `${date}T06:30:00Z`,
        eventType: "crew_arrival",
        description: assignment.title,
      },
    ],
    aiSummaryVersion: 1,
  };
}
