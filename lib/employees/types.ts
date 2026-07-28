export type EmploymentStatus = "active" | "on_leave" | "inactive";

export type AvailabilityStatus = "available" | "assigned" | "off_shift";

export type SortKey =
  | "name_asc"
  | "name_desc"
  | "position_asc"
  | "position_desc"
  | "crew_asc"
  | "crew_desc"
  | "status_asc"
  | "status_desc";

export type EmployeeCertification = {
  id: string;
  name: string;
  issuer: string;
  expiresAt: string | null;
};

export type EmployeeProjectAssignment = {
  id: string;
  projectName: string;
  role: string;
  startDate: string;
  status: "active" | "upcoming" | "completed";
};

export type EmploymentHistoryEntry = {
  id: string;
  title: string;
  crew: string;
  startedOn: string;
  endedOn: string | null;
  summary: string;
};

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

export type Employee = {
  id: string;
  avatarUrl: string | null;
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
  emergencyContact: EmergencyContact;
  certifications: EmployeeCertification[];
  skills: string[];
  assignedProjects: EmployeeProjectAssignment[];
  employmentHistory: EmploymentHistoryEntry[];
  notes: string;
};

export type EmployeeDashboardSummary = {
  totalEmployees: number;
  activeToday: number;
  available: number;
  assignedToProjects: number;
  onLeave: number;
};

export type EmployeeFilters = {
  query: string;
  crew: string;
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
  emergencyContact: EmergencyContact;
  certifications: EmployeeCertification[];
  skills: string[];
  assignedProjects: EmployeeProjectAssignment[];
  employmentHistory: EmploymentHistoryEntry[];
  notes: string;
  avatarUrl?: string | null;
};
