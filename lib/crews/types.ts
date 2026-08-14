import type {
  CrewDirectoryResult,
  CrewDirectoryRow,
  CrewDirectorySortKey,
  CrewProfileData,
  SelectOption,
  WorkforceAssignmentStatus,
  WorkforceCrewStatus,
} from "@/lib/workforce";

export type CrewStatus = WorkforceCrewStatus;

export type CrewAvailabilityStatus = "available" | "assigned" | "off_shift" | "pto" | "training" | "unavailable";

export type CrewSortKey = CrewDirectorySortKey;

export type Crew = CrewDirectoryRow & {
  code?: string | null;
  lead?: string | null;
  supervisor?: string | null;
  primarySpecialty?: string;
  secondarySpecialties?: string[];
  availability?: CrewAvailabilityStatus;
  homeLocation?: string | null;
  currentProject?: string | null;
  notes?: string | null;
  members?: CrewMember[];
};

export type CrewProfile = CrewProfileData;

export type CrewDashboardSummary = {
  totalCrews: number;
  activeCrews: number;
  availableCrews: number;
  assignedCrews: number;
};

export type CrewFilters = {
  query: string;
  status: CrewStatus | "all";
  leadId: string;
  supervisorId: string;
  projectId: string;
  assignmentStatus: WorkforceAssignmentStatus | "none" | "all";
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
  summary: CrewDashboardSummary;
  options: {
    leadOptions: SelectOption[];
    supervisorOptions: SelectOption[];
    projectOptions: SelectOption[];
  };
  partialNotices: string[];
};

export type CrewMember = {
  employeeId: string;
  fullName: string;
  role: string;
  position: string;
  employmentStatus: "active" | "on_leave" | "inactive";
  availabilityStatus: "available" | "assigned" | "off_shift";
  assignedCrewId: string | null;
  primaryCrew: boolean;
  joinedOn: string;
};

export type UpsertCrewInput = {
  leadProfileId?: string | null;
  supervisorProfileId?: string | null;
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
  assignedCrewId: string | null;
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

export type CrewDirectoryPayload = CrewDirectoryResult;
