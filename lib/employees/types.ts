import type {
  EmployeeDirectoryResult,
  EmployeeDirectoryRow,
  EmployeeDirectorySortKey,
  EmployeeProfileData,
  SelectOption,
  WorkforceEmployeeAvailabilityStatus,
  WorkforceEmployeeStatus,
} from "@/lib/workforce";

export type EmploymentStatus = WorkforceEmployeeStatus;

export type AvailabilityStatus = WorkforceEmployeeAvailabilityStatus;

export type SortKey = EmployeeDirectorySortKey;

export type Employee = EmployeeDirectoryRow & {
  avatarUrl?: string | null;
  position?: string;
  crew?: string;
  supervisor?: string;
  phone?: string;
  email?: string;
  currentAssignment?: string | null;
  activeToday?: boolean;
  hiredOn?: string;
  birthDate?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  certifications?: Array<{
    id: string;
    name: string;
    issuer: string;
    expiresAt: string | null;
  }>;
  skills?: string[];
  assignedProjects?: Array<{
    id: string;
    projectName: string;
    role: string;
    startDate: string;
    status: "active" | "upcoming" | "completed";
  }>;
  employmentHistory?: Array<{
    id: string;
    title: string;
    crew: string;
    startedOn: string;
    endedOn: string | null;
    summary: string;
  }>;
  notes?: string | null;
  primaryCrew?: string | null;
  secondaryCrew?: string | null;
  crewRole?: string | null;
  crewAssignedOn?: string | null;
  crewHistory?: Array<{
    id: string;
    crewName: string;
    role: string;
    startedOn: string;
    endedOn: string | null;
    primaryCrew: boolean;
  }>;
};

export type EmployeeProfile = EmployeeProfileData;

export type EmployeeDashboardSummary = {
  totalEmployees: number;
  activeToday: number;
  available: number;
  assignedToProjects: number;
  onLeave: number;
};

export type EmployeeFilters = {
  query: string;
  crewId: string;
  supervisorId: string;
  projectId: string;
  employmentStatus: EmploymentStatus | "all";
  availabilityStatus: AvailabilityStatus | "all";
  sortBy: SortKey;
  page: number;
  pageSize: number;
};

export type EmployeeListResult = {
  items: Employee[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  summary: EmployeeDashboardSummary;
  options: {
    crewOptions: SelectOption[];
    supervisorOptions: SelectOption[];
    projectOptions: SelectOption[];
  };
  partialNotices: string[];
};

export type UpsertEmployeeInput = {
  fullName: string;
  position: string;
  crew: string;
  supervisor: string;
  phone: string;
  email: string;
  employmentStatus: EmploymentStatus;
  availabilityStatus: AvailabilityStatus;
  currentAssignment: string | null;
  activeToday: boolean;
  hiredOn: string;
  birthDate: string;
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  certifications: Array<{
    id: string;
    name: string;
    issuer: string;
    expiresAt: string | null;
  }>;
  skills: string[];
  assignedProjects: Array<{
    id: string;
    projectName: string;
    role: string;
    startDate: string;
    status: "active" | "upcoming" | "completed";
  }>;
  employmentHistory: Array<{
    id: string;
    title: string;
    crew: string;
    startedOn: string;
    endedOn: string | null;
    summary: string;
  }>;
  notes: string;
  avatarUrl?: string | null;
};

export type EmployeeDirectoryPayload = EmployeeDirectoryResult;
