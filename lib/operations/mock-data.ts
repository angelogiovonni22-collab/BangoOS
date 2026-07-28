import { createCrewService } from "@/lib/crews";
import { createEmployeeService } from "@/lib/employees";
import type {
  AttentionItem,
  CrewOperationalStatus,
  DailyProjectOperation,
  OperationsFilters,
  OperationsPayload,
  ScheduleEvent,
  SafetyAlert,
  SiteCamActivity,
  WorkforceStatus,
} from "./types";

const projects: DailyProjectOperation[] = [
  {
    id: "prj-101",
    projectName: "Northpoint Medical Center",
    location: "Austin, TX",
    projectManager: "Camila Reyes",
    superintendent: "Maya Rivera",
    assignedCrews: ["Concrete Crew Alpha", "Mechanical Installation Crew"],
    manpowerPlanned: 18,
    manpowerActual: 17,
    keyActivity: "Tower B slab pour",
    scheduleStatus: "at_risk",
    completionPercentage: 63,
    riskLevel: "high",
    weatherImpact: "Heat advisory after 2 PM",
    latestSitecamActivity: "Concrete placement documented at 7:45 AM",
    nextMilestone: "MEP rough-in inspection tomorrow",
  },
  {
    id: "prj-104",
    projectName: "Project Oak",
    location: "Round Rock, TX",
    projectManager: "Daniel Ortiz",
    superintendent: "Diego Navarro",
    assignedCrews: ["Electrical Crew North", "Finish Carpentry Team"],
    manpowerPlanned: 14,
    manpowerActual: 13,
    keyActivity: "Panel rough-in and QA walk",
    scheduleStatus: "on_track",
    completionPercentage: 71,
    riskLevel: "medium",
    weatherImpact: "No weather impact",
    latestSitecamActivity: "Framing progress ahead of plan",
    nextMilestone: "Owner walkthrough on Friday",
  },
  {
    id: "prj-103",
    projectName: "Dock Expansion",
    location: "Pflugerville, TX",
    projectManager: "Renee Wallace",
    superintendent: "Avery Singh",
    assignedCrews: ["Mechanical Installation Crew", "Steel Erection Team"],
    manpowerPlanned: 16,
    manpowerActual: 16,
    keyActivity: "Shutdown tie-in prep",
    scheduleStatus: "delayed",
    completionPercentage: 54,
    riskLevel: "high",
    weatherImpact: "Thunderstorm probability 40%",
    latestSitecamActivity: "Delivery documentation flagged",
    nextMilestone: "Mechanical tie-in Saturday night",
  },
  {
    id: "prj-102",
    projectName: "Harper Residence",
    location: "Cedar Park, TX",
    projectManager: "Javier Morales",
    superintendent: "Avery Singh",
    assignedCrews: ["Finish Carpentry Team", "Sitework Crew Bravo"],
    manpowerPlanned: 9,
    manpowerActual: 8,
    keyActivity: "Interior punch-list closeout",
    scheduleStatus: "on_track",
    completionPercentage: 86,
    riskLevel: "low",
    weatherImpact: "No weather impact",
    latestSitecamActivity: "Punch-list photo update posted",
    nextMilestone: "Final inspection Monday",
  },
];

const schedule: ScheduleEvent[] = [
  {
    id: "sch-001",
    time: "06:30",
    activity: "Crew mobilization and equipment check",
    project: "Northpoint Medical Center",
    assignedCrew: "Concrete Crew Alpha",
    owner: "Maya Rivera",
    status: "complete",
    priority: "high",
    hasConflict: false,
    period: "morning",
  },
  {
    id: "sch-002",
    time: "07:15",
    activity: "Toolbox talk",
    project: "Project Oak",
    assignedCrew: "Electrical Crew North",
    owner: "Priya Menon",
    status: "in_progress",
    priority: "medium",
    hasConflict: false,
    period: "morning",
  },
  {
    id: "sch-003",
    time: "09:00",
    activity: "Delivery coordination",
    project: "Northpoint Medical Center",
    assignedCrew: "Mechanical Installation Crew",
    owner: "Hudson Clark",
    status: "at_risk",
    priority: "critical",
    hasConflict: true,
    period: "morning",
  },
  {
    id: "sch-004",
    time: "11:00",
    activity: "Inspection preparation",
    project: "Dock Expansion",
    assignedCrew: "Steel Erection Team",
    owner: "Sofia Alvarez",
    status: "upcoming",
    priority: "high",
    hasConflict: false,
    period: "midday",
  },
  {
    id: "sch-005",
    time: "13:30",
    activity: "Concrete pour",
    project: "Northpoint Medical Center",
    assignedCrew: "Concrete Crew Alpha",
    owner: "Marcus Johnson",
    status: "delayed",
    priority: "critical",
    hasConflict: true,
    period: "afternoon",
  },
  {
    id: "sch-006",
    time: "15:00",
    activity: "Safety meeting",
    project: "Sitewide",
    assignedCrew: "Sitework Crew Bravo",
    owner: "Ethan Cole",
    status: "upcoming",
    priority: "medium",
    hasConflict: false,
    period: "afternoon",
  },
  {
    id: "sch-007",
    time: "18:45",
    activity: "Shutdown tie-in",
    project: "Dock Expansion",
    assignedCrew: "Mechanical Installation Crew",
    owner: "Hudson Clark",
    status: "upcoming",
    priority: "high",
    hasConflict: false,
    period: "evening",
  },
];

const safetyAlerts: SafetyAlert[] = [
  {
    id: "safe-001",
    title: "Fall protection anchor not verified",
    severity: "critical",
    project: "Dock Expansion",
    subject: "Steel Erection Team",
    dueDate: "2026-07-28",
    owner: "Nate McCall",
    recommendedAction: "Pause overhead work and verify anchor points before restart.",
    status: "open",
  },
  {
    id: "safe-002",
    title: "Two OSHA 30 refreshers due",
    severity: "high",
    project: "Northpoint Medical Center",
    subject: "Concrete Crew Alpha",
    dueDate: "2026-08-02",
    owner: "Ethan Cole",
    recommendedAction: "Schedule certification renewal before next week shift plan.",
    status: "in_progress",
  },
  {
    id: "safe-003",
    title: "Toolbox talk pending sign-off",
    severity: "medium",
    project: "Project Oak",
    subject: "Electrical Crew North",
    dueDate: "2026-07-28",
    owner: "Priya Menon",
    recommendedAction: "Capture attendance and upload signed checklist.",
    status: "open",
  },
];

const sitecam: SiteCamActivity[] = [
  {
    id: "cam-001",
    projectId: "prj-101",
    project: "Northpoint Medical Center",
    timestamp: "2026-07-28T07:45:00.000Z",
    uploader: "Maya Rivera",
    photoCount: 6,
    category: "concrete",
    description: "Concrete placement progress captured at Tower B.",
    flagged: false,
  },
  {
    id: "cam-002",
    projectId: "prj-104",
    project: "Project Oak",
    timestamp: "2026-07-28T08:15:00.000Z",
    uploader: "Priya Menon",
    photoCount: 4,
    category: "framing",
    description: "Framing progress appears ahead of morning target.",
    flagged: false,
  },
  {
    id: "cam-003",
    projectId: "prj-103",
    project: "Dock Expansion",
    timestamp: "2026-07-28T09:02:00.000Z",
    uploader: "Sofia Alvarez",
    photoCount: 3,
    category: "delivery",
    description: "Delivery route conflict observed near staging gate.",
    flagged: true,
  },
  {
    id: "cam-004",
    projectId: "prj-102",
    project: "Harper Residence",
    timestamp: "2026-07-28T10:40:00.000Z",
    uploader: "Avery Singh",
    photoCount: 5,
    category: "punchlist",
    description: "Punch-list completion documentation uploaded.",
    flagged: false,
  },
];

const attentionQueue: AttentionItem[] = [
  {
    id: "att-001",
    priority: "critical",
    title: "Delivery conflict at 9:00 AM",
    reason: "Inbound concrete and steel deliveries overlap same gate window.",
    relatedEntity: "Northpoint Medical Center",
    owner: "Camila Reyes",
    dueAt: "2026-07-28T08:45:00.000Z",
    suggestedAction: "Resequence steel delivery by 45 minutes and notify dispatch.",
    status: "open",
    scope: "projects",
  },
  {
    id: "att-002",
    priority: "high",
    title: "Electrical crew overallocated tomorrow",
    reason: "Crew assigned to two high-effort activities in adjacent shifts.",
    relatedEntity: "Electrical Crew North",
    owner: "Daniel Ortiz",
    dueAt: "2026-07-28T16:00:00.000Z",
    suggestedAction: "Move one electrician from standby pool to evening shift.",
    status: "in_progress",
    scope: "crews",
  },
  {
    id: "att-003",
    priority: "high",
    title: "Two certifications expire within 14 days",
    reason: "Signal person and excavation cert renewal windows closing.",
    relatedEntity: "Steel Erection Team, Sitework Crew Bravo",
    owner: "Ethan Cole",
    dueAt: "2026-07-30T12:00:00.000Z",
    suggestedAction: "Schedule renewal sessions and verify completion evidence.",
    status: "open",
    scope: "safety",
  },
  {
    id: "att-004",
    priority: "medium",
    title: "Afternoon carpenter shortage risk",
    reason: "Project Oak manpower forecast short by one finish carpenter.",
    relatedEntity: "Project Oak",
    owner: "Javier Morales",
    dueAt: "2026-07-28T12:30:00.000Z",
    suggestedAction: "Reassign one available member from Finish Carpentry Team.",
    status: "open",
    scope: "workforce",
  },
];

export async function getOperationsPayload(filters: OperationsFilters): Promise<OperationsPayload> {
  const crewService = createCrewService();
  const employeeService = createEmployeeService();

  const [crewList, employeeSummary] = await Promise.all([
    crewService.getCrews({
      query: filters.query,
      status: "all",
      availability: filters.shift === "all" ? "all" : "assigned",
      specialty: filters.project,
      sortBy: "utilization_desc",
      page: 1,
      pageSize: 50,
    }),
    employeeService.getSummary(),
  ]);

  const filteredProjects = projects.filter((item) => {
    const matchesProject = filters.project === "all" || item.projectName === filters.project;
    const matchesQuery = !filters.query.trim() || [
      item.projectName,
      item.location,
      item.projectManager,
      item.superintendent,
      item.keyActivity,
    ].join(" ").toLowerCase().includes(filters.query.toLowerCase());

    return matchesProject && matchesQuery;
  });

  const scheduleByShift = schedule.filter((item) => {
    if (filters.shift === "all") {
      return true;
    }

    if (filters.shift === "day") {
      return item.period === "morning" || item.period === "midday" || item.period === "afternoon";
    }

    if (filters.shift === "swing") {
      return item.period === "afternoon" || item.period === "evening";
    }

    return item.period === "evening";
  });

  const crewAllocations = crewList.items.map((crew) => {
    const status: CrewOperationalStatus = crew.utilization > 92
      ? "overallocated"
      : crew.scheduleConflicts > 0
        ? "delayed"
        : crew.availability === "assigned"
          ? "on_site"
          : crew.availability === "training"
            ? "training"
            : crew.availability === "off_shift"
              ? "off_shift"
              : "available";

    return {
      crewId: crew.id,
      crewName: crew.name,
      crewLead: crew.lead,
      assignedProject: crew.currentProject,
      shift: filters.shift === "all" ? "day" : filters.shift,
      startTime: crew.availability === "assigned" ? "06:30" : crew.availability === "training" ? "08:00" : "07:00",
      plannedHours: crew.availability === "assigned" ? 10 : 8,
      utilization: crew.utilization,
      status,
      availability: crew.availability,
      scheduleConflicts: crew.scheduleConflicts,
      certificationWarnings: Math.max(0, 100 - crew.certificationCompliance > 8 ? 1 : 0),
    };
  });

  const workforce: WorkforceStatus = {
    scheduled: crewAllocations.reduce((sum, item) => sum + Math.max(0, Math.round(item.utilization / 12)), 0),
    checkedIn: employeeSummary.activeToday,
    available: employeeSummary.available,
    absent: 3,
    pto: 2,
    training: 4,
    overtimeRisk: crewAllocations.filter((item) => item.utilization > 90).length,
    certificationRisk: safetyAlerts.filter((alert) => alert.title.toLowerCase().includes("cert")).length,
    attention: [
      {
        employeeId: "emp-015",
        fullName: "Diego Navarro",
        type: "overtime_risk",
        reason: "Scheduled for a 6th consecutive extended shift",
        owner: "Daniel Ortiz",
      },
      {
        employeeId: "emp-010",
        fullName: "Elena Torres",
        type: "unassigned",
        reason: "Available and unassigned for afternoon shift",
        owner: "Camila Reyes",
      },
      {
        employeeId: "emp-008",
        fullName: "Sofia Alvarez",
        type: "certification_issue",
        reason: "Signal person renewal due this week",
        owner: "Ethan Cole",
      },
      {
        employeeId: "emp-003",
        fullName: "Avery Singh",
        type: "crew_conflict",
        reason: "Listed in overlapping handoff window",
        owner: "Javier Morales",
      },
      {
        employeeId: "emp-012",
        fullName: "Priya Menon",
        type: "no_show_risk",
        reason: "Late check-in pattern past 3 days",
        owner: "Camila Reyes",
      },
    ],
  };

  const kpis = [
    {
      id: "activeProjects",
      label: "operations.kpi.activeProjects",
      value: String(filteredProjects.length),
      insight: "operations.kpiInsight.activeProjects",
      trend: "operations.kpiTrend.activeProjects",
      status: "good",
    },
    {
      id: "crewsWorking",
      label: "operations.kpi.crewsWorking",
      value: String(crewAllocations.filter((item) => item.availability === "assigned").length),
      insight: "operations.kpiInsight.crewsWorking",
      trend: "operations.kpiTrend.crewsWorking",
      status: "good",
    },
    {
      id: "crewsAvailable",
      label: "operations.kpi.crewsAvailable",
      value: String(crewAllocations.filter((item) => item.availability === "available").length),
      insight: "operations.kpiInsight.crewsAvailable",
      trend: "operations.kpiTrend.crewsAvailable",
      status: "watch",
    },
    {
      id: "employeesScheduled",
      label: "operations.kpi.employeesScheduled",
      value: String(workforce.scheduled),
      insight: "operations.kpiInsight.employeesScheduled",
      trend: "operations.kpiTrend.employeesScheduled",
      status: "good",
    },
    {
      id: "employeesAvailable",
      label: "operations.kpi.employeesAvailable",
      value: String(workforce.available),
      insight: "operations.kpiInsight.employeesAvailable",
      trend: "operations.kpiTrend.employeesAvailable",
      status: "neutral",
    },
    {
      id: "scheduleConflicts",
      label: "operations.kpi.scheduleConflicts",
      value: String(scheduleByShift.filter((item) => item.hasConflict).length),
      insight: "operations.kpiInsight.scheduleConflicts",
      trend: "operations.kpiTrend.scheduleConflicts",
      status: "critical",
    },
    {
      id: "safetyAlerts",
      label: "operations.kpi.safetyAlerts",
      value: String(safetyAlerts.filter((item) => item.status !== "resolved").length),
      insight: "operations.kpiInsight.safetyAlerts",
      trend: "operations.kpiTrend.safetyAlerts",
      status: "critical",
    },
    {
      id: "certificationRisks",
      label: "operations.kpi.certificationRisks",
      value: String(workforce.certificationRisk + crewAllocations.filter((item) => item.certificationWarnings > 0).length),
      insight: "operations.kpiInsight.certificationRisks",
      trend: "operations.kpiTrend.certificationRisks",
      status: "watch",
    },
    {
      id: "delayedActivities",
      label: "operations.kpi.delayedActivities",
      value: String(scheduleByShift.filter((item) => item.status === "delayed" || item.status === "at_risk").length),
      insight: "operations.kpiInsight.delayedActivities",
      trend: "operations.kpiTrend.delayedActivities",
      status: "watch",
    },
    {
      id: "sitecamUpdates",
      label: "operations.kpi.sitecamUpdates",
      value: String(sitecam.reduce((sum, item) => sum + item.photoCount, 0)),
      insight: "operations.kpiInsight.sitecamUpdates",
      trend: "operations.kpiTrend.sitecamUpdates",
      status: "good",
    },
  ] as const;

  return {
    summary: {
      dateLabel: filters.date,
      dailySummary: "operations.summary.default",
      companyContext: "BangoOS Field Operations",
      locationContext: "Central Texas Portfolio",
      kpis: kpis.map((item) => ({
        id: item.id,
        label: item.label,
        value: item.value,
        insight: item.insight,
        trend: item.trend,
        status: item.status,
      })),
    },
    projects: filteredProjects,
    crewAllocations,
    workforce,
    schedule: scheduleByShift,
    safetyAlerts,
    sitecamActivity: sitecam,
    insights: [
      {
        id: "ins-001",
        category: "labor",
        severity: "high",
        title: "operations.insight.title.overallocatedCrew",
        explanation: "operations.insight.explanation.overallocatedCrew",
        recommendedAction: "operations.insight.action.overallocatedCrew",
        relatedEntity: "Electrical Crew North",
        confidence: "operations.insight.confidence.mediumHigh",
        isMock: true,
      },
      {
        id: "ins-002",
        category: "schedule",
        severity: "critical",
        title: "operations.insight.title.deliveryConflict",
        explanation: "operations.insight.explanation.deliveryConflict",
        recommendedAction: "operations.insight.action.deliveryConflict",
        relatedEntity: "Northpoint Medical Center",
        confidence: "operations.insight.confidence.high",
        isMock: true,
      },
      {
        id: "ins-003",
        category: "progress",
        severity: "low",
        title: "operations.insight.title.framingAhead",
        explanation: "operations.insight.explanation.framingAhead",
        recommendedAction: "operations.insight.action.framingAhead",
        relatedEntity: "Project Oak",
        confidence: "operations.insight.confidence.medium",
        isMock: true,
      },
      {
        id: "ins-004",
        category: "compliance",
        severity: "high",
        title: "operations.insight.title.certExpiring",
        explanation: "operations.insight.explanation.certExpiring",
        recommendedAction: "operations.insight.action.certExpiring",
        relatedEntity: "Steel Erection Team",
        confidence: "operations.insight.confidence.high",
        isMock: true,
      },
    ],
    attentionQueue,
    projectOptions: ["all", ...new Set(projects.map((item) => item.projectName))],
  };
}
