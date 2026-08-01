export type WorkforceEmployeeStatus = "active" | "inactive" | "leave" | "terminated";

export type WorkforceEmployeeAvailabilityStatus = "available" | "assigned" | "unavailable" | "restricted" | "unknown";

export type WorkforceCrewStatus = "active" | "inactive" | "archived";

export type WorkforceMembershipStatus = "active" | "ended" | "planned";

export type WorkforceAssignmentType = "crew" | "employee";

export type WorkforceAssignmentStatus = "planned" | "confirmed" | "in_progress" | "completed" | "cancelled";

export type WorkforceAssignmentSourceType = "manual" | "schedule" | "task" | "project" | "import";

export type WorkforceEmployeeRow = {
  id: string;
  company_id: string;
  profile_id: string | null;
  employee_number: string;
  employment_status: WorkforceEmployeeStatus;
  position_title: string;
  trade: string | null;
  supervisor_profile_id: string | null;
  primary_crew_id: string | null;
  hire_date: string;
  termination_date: string | null;
  availability_status: WorkforceEmployeeAvailabilityStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkforceCrewRow = {
  id: string;
  company_id: string;
  crew_code: string;
  name: string;
  description: string | null;
  status: WorkforceCrewStatus;
  lead_profile_id: string | null;
  supervisor_profile_id: string | null;
  home_location: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkforceMembershipRow = {
  id: string;
  company_id: string;
  crew_id: string;
  employee_id: string;
  role: string;
  is_primary: boolean;
  starts_on: string;
  ends_on: string | null;
  status: WorkforceMembershipStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkforceAssignmentRow = {
  id: string;
  company_id: string;
  assignment_type: WorkforceAssignmentType;
  crew_id: string | null;
  employee_id: string | null;
  project_id: string;
  phase_id: string | null;
  task_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  planned_hours: number;
  status: WorkforceAssignmentStatus;
  source_type: WorkforceAssignmentSourceType;
  source_id: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkforceMembershipFilters = {
  crewId?: string;
  employeeId?: string;
  status?: WorkforceMembershipStatus | "all";
};

export type WorkforceAssignmentFilters = {
  crewId?: string;
  employeeId?: string;
  projectId?: string;
  status?: WorkforceAssignmentStatus | "all";
  assignmentType?: WorkforceAssignmentType | "all";
};

export type WorkforceService = {
  listEmployees: (companyId: string) => Promise<WorkforceEmployeeRow[]>;
  getEmployee: (companyId: string, employeeId: string) => Promise<WorkforceEmployeeRow | null>;
  listCrews: (companyId: string) => Promise<WorkforceCrewRow[]>;
  getCrew: (companyId: string, crewId: string) => Promise<WorkforceCrewRow | null>;
  listCrewMemberships: (companyId: string, filters?: WorkforceMembershipFilters) => Promise<WorkforceMembershipRow[]>;
  listWorkforceAssignments: (companyId: string, filters?: WorkforceAssignmentFilters) => Promise<WorkforceAssignmentRow[]>;
};