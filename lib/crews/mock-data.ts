import type {
  Crew,
  CrewAnalytics,
  CrewEmployeeOption,
  CrewFilters,
  CrewListResult,
  CrewSortKey,
  ProjectCrewAssignmentSummary,
  UpsertCrewInput,
} from "./types";

const STORAGE_KEY = "bangoos.mock.crews.v1";

const crewEmployeePool: CrewEmployeeOption[] = [
  {
    employeeId: "emp-001",
    fullName: "Maya Rivera",
    position: "Project Superintendent",
    employmentStatus: "active",
    availabilityStatus: "assigned",
    assignedCrewId: "crew-001",
  },
  {
    employeeId: "emp-003",
    fullName: "Avery Singh",
    position: "Carpenter Foreman",
    employmentStatus: "active",
    availabilityStatus: "assigned",
    assignedCrewId: "crew-004",
  },
  {
    employeeId: "emp-005",
    fullName: "Ethan Cole",
    position: "Safety Coordinator",
    employmentStatus: "active",
    availabilityStatus: "available",
    assignedCrewId: "crew-005",
  },
  {
    employeeId: "emp-007",
    fullName: "Liam Patel",
    position: "Assistant PM",
    employmentStatus: "active",
    availabilityStatus: "assigned",
    assignedCrewId: "crew-001",
  },
  {
    employeeId: "emp-008",
    fullName: "Sofia Alvarez",
    position: "Scheduler",
    employmentStatus: "active",
    availabilityStatus: "available",
    assignedCrewId: "crew-002",
  },
  {
    employeeId: "emp-009",
    fullName: "Marcus Johnson",
    position: "Concrete Lead",
    employmentStatus: "active",
    availabilityStatus: "assigned",
    assignedCrewId: "crew-001",
  },
  {
    employeeId: "emp-010",
    fullName: "Elena Torres",
    position: "Site Coordinator",
    employmentStatus: "active",
    availabilityStatus: "available",
    assignedCrewId: null,
  },
  {
    employeeId: "emp-011",
    fullName: "Caleb Wright",
    position: "Field Engineer",
    employmentStatus: "inactive",
    availabilityStatus: "off_shift",
    assignedCrewId: null,
  },
  {
    employeeId: "emp-012",
    fullName: "Priya Menon",
    position: "Assistant PM",
    employmentStatus: "active",
    availabilityStatus: "assigned",
    assignedCrewId: "crew-003",
  },
  {
    employeeId: "emp-013",
    fullName: "Hudson Clark",
    position: "Scheduler",
    employmentStatus: "active",
    availabilityStatus: "available",
    assignedCrewId: "crew-006",
  },
  {
    employeeId: "emp-014",
    fullName: "Naomi Brooks",
    position: "Concrete Lead",
    employmentStatus: "on_leave",
    availabilityStatus: "off_shift",
    assignedCrewId: null,
  },
  {
    employeeId: "emp-015",
    fullName: "Diego Navarro",
    position: "Site Coordinator",
    employmentStatus: "active",
    availabilityStatus: "assigned",
    assignedCrewId: "crew-003",
  },
];

function analytics(metrics: Partial<CrewAnalytics>): CrewAnalytics {
  return {
    utilizationPercentage: metrics.utilizationPercentage ?? 0,
    laborAvailability: metrics.laborAvailability ?? 0,
    overtimeRisk: metrics.overtimeRisk ?? 0,
    certificationCompliance: metrics.certificationCompliance ?? 0,
    workload: metrics.workload ?? 0,
    productivity: metrics.productivity ?? 0,
    safetyIncidents: metrics.safetyIncidents ?? 0,
    scheduleConflicts: metrics.scheduleConflicts ?? 0,
  };
}

const seededCrews: Crew[] = [
  {
    id: "crew-001",
    name: "Concrete Crew Alpha",
    code: "CCA-01",
    lead: "Marcus Johnson",
    supervisor: "Daniel Ortiz",
    avatarUrl: null,
    status: "active",
    availability: "assigned",
    primarySpecialty: "Structural Concrete",
    secondarySpecialties: ["Formwork", "Rebar Installation"],
    homeLocation: "Austin Yard A",
    currentProject: "Northpoint Medical Center",
    memberCount: 8,
    utilization: 92,
    certificationCompliance: 96,
    scheduleConflicts: 1,
    lastActivity: "2026-07-27T17:10:00.000Z",
    notes: "High-performing pour crew with strong QC track record.",
    members: [
      {
        employeeId: "emp-009",
        fullName: "Marcus Johnson",
        role: "Crew Lead",
        position: "Concrete Lead",
        employmentStatus: "active",
        availabilityStatus: "assigned",
        assignedCrewId: "crew-001",
        primaryCrew: true,
        joinedOn: "2024-02-11",
      },
      {
        employeeId: "emp-001",
        fullName: "Maya Rivera",
        role: "Operations Lead",
        position: "Project Superintendent",
        employmentStatus: "active",
        availabilityStatus: "assigned",
        assignedCrewId: "crew-001",
        primaryCrew: false,
        joinedOn: "2025-01-05",
      },
      {
        employeeId: "emp-007",
        fullName: "Liam Patel",
        role: "Field Coordinator",
        position: "Assistant PM",
        employmentStatus: "active",
        availabilityStatus: "assigned",
        assignedCrewId: "crew-001",
        primaryCrew: true,
        joinedOn: "2025-03-12",
      },
    ],
    assignments: [
      {
        id: "ca-001",
        projectId: "prj-101",
        projectName: "Northpoint Medical Center",
        role: "Foundation Package",
        startDate: "2026-06-20",
        endDate: null,
        estimatedManpower: 10,
        actualManpower: 9,
        allocationPercentage: 90,
        status: "active",
      },
    ],
    schedule: [
      {
        id: "cs-001",
        date: "2026-07-28",
        shift: "day",
        availabilityStatus: "assigned",
        assignment: "Slab pour - Tower B",
        hasConflict: false,
      },
      {
        id: "cs-002",
        date: "2026-07-29",
        shift: "day",
        availabilityStatus: "assigned",
        assignment: "Rebar and form prep",
        hasConflict: true,
      },
    ],
    certifications: [
      { id: "cc-001", name: "OSHA 30", validUntil: "2027-03-10", compliant: true },
      { id: "cc-002", name: "ACI Flatwork", validUntil: "2026-11-04", compliant: true },
      { id: "cc-003", name: "First Aid / CPR", validUntil: null, compliant: true },
    ],
    skills: ["Concrete placement", "Layout checks", "Crew coordination"],
    safetyMetrics: {
      incidents30d: 0,
      nearMisses30d: 1,
      lastIncidentDate: null,
    },
    productivityMetrics: {
      completedTasks7d: 18,
      plannedTasks7d: 20,
      onTimePercentage: 90,
    },
    equipment: [
      { id: "eq-001", name: "Laser Screed", status: "in_use" },
      { id: "eq-002", name: "Concrete Vibrator Set", status: "in_use" },
      { id: "eq-003", name: "Power Trowel", status: "available" },
    ],
    recentActivity: [
      {
        id: "act-001",
        title: "Foundation pour completed",
        details: "Completed Tower B footing pour with QA sign-off.",
        happenedAt: "2026-07-27T17:10:00.000Z",
      },
      {
        id: "act-002",
        title: "Crew toolbox talk",
        details: "Morning briefing focused on hot-weather curing controls.",
        happenedAt: "2026-07-27T06:45:00.000Z",
      },
    ],
    history: [
      { id: "hist-001", change: "Lead changed to Marcus Johnson", changedAt: "2026-05-15", changedBy: "Daniel Ortiz" },
    ],
  },
  {
    id: "crew-002",
    name: "Steel Erection Team",
    code: "SET-02",
    lead: "Sofia Alvarez",
    supervisor: "Camila Reyes",
    avatarUrl: null,
    status: "active",
    availability: "available",
    primarySpecialty: "Structural Steel",
    secondarySpecialties: ["Bolting", "Rigging"],
    homeLocation: "Austin Yard B",
    currentProject: null,
    memberCount: 7,
    utilization: 74,
    certificationCompliance: 88,
    scheduleConflicts: 0,
    lastActivity: "2026-07-26T14:15:00.000Z",
    notes: "Ready for mobilization to next superstructure package.",
    members: [
      {
        employeeId: "emp-008",
        fullName: "Sofia Alvarez",
        role: "Crew Lead",
        position: "Scheduler",
        employmentStatus: "active",
        availabilityStatus: "available",
        assignedCrewId: "crew-002",
        primaryCrew: true,
        joinedOn: "2024-09-02",
      },
    ],
    assignments: [],
    schedule: [
      {
        id: "cs-010",
        date: "2026-07-28",
        shift: "day",
        availabilityStatus: "training",
        assignment: "Rigging certification refresher",
        hasConflict: false,
      },
    ],
    certifications: [
      { id: "cc-010", name: "Fall Protection", validUntil: "2027-01-22", compliant: true },
      { id: "cc-011", name: "Signal Person", validUntil: "2026-08-01", compliant: false },
    ],
    skills: ["Lift planning", "Connection sequencing"],
    safetyMetrics: {
      incidents30d: 1,
      nearMisses30d: 2,
      lastIncidentDate: "2026-07-12",
    },
    productivityMetrics: {
      completedTasks7d: 12,
      plannedTasks7d: 16,
      onTimePercentage: 75,
    },
    equipment: [
      { id: "eq-010", name: "Manlift 45ft", status: "available" },
      { id: "eq-011", name: "Torque Wrench Set", status: "in_use" },
    ],
    recentActivity: [
      {
        id: "act-010",
        title: "Signal person renewal pending",
        details: "Two members require renewal by next week.",
        happenedAt: "2026-07-26T14:15:00.000Z",
      },
    ],
    history: [
      { id: "hist-010", change: "Moved to standby after package closeout", changedAt: "2026-07-20", changedBy: "Camila Reyes" },
    ],
  },
  {
    id: "crew-003",
    name: "Electrical Crew North",
    code: "ECN-03",
    lead: "Priya Menon",
    supervisor: "Camila Reyes",
    avatarUrl: null,
    status: "active",
    availability: "assigned",
    primarySpecialty: "Electrical Install",
    secondarySpecialties: ["Panel termination", "Lighting controls"],
    homeLocation: "North District Storage",
    currentProject: "Project Oak",
    memberCount: 6,
    utilization: 86,
    certificationCompliance: 93,
    scheduleConflicts: 2,
    lastActivity: "2026-07-28T06:35:00.000Z",
    notes: "Managing fast-track MEP rough-in and late owner changes.",
    members: [
      {
        employeeId: "emp-012",
        fullName: "Priya Menon",
        role: "Crew Lead",
        position: "Assistant PM",
        employmentStatus: "active",
        availabilityStatus: "assigned",
        assignedCrewId: "crew-003",
        primaryCrew: true,
        joinedOn: "2025-02-17",
      },
      {
        employeeId: "emp-015",
        fullName: "Diego Navarro",
        role: "Field Coordinator",
        position: "Site Coordinator",
        employmentStatus: "active",
        availabilityStatus: "assigned",
        assignedCrewId: "crew-003",
        primaryCrew: true,
        joinedOn: "2025-04-21",
      },
    ],
    assignments: [
      {
        id: "ca-030",
        projectId: "prj-104",
        projectName: "Project Oak",
        role: "MEP Rough-In",
        startDate: "2026-06-05",
        endDate: null,
        estimatedManpower: 7,
        actualManpower: 6,
        allocationPercentage: 86,
        status: "active",
      },
    ],
    schedule: [
      {
        id: "cs-030",
        date: "2026-07-28",
        shift: "day",
        availabilityStatus: "assigned",
        assignment: "Panel rough-in and QA walk",
        hasConflict: true,
      },
      {
        id: "cs-031",
        date: "2026-07-29",
        shift: "day",
        availabilityStatus: "assigned",
        assignment: "Conduit pull Level 2",
        hasConflict: true,
      },
    ],
    certifications: [
      { id: "cc-030", name: "Journeyman Electrician", validUntil: "2027-06-01", compliant: true },
      { id: "cc-031", name: "NFPA 70E", validUntil: "2026-12-20", compliant: true },
    ],
    skills: ["Conduit install", "Commissioning prep", "Voltage testing"],
    safetyMetrics: {
      incidents30d: 1,
      nearMisses30d: 1,
      lastIncidentDate: "2026-07-09",
    },
    productivityMetrics: {
      completedTasks7d: 21,
      plannedTasks7d: 24,
      onTimePercentage: 88,
    },
    equipment: [
      { id: "eq-030", name: "Cable Puller", status: "in_use" },
      { id: "eq-031", name: "Thermal Camera", status: "available" },
    ],
    recentActivity: [
      {
        id: "act-030",
        title: "Conflict detected",
        details: "Two electricians double-booked across zones.",
        happenedAt: "2026-07-28T06:35:00.000Z",
      },
    ],
    history: [
      { id: "hist-030", change: "Shift moved to day-only for owner access", changedAt: "2026-07-24", changedBy: "Camila Reyes" },
    ],
  },
  {
    id: "crew-004",
    name: "Finish Carpentry Team",
    code: "FCT-04",
    lead: "Avery Singh",
    supervisor: "Daniel Ortiz",
    avatarUrl: null,
    status: "active",
    availability: "available",
    primarySpecialty: "Finish Carpentry",
    secondarySpecialties: ["Millwork", "Punchlist Completion"],
    homeLocation: "South Shop",
    currentProject: null,
    memberCount: 5,
    utilization: 62,
    certificationCompliance: 98,
    scheduleConflicts: 0,
    lastActivity: "2026-07-25T15:20:00.000Z",
    notes: "Available for clubhouse interior package.",
    members: [
      {
        employeeId: "emp-003",
        fullName: "Avery Singh",
        role: "Crew Lead",
        position: "Carpenter Foreman",
        employmentStatus: "active",
        availabilityStatus: "assigned",
        assignedCrewId: "crew-004",
        primaryCrew: true,
        joinedOn: "2024-01-16",
      },
    ],
    assignments: [],
    schedule: [
      {
        id: "cs-040",
        date: "2026-07-28",
        shift: "day",
        availabilityStatus: "available",
        assignment: null,
        hasConflict: false,
      },
    ],
    certifications: [
      { id: "cc-040", name: "Aerial Lift", validUntil: "2027-02-09", compliant: true },
    ],
    skills: ["Millwork install", "Door hardware", "Finish detailing"],
    safetyMetrics: {
      incidents30d: 0,
      nearMisses30d: 0,
      lastIncidentDate: null,
    },
    productivityMetrics: {
      completedTasks7d: 14,
      plannedTasks7d: 15,
      onTimePercentage: 93,
    },
    equipment: [
      { id: "eq-040", name: "Laser Level", status: "available" },
      { id: "eq-041", name: "Trim Saw", status: "available" },
    ],
    recentActivity: [
      {
        id: "act-040",
        title: "Punchlist package closed",
        details: "Closed 26 interior punchlist items in one week.",
        happenedAt: "2026-07-25T15:20:00.000Z",
      },
    ],
    history: [
      { id: "hist-040", change: "Completed Harper Residence closeout", changedAt: "2026-07-22", changedBy: "Daniel Ortiz" },
    ],
  },
  {
    id: "crew-005",
    name: "Sitework Crew Bravo",
    code: "SCB-05",
    lead: "Ethan Cole",
    supervisor: "Nate McCall",
    avatarUrl: null,
    status: "standby",
    availability: "training",
    primarySpecialty: "Sitework & Grading",
    secondarySpecialties: ["Erosion control", "Trenching"],
    homeLocation: "West Lot",
    currentProject: null,
    memberCount: 4,
    utilization: 48,
    certificationCompliance: 81,
    scheduleConflicts: 1,
    lastActivity: "2026-07-24T09:05:00.000Z",
    notes: "In safety and equipment retraining before remobilization.",
    members: [
      {
        employeeId: "emp-005",
        fullName: "Ethan Cole",
        role: "Crew Lead",
        position: "Safety Coordinator",
        employmentStatus: "active",
        availabilityStatus: "available",
        assignedCrewId: "crew-005",
        primaryCrew: true,
        joinedOn: "2025-06-11",
      },
    ],
    assignments: [],
    schedule: [
      {
        id: "cs-050",
        date: "2026-07-28",
        shift: "day",
        availabilityStatus: "training",
        assignment: "Equipment recertification",
        hasConflict: false,
      },
    ],
    certifications: [
      { id: "cc-050", name: "Excavation Competent Person", validUntil: "2026-08-15", compliant: false },
      { id: "cc-051", name: "OSHA 30", validUntil: "2027-04-28", compliant: true },
    ],
    skills: ["Subgrade prep", "Drainage layout"],
    safetyMetrics: {
      incidents30d: 2,
      nearMisses30d: 3,
      lastIncidentDate: "2026-07-18",
    },
    productivityMetrics: {
      completedTasks7d: 8,
      plannedTasks7d: 13,
      onTimePercentage: 61,
    },
    equipment: [
      { id: "eq-050", name: "Mini Excavator", status: "maintenance" },
      { id: "eq-051", name: "Plate Compactor", status: "available" },
    ],
    recentActivity: [
      {
        id: "act-050",
        title: "Training week started",
        details: "Scheduled for safety recertification and refreshers.",
        happenedAt: "2026-07-24T09:05:00.000Z",
      },
    ],
    history: [
      { id: "hist-050", change: "Set to standby pending cert renewals", changedAt: "2026-07-23", changedBy: "Nate McCall" },
    ],
  },
  {
    id: "crew-006",
    name: "Mechanical Installation Crew",
    code: "MIC-06",
    lead: "Hudson Clark",
    supervisor: "Camila Reyes",
    avatarUrl: null,
    status: "active",
    availability: "assigned",
    primarySpecialty: "Mechanical Install",
    secondarySpecialties: ["HVAC rough-in", "Hydronic piping"],
    homeLocation: "North District Storage",
    currentProject: "Dock Expansion",
    memberCount: 9,
    utilization: 95,
    certificationCompliance: 90,
    scheduleConflicts: 2,
    lastActivity: "2026-07-28T07:22:00.000Z",
    notes: "High workload. Overtime risk elevated this week.",
    members: [
      {
        employeeId: "emp-013",
        fullName: "Hudson Clark",
        role: "Crew Lead",
        position: "Scheduler",
        employmentStatus: "active",
        availabilityStatus: "available",
        assignedCrewId: "crew-006",
        primaryCrew: true,
        joinedOn: "2025-05-08",
      },
    ],
    assignments: [
      {
        id: "ca-060",
        projectId: "prj-103",
        projectName: "Dock Expansion",
        role: "Mechanical Scope",
        startDate: "2026-06-01",
        endDate: null,
        estimatedManpower: 10,
        actualManpower: 9,
        allocationPercentage: 95,
        status: "active",
      },
    ],
    schedule: [
      {
        id: "cs-060",
        date: "2026-07-28",
        shift: "day",
        availabilityStatus: "assigned",
        assignment: "Duct and hanger install",
        hasConflict: false,
      },
      {
        id: "cs-061",
        date: "2026-07-29",
        shift: "night",
        availabilityStatus: "assigned",
        assignment: "Shutdown tie-in",
        hasConflict: true,
      },
    ],
    certifications: [
      { id: "cc-060", name: "Confined Space", validUntil: "2027-05-20", compliant: true },
      { id: "cc-061", name: "Lockout/Tagout", validUntil: "2026-10-17", compliant: true },
    ],
    skills: ["Sheet metal", "Hydronic balancing", "Closeout documentation"],
    safetyMetrics: {
      incidents30d: 1,
      nearMisses30d: 2,
      lastIncidentDate: "2026-07-16",
    },
    productivityMetrics: {
      completedTasks7d: 25,
      plannedTasks7d: 28,
      onTimePercentage: 89,
    },
    equipment: [
      { id: "eq-060", name: "Pipe Threader", status: "in_use" },
      { id: "eq-061", name: "Scissor Lift", status: "in_use" },
    ],
    recentActivity: [
      {
        id: "act-060",
        title: "Night shift conflict flagged",
        details: "Crew overlap with electrical shutdown activities.",
        happenedAt: "2026-07-28T07:22:00.000Z",
      },
    ],
    history: [
      { id: "hist-060", change: "Increased manpower allocation to 95%", changedAt: "2026-07-21", changedBy: "Camila Reyes" },
    ],
  },
];

function isBrowser() {
  return typeof window !== "undefined";
}

function readStoredCrews() {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as Crew[];
  } catch {
    return null;
  }
}

function writeStoredCrews(items: Crew[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function getAllCrews() {
  return readStoredCrews() || seededCrews;
}

function compareBy(a: Crew, b: Crew, sortBy: CrewSortKey) {
  const collator = new Intl.Collator("en", { sensitivity: "base" });

  switch (sortBy) {
    case "name_desc":
      return collator.compare(b.name, a.name);
    case "lead_asc":
      return collator.compare(a.lead, b.lead);
    case "lead_desc":
      return collator.compare(b.lead, a.lead);
    case "members_desc":
      return b.memberCount - a.memberCount;
    case "utilization_desc":
      return b.utilization - a.utilization;
    case "last_activity_desc":
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    case "name_asc":
    default:
      return collator.compare(a.name, b.name);
  }
}

export function listCrews(filters: CrewFilters): CrewListResult {
  const { query, status, availability, specialty, sortBy, page, pageSize } = filters;
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = getAllCrews()
    .filter((crew) => {
      const matchesQuery =
        !normalizedQuery
        || crew.name.toLowerCase().includes(normalizedQuery)
        || crew.code.toLowerCase().includes(normalizedQuery)
        || crew.lead.toLowerCase().includes(normalizedQuery)
        || crew.supervisor.toLowerCase().includes(normalizedQuery)
        || (crew.currentProject || "").toLowerCase().includes(normalizedQuery)
        || crew.primarySpecialty.toLowerCase().includes(normalizedQuery);

      const matchesStatus = status === "all" || crew.status === status;
      const matchesAvailability = availability === "all" || crew.availability === availability;
      const matchesSpecialty = specialty === "all" || crew.primarySpecialty === specialty;

      return matchesQuery && matchesStatus && matchesAvailability && matchesSpecialty;
    })
    .sort((a, b) => compareBy(a, b, sortBy));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    total,
    totalPages,
    page: safePage,
    pageSize,
  };
}

export function getCrewDashboardSummary() {
  const crews = getAllCrews();
  const analytics = crews.map((item) => analyticsFromCrew(item));

  const avgCrewSize = crews.length > 0
    ? Math.round(crews.reduce((sum, crew) => sum + crew.memberCount, 0) / crews.length)
    : 0;

  const avgUtilization = crews.length > 0
    ? Math.round(crews.reduce((sum, crew) => sum + crew.utilization, 0) / crews.length)
    : 0;

  const avgCompliance = crews.length > 0
    ? Math.round(crews.reduce((sum, crew) => sum + crew.certificationCompliance, 0) / crews.length)
    : 0;

  return {
    totalCrews: crews.length,
    activeCrews: crews.filter((crew) => crew.status === "active").length,
    availableCrews: crews.filter((crew) => crew.availability === "available").length,
    assignedCrews: crews.filter((crew) => crew.availability === "assigned").length,
    averageCrewSize: avgCrewSize,
    utilization: avgUtilization,
    certificationCompliance: avgCompliance,
    schedulingConflicts: analytics.reduce((sum, item) => sum + item.scheduleConflicts, 0),
  };
}

function analyticsFromCrew(crew: Crew) {
  return analytics({
    utilizationPercentage: crew.utilization,
    laborAvailability: 100 - crew.utilization,
    overtimeRisk: Math.max(0, crew.utilization - 80),
    certificationCompliance: crew.certificationCompliance,
    workload: Math.min(100, crew.utilization + 5),
    productivity: crew.productivityMetrics.onTimePercentage,
    safetyIncidents: crew.safetyMetrics.incidents30d,
    scheduleConflicts: crew.scheduleConflicts,
  });
}

export function getCrewById(crewId: string): Crew | null {
  return getAllCrews().find((crew) => crew.id === crewId) || null;
}

export function getCrewSpecialtyOptions(): string[] {
  return Array.from(new Set(getAllCrews().map((crew) => crew.primarySpecialty))).sort((a, b) => a.localeCompare(b));
}

export function getCrewEmployeeOptions(): CrewEmployeeOption[] {
  return crewEmployeePool;
}

export function getProjectCrewAssignments(projectName: string): ProjectCrewAssignmentSummary[] {
  const normalized = projectName.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return getAllCrews()
    .flatMap((crew) => crew.assignments.map((assignment) => ({ crew, assignment })))
    .filter((entry) => entry.assignment.projectName.trim().toLowerCase() === normalized)
    .map((entry) => ({
      crewId: entry.crew.id,
      crewName: entry.crew.name,
      role: entry.assignment.role,
      startDate: entry.assignment.startDate,
      estimatedManpower: entry.assignment.estimatedManpower,
      actualManpower: entry.assignment.actualManpower,
      allocationPercentage: entry.assignment.allocationPercentage,
    }));
}

export function createCrew(input: UpsertCrewInput): Crew {
  const crew: Crew = {
    id: `crew-${Math.random().toString(36).slice(2, 10)}`,
    name: input.name,
    code: input.code,
    lead: input.lead,
    supervisor: input.supervisor,
    avatarUrl: null,
    status: input.status,
    availability: input.availability,
    primarySpecialty: input.primarySpecialty,
    secondarySpecialties: input.secondarySpecialties,
    homeLocation: input.homeLocation,
    currentProject: input.currentProject,
    memberCount: input.members.length,
    utilization: 0,
    certificationCompliance: 100,
    scheduleConflicts: 0,
    lastActivity: new Date().toISOString(),
    notes: input.notes,
    members: input.members,
    assignments: [],
    schedule: [],
    certifications: [],
    skills: [...new Set([input.primarySpecialty, ...input.secondarySpecialties].filter(Boolean))],
    safetyMetrics: {
      incidents30d: 0,
      nearMisses30d: 0,
      lastIncidentDate: null,
    },
    productivityMetrics: {
      completedTasks7d: 0,
      plannedTasks7d: 0,
      onTimePercentage: 0,
    },
    equipment: [],
    recentActivity: [
      {
        id: "act-new",
        title: "Crew created",
        details: "Crew record created from builder form.",
        happenedAt: new Date().toISOString(),
      },
    ],
    history: [
      {
        id: "hist-new",
        change: "Crew created",
        changedAt: new Date().toISOString().slice(0, 10),
        changedBy: "System",
      },
    ],
  };

  const items = [crew, ...getAllCrews()];
  writeStoredCrews(items);
  return crew;
}

export function updateCrew(crewId: string, input: UpsertCrewInput): Crew | null {
  const existing = getCrewById(crewId);

  if (!existing) {
    return null;
  }

  const updated: Crew = {
    ...existing,
    name: input.name,
    code: input.code,
    lead: input.lead,
    supervisor: input.supervisor,
    status: input.status,
    availability: input.availability,
    primarySpecialty: input.primarySpecialty,
    secondarySpecialties: input.secondarySpecialties,
    homeLocation: input.homeLocation,
    currentProject: input.currentProject,
    notes: input.notes,
    members: input.members,
    memberCount: input.members.length,
    lastActivity: new Date().toISOString(),
  };

  const items = getAllCrews().map((crew) => (crew.id === crewId ? updated : crew));
  writeStoredCrews(items);
  return updated;
}
