export type CrewStatus = "active" | "standby" | "inactive";

export type CrewAvailabilityStatus = "available" | "assigned" | "off_shift" | "pto" | "training" | "unavailable";

export type CrewSortKey =
  | "name_asc"
  | "name_desc"
  | "lead_asc"
  | "lead_desc"
  | "members_desc"
  | "utilization_desc"
  | "last_activity_desc";

export type CrewMember = {
  employeeId: string;
  fullName: string;
  role: string;
  position: string;
  employmentStatus: "active" | "on_leave" | "inactive";
  availabilityStatus: "available" | "assigned" | "off_shift";
  assignedCrewId?: string | null;
  primaryCrew: boolean;
  joinedOn: string;
};

export type CrewAssignment = {
  id: string;
  projectId: string;
  projectName: string;
  role: string;
  startDate: string;
  endDate: string | null;
  estimatedManpower: number;
  actualManpower: number;
  allocationPercentage: number;
  status: "active" | "upcoming" | "completed";
};

export type CrewScheduleEntry = {
  id: string;
  date: string;
  shift: "day" | "swing" | "night";
  availabilityStatus: CrewAvailabilityStatus;
  assignment: string | null;
  hasConflict: boolean;
};

export type CrewCertification = {
  id: string;
  name: string;
  validUntil: string | null;
  compliant: boolean;
};

export type CrewEquipmentItem = {
  id: string;
  name: string;
  status: "available" | "in_use" | "maintenance";
};

export type CrewActivityItem = {
  id: string;
  title: string;
  details: string;
  happenedAt: string;
};

export type CrewHistoryEntry = {
  id: string;
  change: string;
  changedAt: string;
  changedBy: string;
};

export type CrewAnalytics = {
  utilizationPercentage: number;
  laborAvailability: number;
  overtimeRisk: number;
  certificationCompliance: number;
  workload: number;
  productivity: number;
  safetyIncidents: number;
  scheduleConflicts: number;
};

export type Crew = {
  id: string;
  name: string;
  code: string;
  lead: string;
  supervisor: string;
  avatarUrl: string | null;
  status: CrewStatus;
  availability: CrewAvailabilityStatus;
  primarySpecialty: string;
  secondarySpecialties: string[];
  homeLocation: string;
  currentProject: string | null;
  memberCount: number;
  utilization: number;
  certificationCompliance: number;
  scheduleConflicts: number;
  lastActivity: string;
  notes: string;
  members: CrewMember[];
  assignments: CrewAssignment[];
  schedule: CrewScheduleEntry[];
  certifications: CrewCertification[];
  skills: string[];
  safetyMetrics: {
    incidents30d: number;
    nearMisses30d: number;
    lastIncidentDate: string | null;
  };
  productivityMetrics: {
    completedTasks7d: number;
    plannedTasks7d: number;
    onTimePercentage: number;
  };
  equipment: CrewEquipmentItem[];
  recentActivity: CrewActivityItem[];
  history: CrewHistoryEntry[];
};

export type CrewDashboardSummary = {
  totalCrews: number;
  activeCrews: number;
  availableCrews: number;
  assignedCrews: number;
  averageCrewSize: number;
  utilization: number;
  certificationCompliance: number;
  schedulingConflicts: number;
};

export type CrewFilters = {
  query: string;
  status: CrewStatus | "all";
  availability: CrewAvailabilityStatus | "all";
  specialty: string;
  sortBy: CrewSortKey;
  page: number;
  pageSize: number;
};

export type CrewListResult = {
  items: Crew[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type UpsertCrewInput = {
  name: string;
  code: string;
  lead: string;
  supervisor: string;
  status: CrewStatus;
  availability: CrewAvailabilityStatus;
  primarySpecialty: string;
  secondarySpecialties: string[];
  homeLocation: string;
  currentProject: string | null;
  notes: string;
  members: CrewMember[];
};

export type CrewEmployeeOption = {
  employeeId: string;
  fullName: string;
  position: string;
  employmentStatus: "active" | "on_leave" | "inactive";
  availabilityStatus: "available" | "assigned" | "off_shift";
  assignedCrewId?: string | null;
};

export type ProjectCrewAssignmentSummary = {
  crewId: string;
  crewName: string;
  role: string;
  startDate: string;
  estimatedManpower: number;
  actualManpower: number;
  allocationPercentage: number;
};
