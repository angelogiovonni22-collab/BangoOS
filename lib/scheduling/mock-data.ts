import type {
  AssignmentDraft,
  DispatchResource,
  OpenShift,
  ResourceAvailability,
  ScheduleAssignment,
  SchedulingAnalytics,
  SchedulingInsight,
  SchedulingPayload,
  TimeOffEntry,
} from "./types";
import { buildScheduleHealth, detectSchedulingConflicts } from "./conflict-engine";

const STORAGE_KEY = "bangoos.mock.scheduling.v1";

type SchedulingState = {
  assignments: ScheduleAssignment[];
  dispatch: DispatchResource[];
  openShifts: OpenShift[];
  availability: ResourceAvailability[];
  insights: SchedulingInsight[];
  timeOff: TimeOffEntry[];
};

const projects = [
  { id: "prj-101", name: "Northpoint Medical Center", location: "Austin Medical District" },
  { id: "prj-102", name: "Harper Residence", location: "Cedar Park" },
  { id: "prj-103", name: "Dock Expansion", location: "Pflugerville Logistics Zone" },
  { id: "prj-104", name: "Project Oak", location: "Round Rock" },
  { id: "prj-105", name: "Barton Creek Clubhouse", location: "Westlake Hills" },
] as const;

const crewDirectory = [
  { id: "crew-001", name: "Concrete Crew Alpha", trade: "Concrete Finisher", lead: "Marcus Johnson", supervisor: "Daniel Ortiz" },
  { id: "crew-003", name: "Electrical Crew North", trade: "Electrician", lead: "Priya Menon", supervisor: "Camila Reyes" },
  { id: "crew-004", name: "Finish Carpentry Team", trade: "Carpenter", lead: "Avery Singh", supervisor: "Daniel Ortiz" },
  { id: "crew-005", name: "Sitework Crew Bravo", trade: "General Labor", lead: "Ethan Cole", supervisor: "Nate McCall" },
  { id: "crew-006", name: "Mechanical Installation Crew", trade: "HVAC Technician", lead: "Hudson Clark", supervisor: "Camila Reyes" },
  { id: "crew-002", name: "Steel Erection Team", trade: "Ironworker", lead: "Sofia Alvarez", supervisor: "Camila Reyes" },
] as const;

const employeeDirectory = [
  { id: "emp-001", name: "Maya Rivera", trade: "Superintendent", crewId: "crew-001" },
  { id: "emp-003", name: "Avery Singh", trade: "Carpenter", crewId: "crew-004" },
  { id: "emp-005", name: "Ethan Cole", trade: "Safety Manager", crewId: "crew-005" },
  { id: "emp-007", name: "Liam Patel", trade: "General Labor", crewId: "crew-001" },
  { id: "emp-008", name: "Sofia Alvarez", trade: "Ironworker", crewId: "crew-002" },
  { id: "emp-009", name: "Marcus Johnson", trade: "Concrete Finisher", crewId: "crew-001" },
  { id: "emp-010", name: "Elena Torres", trade: "General Labor", crewId: "crew-005" },
  { id: "emp-012", name: "Priya Menon", trade: "Electrician", crewId: "crew-003" },
  { id: "emp-013", name: "Hudson Clark", trade: "HVAC Technician", crewId: "crew-006" },
  { id: "emp-014", name: "Naomi Brooks", trade: "Concrete Finisher", crewId: "crew-001" },
  { id: "emp-015", name: "Diego Navarro", trade: "Equipment Operator", crewId: "crew-003" },
  { id: "emp-016", name: "Grace Whitman", trade: "Carpenter", crewId: "crew-004" },
  { id: "emp-017", name: "Trevor Scott", trade: "Plumber", crewId: "crew-006" },
  { id: "emp-018", name: "Aaliyah Price", trade: "Electrician", crewId: "crew-003" },
  { id: "emp-019", name: "Mateo Ramirez", trade: "General Labor", crewId: "crew-005" },
  { id: "emp-020", name: "Ivy Larson", trade: "Safety Manager", crewId: "crew-005" },
] as const;

function dayOffset(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

const seededState: SchedulingState = {
  assignments: [
    {
      id: "asg-001",
      title: "Tower B slab pour",
      type: "project_work",
      status: "published",
      shift: "day",
      priority: "critical",
      date: dayOffset(0),
      startTime: "06:30",
      endTime: "15:30",
      plannedStart: `${dayOffset(0)}T06:30:00Z`,
      plannedEnd: `${dayOffset(0)}T15:30:00Z`,
      plannedLaborHours: 72,
      requiredHeadcount: 8,
      requiredTrade: "Concrete Finisher",
      assignedCrewIds: ["crew-001"],
      assignedEmployeeIds: ["emp-001", "emp-007", "emp-009", "emp-014"],
      scope: {
        projectId: "prj-101",
        projectName: "Northpoint Medical Center",
        location: "Tower B Deck",
        supervisor: "Daniel Ortiz",
      },
      notes: "Heat mitigation tent required by 2 PM.",
      travelTimeMinutes: 35,
      recurrence: { enabled: false, frequency: "weekly", interval: 1, endDate: null },
      safetyRequirement: "Daily JHA and hydration checks",
      certificationRequirement: "ACI Flatwork",
      equipment: {
        requiredEquipment: ["Laser Screed", "Power Trowel"],
        assignedEquipment: ["Laser Screed"],
        operatorRequired: true,
      },
      isOpenShift: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "asg-002",
      title: "MEP rough-in Zone 3",
      type: "project_work",
      status: "published",
      shift: "day",
      priority: "high",
      date: dayOffset(1),
      startTime: "07:00",
      endTime: "17:30",
      plannedStart: `${dayOffset(1)}T07:00:00Z`,
      plannedEnd: `${dayOffset(1)}T17:30:00Z`,
      plannedLaborHours: 84,
      requiredHeadcount: 7,
      requiredTrade: "Electrician",
      assignedCrewIds: ["crew-003"],
      assignedEmployeeIds: ["emp-012", "emp-015", "emp-018"],
      scope: {
        projectId: "prj-104",
        projectName: "Project Oak",
        location: "Zone 3 Service Corridor",
        supervisor: "Camila Reyes",
      },
      notes: "Coordinate with inspection prep at 15:00.",
      travelTimeMinutes: 48,
      recurrence: { enabled: true, frequency: "weekly", interval: 1, endDate: dayOffset(28) },
      safetyRequirement: "Lockout-tagout controls",
      certificationRequirement: "NFPA 70E",
      equipment: {
        requiredEquipment: ["Thermal Camera"],
        assignedEquipment: [],
        operatorRequired: false,
      },
      isOpenShift: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "asg-003",
      title: "Shutdown tie-in",
      type: "maintenance",
      status: "published",
      shift: "night",
      priority: "critical",
      date: dayOffset(2),
      startTime: "18:00",
      endTime: "05:30",
      plannedStart: `${dayOffset(2)}T18:00:00Z`,
      plannedEnd: `${dayOffset(3)}T05:30:00Z`,
      plannedLaborHours: 92,
      requiredHeadcount: 9,
      requiredTrade: "HVAC Technician",
      assignedCrewIds: ["crew-006"],
      assignedEmployeeIds: ["emp-013", "emp-017"],
      scope: {
        projectId: "prj-103",
        projectName: "Dock Expansion",
        location: "Mechanical Room North",
        supervisor: "Camila Reyes",
      },
      notes: "Night access permit required.",
      travelTimeMinutes: 92,
      recurrence: { enabled: false, frequency: "weekly", interval: 1, endDate: null },
      safetyRequirement: "Confined space permit",
      certificationRequirement: "Lockout/Tagout",
      equipment: {
        requiredEquipment: ["Scissor Lift", "Pipe Threader"],
        assignedEquipment: ["Scissor Lift"],
        operatorRequired: true,
      },
      isOpenShift: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "asg-004",
      title: "Owner walkthrough prep",
      type: "meeting",
      status: "published",
      shift: "day",
      priority: "medium",
      date: dayOffset(1),
      startTime: "14:00",
      endTime: "16:00",
      plannedStart: `${dayOffset(1)}T14:00:00Z`,
      plannedEnd: `${dayOffset(1)}T16:00:00Z`,
      plannedLaborHours: 12,
      requiredHeadcount: 4,
      requiredTrade: "Carpenter",
      assignedCrewIds: ["crew-004"],
      assignedEmployeeIds: ["emp-003", "emp-016", "emp-012"],
      scope: {
        projectId: "prj-104",
        projectName: "Project Oak",
        location: "South Lobby",
        supervisor: "Daniel Ortiz",
      },
      notes: "Finalize punchlist staging.",
      travelTimeMinutes: 22,
      recurrence: { enabled: false, frequency: "weekly", interval: 1, endDate: null },
      safetyRequirement: "Visitor control",
      certificationRequirement: "None",
      equipment: {
        requiredEquipment: [],
        assignedEquipment: [],
        operatorRequired: false,
      },
      isOpenShift: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "asg-005",
      title: "Site logistics toolbox talk",
      type: "toolbox_talk",
      status: "published",
      shift: "day",
      priority: "medium",
      date: dayOffset(0),
      startTime: "07:15",
      endTime: "08:00",
      plannedStart: `${dayOffset(0)}T07:15:00Z`,
      plannedEnd: `${dayOffset(0)}T08:00:00Z`,
      plannedLaborHours: 8,
      requiredHeadcount: 6,
      requiredTrade: "General Labor",
      assignedCrewIds: ["crew-005"],
      assignedEmployeeIds: ["emp-005", "emp-010", "emp-019"],
      scope: {
        projectId: "prj-101",
        projectName: "Northpoint Medical Center",
        location: "Staging Gate 2",
        supervisor: "Nate McCall",
      },
      notes: "Review delivery lane conflicts.",
      travelTimeMinutes: 30,
      recurrence: { enabled: true, frequency: "daily", interval: 1, endDate: dayOffset(14) },
      safetyRequirement: "Attendance sign-in required",
      certificationRequirement: "OSHA 30",
      equipment: {
        requiredEquipment: [],
        assignedEquipment: [],
        operatorRequired: false,
      },
      isOpenShift: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ],
  dispatch: [
    {
      id: "dsp-001",
      type: "crew",
      resourceId: "crew-001",
      name: "Concrete Crew Alpha",
      trade: "Concrete Finisher",
      specialty: "Structural concrete",
      status: "on_site",
      currentAssignmentId: "asg-001",
      currentAssignmentTitle: "Tower B slab pour",
      destination: "Northpoint Medical Center - Tower B",
      shift: "day",
      startTime: "06:30",
      estimatedTravelMinutes: 35,
      utilization: 91,
      alerts: ["Heat index alert"],
      certificationWarnings: [],
      contact: "(512) 555-0911",
      relatedProjectId: "prj-101",
      relatedProjectName: "Northpoint Medical Center",
      delayReason: null,
    },
    {
      id: "dsp-002",
      type: "crew",
      resourceId: "crew-003",
      name: "Electrical Crew North",
      trade: "Electrician",
      specialty: "Panel and conduit",
      status: "assigned",
      currentAssignmentId: "asg-002",
      currentAssignmentTitle: "MEP rough-in Zone 3",
      destination: "Project Oak - Zone 3",
      shift: "day",
      startTime: "07:00",
      estimatedTravelMinutes: 48,
      utilization: 88,
      alerts: ["Certification renewal due in 14 days"],
      certificationWarnings: ["Signal person renewal pending"],
      contact: "(512) 555-0833",
      relatedProjectId: "prj-104",
      relatedProjectName: "Project Oak",
      delayReason: null,
    },
    {
      id: "dsp-003",
      type: "crew",
      resourceId: "crew-006",
      name: "Mechanical Installation Crew",
      trade: "HVAC Technician",
      specialty: "Shutdown tie-in",
      status: "delayed",
      currentAssignmentId: "asg-003",
      currentAssignmentTitle: "Shutdown tie-in",
      destination: "Dock Expansion - Mechanical North",
      shift: "night",
      startTime: "18:00",
      estimatedTravelMinutes: 92,
      utilization: 95,
      alerts: ["Traffic congestion", "Overtime risk"],
      certificationWarnings: [],
      contact: "(512) 555-0660",
      relatedProjectId: "prj-103",
      relatedProjectName: "Dock Expansion",
      delayReason: "Freight corridor closure",
    },
    {
      id: "dsp-004",
      type: "employee",
      resourceId: "emp-010",
      name: "Elena Torres",
      trade: "General Labor",
      specialty: "Site logistics",
      status: "available",
      currentAssignmentId: null,
      currentAssignmentTitle: null,
      destination: "Standby pool",
      shift: "day",
      startTime: "08:00",
      estimatedTravelMinutes: 20,
      utilization: 44,
      alerts: [],
      certificationWarnings: [],
      contact: "(512) 555-0100",
      relatedProjectId: null,
      relatedProjectName: null,
      delayReason: null,
    },
    {
      id: "dsp-005",
      type: "delivery",
      resourceId: "del-001",
      name: "Concrete Pump Truck",
      trade: "Delivery",
      specialty: "Concrete delivery",
      status: "in_transit",
      currentAssignmentId: "asg-001",
      currentAssignmentTitle: "Tower B slab pour",
      destination: "Northpoint Medical Center",
      shift: "day",
      startTime: "10:15",
      estimatedTravelMinutes: 40,
      utilization: 70,
      alerts: ["Gate window restricted"],
      certificationWarnings: [],
      contact: "Dispatch Placeholder",
      relatedProjectId: "prj-101",
      relatedProjectName: "Northpoint Medical Center",
      delayReason: null,
    },
  ],
  openShifts: [
    {
      id: "osh-001",
      assignmentId: "asg-003",
      projectId: "prj-103",
      projectName: "Dock Expansion",
      tradeRequired: "HVAC Technician",
      workersNeeded: 4,
      date: dayOffset(2),
      shift: "night",
      startTime: "18:00",
      endTime: "05:30",
      location: "Mechanical Room North",
      urgency: "critical",
      supervisor: "Camila Reyes",
      certificationRequirements: ["Lockout/Tagout"],
      estimatedHours: 11,
      reason: "Expanded tie-in scope",
      candidateEmployeeIds: ["emp-017", "emp-013"],
      candidateCrewIds: ["crew-006", "crew-002"],
      dismissed: false,
    },
    {
      id: "osh-002",
      assignmentId: "asg-002",
      projectId: "prj-104",
      projectName: "Project Oak",
      tradeRequired: "Electrician",
      workersNeeded: 2,
      date: dayOffset(1),
      shift: "day",
      startTime: "13:00",
      endTime: "17:30",
      location: "Zone 3 Service Corridor",
      urgency: "high",
      supervisor: "Camila Reyes",
      certificationRequirements: ["NFPA 70E"],
      estimatedHours: 4,
      reason: "Inspection prep scope added",
      candidateEmployeeIds: ["emp-018", "emp-012"],
      candidateCrewIds: ["crew-003"],
      dismissed: false,
    },
  ],
  availability: [
    {
      id: "av-001",
      resourceType: "crew",
      resourceId: "crew-002",
      name: "Steel Erection Team",
      trade: "Ironworker",
      location: "Austin Yard B",
      shift: "day",
      availability: "available",
      availableFrom: `${dayOffset(0)}T07:00:00Z`,
      availableTo: `${dayOffset(0)}T18:00:00Z`,
      overtimeEligible: true,
      certificationSummary: "2 certifications, 1 expiring soon",
      utilization: 74,
    },
    {
      id: "av-002",
      resourceType: "crew",
      resourceId: "crew-004",
      name: "Finish Carpentry Team",
      trade: "Carpenter",
      location: "South Shop",
      shift: "day",
      availability: "partial",
      availableFrom: `${dayOffset(0)}T12:00:00Z`,
      availableTo: `${dayOffset(0)}T18:00:00Z`,
      overtimeEligible: true,
      certificationSummary: "Compliant",
      utilization: 62,
    },
    {
      id: "av-003",
      resourceType: "employee",
      resourceId: "emp-016",
      name: "Grace Whitman",
      trade: "Carpenter",
      location: "Round Rock",
      shift: "day",
      availability: "available",
      availableFrom: `${dayOffset(0)}T08:00:00Z`,
      availableTo: `${dayOffset(0)}T17:00:00Z`,
      overtimeEligible: true,
      certificationSummary: "Aerial lift certified",
      utilization: 48,
    },
    {
      id: "av-004",
      resourceType: "employee",
      resourceId: "emp-020",
      name: "Ivy Larson",
      trade: "Safety Manager",
      location: "Austin",
      shift: "day",
      availability: "training",
      availableFrom: `${dayOffset(1)}T08:00:00Z`,
      availableTo: `${dayOffset(1)}T15:00:00Z`,
      overtimeEligible: false,
      certificationSummary: "Training in progress",
      utilization: 20,
    },
    {
      id: "av-005",
      resourceType: "employee",
      resourceId: "emp-014",
      name: "Naomi Brooks",
      trade: "Concrete Finisher",
      location: "Austin",
      shift: "day",
      availability: "pto",
      availableFrom: `${dayOffset(3)}T08:00:00Z`,
      availableTo: `${dayOffset(3)}T17:00:00Z`,
      overtimeEligible: false,
      certificationSummary: "PTO",
      utilization: 0,
    },
  ],
  insights: [
    {
      id: "ins-001",
      title: "Move Sitework Crew Bravo to Northpoint Tuesday morning",
      category: "dispatch",
      severity: "high",
      explanation: "This resolves a projected logistics bottleneck and shortens mobilization delay by 35 minutes.",
      expectedImpact: "Reduce delayed dispatch count by 1 and improve schedule health by 4 points.",
      affectedResources: ["crew-005"],
      recommendedAction: "Reassign crew for first-half day support.",
      confidence: 0.88,
      status: "open",
    },
    {
      id: "ins-002",
      title: "Assign two available carpenters to Project Oak",
      category: "staffing",
      severity: "medium",
      explanation: "Open shift osh-002 can be covered with available carpenters after 13:00.",
      expectedImpact: "Close one open shift and remove a high-risk understaffing alert.",
      affectedResources: ["emp-016", "crew-004"],
      recommendedAction: "Add two carpenters to afternoon assignment.",
      confidence: 0.81,
      status: "open",
    },
    {
      id: "ins-003",
      title: "Delay noncritical delivery by 45 minutes",
      category: "conflict",
      severity: "medium",
      explanation: "Delivery route overlaps with critical concrete staging lane.",
      expectedImpact: "Reduce inspection and delivery conflict risk in the same window.",
      affectedResources: ["del-001"],
      recommendedAction: "Push delivery check-in to 11:00.",
      confidence: 0.77,
      status: "open",
    },
  ],
  timeOff: [
    {
      id: "tof-001",
      employeeId: "emp-014",
      employeeName: "Naomi Brooks",
      type: "pto",
      start: `${dayOffset(0)}T00:00:00Z`,
      end: `${dayOffset(1)}T23:59:00Z`,
      partialDay: false,
      reason: "Approved PTO",
    },
    {
      id: "tof-002",
      employeeId: "emp-020",
      employeeName: "Ivy Larson",
      type: "training",
      start: `${dayOffset(1)}T08:00:00Z`,
      end: `${dayOffset(1)}T15:00:00Z`,
      partialDay: true,
      reason: "Safety recertification",
    },
  ],
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readState(): SchedulingState {
  if (!isBrowser()) {
    return seededState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seededState;
    }

    return JSON.parse(raw) as SchedulingState;
  } catch {
    return seededState;
  }
}

function writeState(state: SchedulingState) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildAnalytics(assignments: ScheduleAssignment[], conflicts: SchedulingPayload["conflicts"], openShifts: OpenShift[], dispatch: DispatchResource[]): SchedulingAnalytics {
  const assignmentCompletion = assignments.length > 0
    ? Math.round((assignments.filter((item) => item.status === "completed" || item.status === "in_progress").length / assignments.length) * 100)
    : 0;

  const filledOpenShift = openShifts.length > 0
    ? Math.round(((openShifts.filter((item) => item.workersNeeded <= 0 || item.dismissed).length) / openShifts.length) * 100)
    : 0;

  const laborUtilization = dispatch.length > 0
    ? Math.round(dispatch.reduce((sum, item) => sum + item.utilization, 0) / dispatch.length)
    : 0;

  const crewOnly = dispatch.filter((item) => item.type === "crew");
  const crewUtilization = crewOnly.length > 0
    ? Math.round(crewOnly.reduce((sum, item) => sum + item.utilization, 0) / crewOnly.length)
    : 0;

  return {
    laborUtilization,
    crewUtilization,
    idleTimeHours: Math.max(0, Math.round((100 - laborUtilization) / 5)),
    overtimeRiskCount: conflicts.filter((item) => item.type === "overtime_threshold_risk").length,
    assignmentCompletionRate: assignmentCompletion,
    openShiftFillRate: filledOpenShift,
    scheduleConflictCount: conflicts.length,
    averageReassignmentCount: 2.4,
    understaffingCount: conflicts.filter((item) => item.type === "understaffed_project").length,
    overstaffingCount: conflicts.filter((item) => item.type === "overstaffed_project").length,
    scheduleHealth: 0,
    travelEfficiencyPlaceholder: 78,
    dispatchPunctuality: Math.max(0, 100 - (dispatch.filter((item) => item.status === "delayed").length * 8)),
    missedStartTimesPlaceholder: 2,
    previousPeriodDelta: {
      laborUtilization: -2,
      crewUtilization: 1,
      openShiftFillRate: 4,
      scheduleConflictCount: 1,
    },
  };
}

function buildSummary(payload: Pick<SchedulingPayload, "assignments" | "openShifts" | "conflicts" | "health" | "availability">): SchedulingPayload["summary"] {
  const employeesScheduled = payload.assignments.reduce((sum, item) => sum + item.assignedEmployeeIds.length, 0);
  const crewsAssigned = new Set(payload.assignments.flatMap((item) => item.assignedCrewIds)).size;
  const availableEmployees = payload.availability.filter((item) => item.resourceType === "employee" && item.availability === "available").length;
  const availableCrews = payload.availability.filter((item) => item.resourceType === "crew" && item.availability === "available").length;
  const openShifts = payload.openShifts.filter((item) => !item.dismissed).length;
  const conflicts = payload.conflicts.filter((item) => item.resolutionStatus === "open").length;
  const overtimeRisk = payload.conflicts.filter((item) => item.type === "overtime_threshold_risk" && item.resolutionStatus === "open").length;
  const understaffed = payload.conflicts.filter((item) => item.type === "understaffed_project" && item.resolutionStatus === "open").length;
  const overstaffed = payload.conflicts.filter((item) => item.type === "overstaffed_project" && item.resolutionStatus === "open").length;

  return {
    dateRangeLabel: "scheduling.dateRange.currentWeek",
    operationalSummary: "scheduling.summary.operational",
    companyContext: "BangoOS Field Operations",
    branchContext: "Central Texas Dispatch",
    kpis: [
      {
        id: "employeesScheduled",
        labelKey: "scheduling.kpi.employeesScheduled",
        value: String(employeesScheduled),
        insightKey: "scheduling.kpiInsight.employeesScheduled",
        trendKey: "scheduling.kpiTrend.employeesScheduled",
        status: "good",
      },
      {
        id: "crewsAssigned",
        labelKey: "scheduling.kpi.crewsAssigned",
        value: String(crewsAssigned),
        insightKey: "scheduling.kpiInsight.crewsAssigned",
        trendKey: "scheduling.kpiTrend.crewsAssigned",
        status: "good",
      },
      {
        id: "availableEmployees",
        labelKey: "scheduling.kpi.availableEmployees",
        value: String(availableEmployees),
        insightKey: "scheduling.kpiInsight.availableEmployees",
        trendKey: "scheduling.kpiTrend.availableEmployees",
        status: "watch",
      },
      {
        id: "availableCrews",
        labelKey: "scheduling.kpi.availableCrews",
        value: String(availableCrews),
        insightKey: "scheduling.kpiInsight.availableCrews",
        trendKey: "scheduling.kpiTrend.availableCrews",
        status: "watch",
      },
      {
        id: "openShifts",
        labelKey: "scheduling.kpi.openShifts",
        value: String(openShifts),
        insightKey: "scheduling.kpiInsight.openShifts",
        trendKey: "scheduling.kpiTrend.openShifts",
        status: openShifts > 2 ? "risk" : "watch",
      },
      {
        id: "conflicts",
        labelKey: "scheduling.kpi.conflicts",
        value: String(conflicts),
        insightKey: "scheduling.kpiInsight.conflicts",
        trendKey: "scheduling.kpiTrend.conflicts",
        status: conflicts > 3 ? "risk" : "watch",
      },
      {
        id: "overtimeRisk",
        labelKey: "scheduling.kpi.overtimeRisk",
        value: String(overtimeRisk),
        insightKey: "scheduling.kpiInsight.overtimeRisk",
        trendKey: "scheduling.kpiTrend.overtimeRisk",
        status: overtimeRisk > 2 ? "risk" : "watch",
      },
      {
        id: "understaffedProjects",
        labelKey: "scheduling.kpi.understaffedProjects",
        value: String(understaffed),
        insightKey: "scheduling.kpiInsight.understaffedProjects",
        trendKey: "scheduling.kpiTrend.understaffedProjects",
        status: understaffed > 1 ? "risk" : "watch",
      },
      {
        id: "overstaffedProjects",
        labelKey: "scheduling.kpi.overstaffedProjects",
        value: String(overstaffed),
        insightKey: "scheduling.kpiInsight.overstaffedProjects",
        trendKey: "scheduling.kpiTrend.overstaffedProjects",
        status: overstaffed > 2 ? "watch" : "good",
      },
      {
        id: "scheduleHealth",
        labelKey: "scheduling.kpi.scheduleHealth",
        value: `${payload.health.score}%`,
        insightKey: "scheduling.kpiInsight.scheduleHealth",
        trendKey: "scheduling.kpiTrend.scheduleHealth",
        status: payload.health.score < 60 ? "risk" : payload.health.score < 80 ? "watch" : "good",
      },
    ],
  };
}

function buildPayload(state: SchedulingState): SchedulingPayload {
  const conflicts = detectSchedulingConflicts({
    assignments: state.assignments,
    openShifts: state.openShifts,
    availability: state.availability,
    timeOff: state.timeOff,
  });

  const health = buildScheduleHealth({
    assignments: state.assignments,
    conflicts,
    openShifts: state.openShifts,
    dispatch: state.dispatch,
  });

  const analytics = buildAnalytics(state.assignments, conflicts, state.openShifts, state.dispatch);
  analytics.scheduleHealth = health.score;

  const summary = buildSummary({
    assignments: state.assignments,
    openShifts: state.openShifts,
    conflicts,
    health,
    availability: state.availability,
  });

  return {
    summary,
    assignments: state.assignments,
    dispatch: state.dispatch,
    openShifts: state.openShifts,
    conflicts,
    availability: state.availability,
    insights: state.insights,
    health,
    analytics,
    projectOptions: projects.map((item) => ({ id: item.id, name: item.name })),
    crewOptions: crewDirectory.map((item) => ({ id: item.id, name: item.name })),
    employeeOptions: employeeDirectory.map((item) => ({ id: item.id, name: item.name, trade: item.trade })),
    tradeOptions: [
      "General Labor",
      "Carpenter",
      "Electrician",
      "Plumber",
      "Equipment Operator",
      "Concrete Finisher",
      "Ironworker",
      "HVAC Technician",
      "Foreman",
      "Superintendent",
      "Safety Manager",
    ],
  };
}

export function getSchedulingPayload() {
  return buildPayload(readState());
}

export function createAssignment(draft: AssignmentDraft) {
  const state = readState();
  const project = projects.find((item) => item.id === draft.projectId) || projects[0];
  const assignment: ScheduleAssignment = {
    id: `asg-${Math.random().toString(36).slice(2, 9)}`,
    title: draft.title,
    type: draft.type,
    status: draft.status,
    shift: draft.shift,
    priority: draft.priority,
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime,
    plannedStart: `${draft.date}T${draft.startTime}:00Z`,
    plannedEnd: `${draft.date}T${draft.endTime}:00Z`,
    plannedLaborHours: draft.requiredHeadcount * 8,
    requiredHeadcount: draft.requiredHeadcount,
    requiredTrade: draft.requiredTrade,
    assignedCrewIds: draft.assignedCrewIds,
    assignedEmployeeIds: draft.assignedEmployeeIds,
    scope: {
      projectId: project.id,
      projectName: project.name,
      location: draft.location || project.location,
      supervisor: draft.supervisor,
    },
    notes: draft.notes,
    travelTimeMinutes: draft.travelTimeMinutes,
    recurrence: draft.recurrence,
    safetyRequirement: draft.safetyRequirement,
    certificationRequirement: draft.certificationRequirement,
    equipment: draft.equipment,
    isOpenShift: draft.type === "open_shift",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  state.assignments = [assignment, ...state.assignments];

  if (assignment.isOpenShift) {
    state.openShifts = [
      {
        id: `osh-${Math.random().toString(36).slice(2, 9)}`,
        assignmentId: assignment.id,
        projectId: assignment.scope.projectId,
        projectName: assignment.scope.projectName,
        tradeRequired: assignment.requiredTrade,
        workersNeeded: assignment.requiredHeadcount,
        date: assignment.date,
        shift: assignment.shift,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        location: assignment.scope.location,
        urgency: assignment.priority,
        supervisor: assignment.scope.supervisor,
        certificationRequirements: assignment.certificationRequirement ? [assignment.certificationRequirement] : [],
        estimatedHours: 8,
        reason: "New assignment created",
        candidateEmployeeIds: employeeDirectory.filter((item) => item.trade === assignment.requiredTrade).map((item) => item.id).slice(0, 4),
        candidateCrewIds: crewDirectory.filter((item) => item.trade === assignment.requiredTrade).map((item) => item.id).slice(0, 2),
        dismissed: false,
      },
      ...state.openShifts,
    ];
  }

  writeState(state);
  return buildPayload(state);
}

export function moveDispatchResource(dispatchId: string, status: DispatchResource["status"], delayReason: string | null) {
  const state = readState();
  state.dispatch = state.dispatch.map((item) =>
    item.id === dispatchId
      ? {
        ...item,
        status,
        delayReason: status === "delayed" ? delayReason || "Delay reason not captured" : null,
      }
      : item,
  );

  writeState(state);
  return buildPayload(state);
}

export function assignOpenShift(openShiftId: string, employeeId: string | null, crewId: string | null) {
  const state = readState();

  const openShift = state.openShifts.find((item) => item.id === openShiftId);
  if (!openShift) {
    return buildPayload(state);
  }

  state.assignments = state.assignments.map((assignment) => {
    if (assignment.id !== openShift.assignmentId) {
      return assignment;
    }

    return {
      ...assignment,
      assignedEmployeeIds: employeeId
        ? Array.from(new Set([...assignment.assignedEmployeeIds, employeeId]))
        : assignment.assignedEmployeeIds,
      assignedCrewIds: crewId
        ? Array.from(new Set([...assignment.assignedCrewIds, crewId]))
        : assignment.assignedCrewIds,
      updatedAt: nowIso(),
      isOpenShift: false,
    };
  });

  state.openShifts = state.openShifts.map((item) =>
    item.id === openShiftId
      ? {
        ...item,
        workersNeeded: Math.max(0, item.workersNeeded - 1),
      }
      : item,
  );

  writeState(state);
  return buildPayload(state);
}

export function resolveConflict(conflictId: string, status: "acknowledged" | "dismissed" | "resolved") {
  const state = readState();
  const payload = buildPayload(state);

  const resolved = payload.conflicts.map((item) =>
    item.id === conflictId ? { ...item, resolutionStatus: status } : item,
  );

  return {
    ...payload,
    conflicts: resolved,
    health: buildScheduleHealth({
      assignments: payload.assignments,
      conflicts: resolved,
      openShifts: payload.openShifts,
      dispatch: payload.dispatch,
    }),
  };
}

export function acceptInsight(insightId: string) {
  const state = readState();
  state.insights = state.insights.map((item) =>
    item.id === insightId ? { ...item, status: "accepted" } : item,
  );
  writeState(state);
  return buildPayload(state);
}

export function dismissInsight(insightId: string) {
  const state = readState();
  state.insights = state.insights.map((item) =>
    item.id === insightId ? { ...item, status: "dismissed" } : item,
  );
  writeState(state);
  return buildPayload(state);
}

export function moveAssignment(
  assignmentId: string,
  changes: Partial<Pick<ScheduleAssignment, "date" | "shift" | "assignedCrewIds" | "assignedEmployeeIds" | "startTime" | "endTime">>,
) {
  const state = readState();
  state.assignments = state.assignments.map((item) =>
    item.id === assignmentId
      ? {
        ...item,
        ...changes,
        updatedAt: nowIso(),
      }
      : item,
  );

  writeState(state);
  return buildPayload(state);
}

export function resetSchedulingMocks() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
