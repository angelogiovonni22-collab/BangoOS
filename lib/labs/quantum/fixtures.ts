import type {
  QuantumAction,
  QuantumCompanyState,
  QuantumInsight,
  QuantumMetricData,
  QuantumPulse,
  QuantumTimelineEvent,
  QuantumTwinLink,
  QuantumTwinNode,
} from "./types";

export const quantumCompanyState: QuantumCompanyState = {
  id: "company-state-1",
  executiveGreeting: "Good afternoon, executive team.",
  companyName: "Bango Construction Group",
  healthScore: 82,
  healthLabel: "Stable with focused pressure points",
  directionalTrend: "+4 over the last 7 days",
  freshness: "delayed",
  limitations: [
    "Two remote sites have delayed field sync by approximately 35 minutes.",
    "One equipment telemetry feed is currently using fallback polling.",
  ],
  dimensions: [
    {
      id: "d1",
      label: "Project Flow",
      value: "18 of 24 on-target",
      trend: "Improving",
      freshness: "live",
      status: "healthy",
    },
    {
      id: "d2",
      label: "Crew Utilization",
      value: "91%",
      trend: "Steady",
      freshness: "live",
      status: "info",
    },
    {
      id: "d3",
      label: "Equipment Reliability",
      value: "97.3%",
      trend: "Crane cluster under watch",
      freshness: "delayed",
      status: "attention",
    },
    {
      id: "d4",
      label: "Critical Exposure",
      value: "3 active items",
      trend: "Down from 4",
      freshness: "live",
      status: "critical",
    },
  ],
};

export const quantumMetrics: QuantumMetricData[] = [
  { id: "m1", label: "Active Sites", value: "24", trend: "+2 this week", status: "healthy", freshness: "live" },
  { id: "m2", label: "Crew Allocation", value: "91%", trend: "Stable", status: "info", freshness: "live" },
  { id: "m3", label: "Equipment Uptime", value: "97.3%", trend: "Watch crane cluster", status: "attention", freshness: "delayed" },
  { id: "m4", label: "Critical Risks", value: "3", trend: "-1 since yesterday", status: "critical", freshness: "live" },
];

export const quantumTimeline: QuantumTimelineEvent[] = [
  { id: "t1", title: "Northpoint slab pour", detail: "Crew Alpha reached hold point 3.", at: "07:45", status: "healthy" },
  { id: "t2", title: "Transit lane constraint", detail: "Equipment routing adjusted around gate B.", at: "09:10", status: "attention" },
  { id: "t3", title: "Inspection packet uploaded", detail: "QA packet linked to phase closure.", at: "10:05", status: "info" },
  { id: "t4", title: "Orion confidence update", detail: "Risk confidence increased after new evidence.", at: "11:30", status: "orion" },
];

export const quantumInsights: QuantumInsight[] = [
  {
    id: "o1",
    topObservation: "Concrete sequence may bottleneck at the crane rotation window.",
    whyItMatters: "If the rotation window slips, two pours shift into a higher-cost overtime band.",
    evidenceQuality: "High: 2 independent schedule signals plus equipment lane telemetry.",
    confidence: "0.86",
    nextStep: "Validate crane slot assignments before 14:00 window.",
    limitations: [
      "Lane telemetry from Yard Delta is delayed by approximately 12 minutes.",
      "Weather variance after 16:00 is not included in this fixture set.",
    ],
    status: "orion",
  },
  {
    id: "o2",
    topObservation: "Crew Bravo has reduced idle-time variance this week.",
    whyItMatters: "Stable dispatch intervals are reducing rework churn on neighboring scopes.",
    evidenceQuality: "Medium: 4 consecutive shifts with matching dispatch cadence.",
    confidence: "0.78",
    nextStep: "Replicate dispatch cadence on two adjacent projects.",
    limitations: [
      "Only day-shift windows represented in this fixture snapshot.",
    ],
    status: "healthy",
  },
];

export const quantumActions: QuantumAction[] = [
  { id: "a1", title: "Re-sequence lift path", owner: "Field Ops", due: "Today 13:30", impact: "Reduce bottleneck risk", status: "attention" },
  { id: "a2", title: "Confirm backup generator", owner: "Site Superintendent", due: "Today 15:00", impact: "Protect concrete cure window", status: "critical" },
  { id: "a3", title: "Share dispatch pattern", owner: "Workforce Lead", due: "Tomorrow", impact: "Scale stable utilization", status: "info" },
];

export const quantumPulse: QuantumPulse[] = [
  { id: "p1", label: "Projects in flow", value: "18", status: "healthy" },
  { id: "p2", label: "Crews synchronized", value: "42", status: "info" },
  { id: "p3", label: "Equipment under watch", value: "6", status: "attention" },
  { id: "p4", label: "Critical attention", value: "3", status: "critical" },
];

export const quantumTwinNodes: QuantumTwinNode[] = [
  { id: "n1", label: "Project Northpoint", x: 80, y: 66, group: "project", status: "healthy" },
  { id: "n2", label: "Crew Alpha", x: 230, y: 88, group: "crew", status: "info" },
  { id: "n3", label: "Crane Cluster", x: 410, y: 78, group: "equipment", status: "attention" },
  { id: "n4", label: "Dispatch Control", x: 210, y: 214, group: "operations", status: "orion" },
  { id: "n5", label: "Project Oak", x: 430, y: 228, group: "project", status: "critical" },
  { id: "n6", label: "Crew Bravo", x: 110, y: 202, group: "crew", status: "healthy" },
  { id: "n7", label: "Fleet Yard Delta", x: 316, y: 156, group: "equipment", status: "attention" },
];

export const quantumTwinLinks: QuantumTwinLink[] = [
  { id: "l1", from: "n1", to: "n2" },
  { id: "l2", from: "n2", to: "n3" },
  { id: "l3", from: "n2", to: "n4" },
  { id: "l4", from: "n4", to: "n5" },
  { id: "l5", from: "n1", to: "n4" },
  { id: "l6", from: "n6", to: "n4" },
  { id: "l7", from: "n7", to: "n3" },
  { id: "l8", from: "n7", to: "n5" },
];
