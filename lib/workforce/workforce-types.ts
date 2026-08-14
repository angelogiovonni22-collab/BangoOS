export type WorkforceEmployeeStatus = "active" | "inactive" | "leave" | "terminated";

export type WorkforceEmployeeAvailabilityStatus = "available" | "assigned" | "unavailable" | "restricted" | "unknown";

export type WorkforceCrewStatus = "active" | "inactive" | "archived";

export type WorkforceMembershipStatus = "active" | "ended" | "planned";

export type WorkforceAssignmentType = "crew" | "employee";

export type WorkforceAssignmentStatus = "planned" | "confirmed" | "in_progress" | "completed" | "cancelled";

export type WorkforceAssignmentSourceType = "manual" | "schedule" | "task" | "project" | "import";

export type SelectOption = {
  id: string;
  label: string;
};

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

export type WorkforceProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type WorkforceProjectRow = {
  id: string;
  name: string;
};

export type WorkforcePhaseRow = {
  id: string;
  project_id: string;
  name: string;
};

export type WorkforceTaskRow = {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
};

export type WorkforceEquipmentRow = {
  id: string;
  equipment_number: string;
  name: string;
  status: string;
  maintenance_status: string;
  assigned_job_id: string | null;
  assigned_crew_id: string | null;
  assigned_employee_id: string | null;
  expected_return_date: string | null;
};

export type WorkforceEventEntityType = "employee" | "crew" | "crew_membership";

export type WorkforceEventAction = "create" | "update" | "archive" | "add" | "end";

export type WorkforceEventInput = {
  companyId: string;
  eventType: string;
  entityType: WorkforceEventEntityType;
  entityId: string;
  action: WorkforceEventAction;
  actorProfileId: string | null;
  payload: Record<string, unknown>;
};

export type WorkforceCreateEmployeeInput = {
  employee_number: string;
  profile_id: string | null;
  trade: string | null;
  position_title: string;
  employment_status: WorkforceEmployeeStatus;
  primary_crew_id: string | null;
  hire_date: string;
  availability_status: WorkforceEmployeeAvailabilityStatus;
  notes: string | null;
};

export type WorkforceUpdateEmployeeInput = Partial<WorkforceCreateEmployeeInput>;

export type WorkforceCreateCrewInput = {
  crew_code: string;
  name: string;
  description: string | null;
  status: WorkforceCrewStatus;
  lead_profile_id: string | null;
  supervisor_profile_id: string | null;
  home_location: string | null;
  notes: string | null;
};

export type WorkforceUpdateCrewInput = Partial<WorkforceCreateCrewInput>;

export type WorkforceAddMembershipInput = {
  crew_id: string;
  employee_id: string;
  role: string;
  is_primary: boolean;
  starts_on: string;
  status: Extract<WorkforceMembershipStatus, "active" | "planned">;
};

export type WorkforceUpdateMembershipInput = {
  role?: string;
  is_primary?: boolean;
  starts_on?: string;
  ends_on?: string | null;
  status?: WorkforceMembershipStatus;
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

export type EmployeeDirectorySortKey =
  | "name_asc"
  | "name_desc"
  | "employee_number_asc"
  | "employee_number_desc"
  | "updated_desc"
  | "updated_asc";

export type CrewDirectorySortKey =
  | "name_asc"
  | "name_desc"
  | "members_desc"
  | "updated_desc";

export type EmployeeDirectoryFilters = {
  query: string;
  employmentStatus: WorkforceEmployeeStatus | "all";
  availabilityStatus: WorkforceEmployeeAvailabilityStatus | "all";
  crewId: string | "all";
  supervisorId: string | "all";
  projectId: string | "all";
  sortBy: EmployeeDirectorySortKey;
  page: number;
  pageSize: number;
};

export type CrewDirectoryFilters = {
  query: string;
  status: WorkforceCrewStatus | "all";
  leadId: string | "all";
  supervisorId: string | "all";
  projectId: string | "all";
  assignmentStatus: WorkforceAssignmentStatus | "none" | "all";
  sortBy: CrewDirectorySortKey;
  page: number;
  pageSize: number;
};

export type WorkforceAssignmentView = {
  id: string;
  assignmentType: WorkforceAssignmentType;
  status: WorkforceAssignmentStatus;
  sourceType: WorkforceAssignmentSourceType;
  title: string;
  startsAt: string;
  endsAt: string;
  plannedHours: number;
  notes: string | null;
  projectId: string;
  projectName: string;
  phaseId: string | null;
  phaseName: string | null;
  taskId: string | null;
  taskName: string | null;
  crewId: string | null;
  crewName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  bucket: "current" | "upcoming" | "completed";
  isCurrent: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  hasConflict: boolean;
  displayTaskOrPhase: string | null;
};

export type CrewMembershipView = {
  id: string;
  crewId: string;
  crewName: string;
  employeeId: string;
  employeeName: string;
  role: string;
  isPrimary: boolean;
  startsOn: string;
  endsOn: string | null;
  status: WorkforceMembershipStatus;
  isCurrent: boolean;
};

export type WorkforceEquipmentContext = {
  id: string;
  equipmentNumber: string;
  name: string;
  status: string;
  maintenanceStatus: string;
  assignedJobId: string | null;
  assignedCrewId: string | null;
  assignedEmployeeId: string | null;
  expectedReturnDate: string | null;
  isInUse: boolean;
  isConflict: boolean;
  isOutOfService: boolean;
  href: string;
};

export type EmployeeDirectoryRow = {
  id: string;
  employeeNumber: string;
  fullName: string;
  positionTitle: string;
  trade: string | null;
  employmentStatus: WorkforceEmployeeStatus;
  availabilityStatus: WorkforceEmployeeAvailabilityStatus;
  supervisorName: string | null;
  supervisorProfileId: string | null;
  primaryCrewId: string | null;
  primaryCrewName: string | null;
  currentAssignmentId: string | null;
  currentAssignmentTitle: string | null;
  currentProjectId: string | null;
  currentProjectName: string | null;
  currentPhaseOrTask: string | null;
  currentAssignmentStatus: WorkforceAssignmentStatus | null;
  hireDate: string;
  updatedAt: string;
  notes: string | null;
  terminationDate: string | null;
  assignmentBucket: "current" | "upcoming" | "completed" | null;
  equipmentCount: number;
};

export type CrewDirectoryRow = {
  id: string;
  crewCode: string;
  name: string;
  status: WorkforceCrewStatus;
  leadName: string | null;
  leadProfileId: string | null;
  supervisorName: string | null;
  supervisorProfileId: string | null;
  homeLocation: string | null;
  description: string | null;
  notes: string | null;
  activeMemberCount: number;
  primaryMemberCount: number;
  currentAssignmentId: string | null;
  currentAssignmentTitle: string | null;
  currentProjectId: string | null;
  currentProjectName: string | null;
  currentPhaseOrTask: string | null;
  currentAssignmentStatus: WorkforceAssignmentStatus | null;
  nextAssignmentTitle: string | null;
  nextProjectName: string | null;
  updatedAt: string;
  equipmentCount: number;
  projectEquipmentCount: number;
  hasEquipmentConflict: boolean;
  availability: "available" | "assigned";
  isActive: boolean;
};

export type EmployeeDirectorySummary = {
  totalEmployees: number;
  activeToday: number;
  available: number;
  assignedToProjects: number;
  onLeave: number;
};

export type CrewDirectorySummary = {
  totalCrews: number;
  activeCrews: number;
  availableCrews: number;
  assignedCrews: number;
};

export type EmployeeDirectoryResult = {
  items: EmployeeDirectoryRow[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  summary: EmployeeDirectorySummary;
  options: {
    crewOptions: SelectOption[];
    supervisorOptions: SelectOption[];
    projectOptions: SelectOption[];
  };
  partialNotices: string[];
  assignmentViews: WorkforceAssignmentView[];
  membershipViews: CrewMembershipView[];
  equipment: WorkforceEquipmentContext[];
};

export type CrewDirectoryResult = {
  items: CrewDirectoryRow[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  summary: CrewDirectorySummary;
  options: {
    supervisorOptions: SelectOption[];
    leadOptions: SelectOption[];
    projectOptions: SelectOption[];
  };
  partialNotices: string[];
  assignmentViews: WorkforceAssignmentView[];
  membershipViews: CrewMembershipView[];
  equipment: WorkforceEquipmentContext[];
};

export type EmployeeProfileData = {
  overview: EmployeeDirectoryRow;
  memberships: {
    current: CrewMembershipView[];
    planned: CrewMembershipView[];
    ended: CrewMembershipView[];
  };
  assignments: {
    current: WorkforceAssignmentView[];
    upcoming: WorkforceAssignmentView[];
    completed: WorkforceAssignmentView[];
  };
  equipment: {
    direct: WorkforceEquipmentContext[];
    crew: WorkforceEquipmentContext[];
    project: WorkforceEquipmentContext[];
  };
  partialNotices: string[];
};

export type CrewProfileData = {
  overview: CrewDirectoryRow;
  memberships: {
    current: CrewMembershipView[];
    planned: CrewMembershipView[];
    ended: CrewMembershipView[];
  };
  assignments: {
    current: WorkforceAssignmentView[];
    upcoming: WorkforceAssignmentView[];
    completed: WorkforceAssignmentView[];
  };
  equipment: {
    crew: WorkforceEquipmentContext[];
    project: WorkforceEquipmentContext[];
  };
  partialNotices: string[];
};

export type WorkforceService = {
  listEmployees: (companyId: string) => Promise<WorkforceEmployeeRow[]>;
  getEmployee: (companyId: string, employeeId: string) => Promise<WorkforceEmployeeRow | null>;
  createEmployee: (companyId: string, actorProfileId: string, input: WorkforceCreateEmployeeInput) => Promise<WorkforceEmployeeRow>;
  updateEmployee: (companyId: string, actorProfileId: string, employeeId: string, input: WorkforceUpdateEmployeeInput) => Promise<WorkforceEmployeeRow | null>;
  archiveEmployee: (companyId: string, actorProfileId: string, employeeId: string) => Promise<WorkforceEmployeeRow | null>;
  listCrews: (companyId: string) => Promise<WorkforceCrewRow[]>;
  getCrew: (companyId: string, crewId: string) => Promise<WorkforceCrewRow | null>;
  createCrew: (companyId: string, actorProfileId: string, input: WorkforceCreateCrewInput) => Promise<WorkforceCrewRow>;
  updateCrew: (companyId: string, actorProfileId: string, crewId: string, input: WorkforceUpdateCrewInput) => Promise<WorkforceCrewRow | null>;
  listCrewMemberships: (companyId: string, filters?: WorkforceMembershipFilters) => Promise<WorkforceMembershipRow[]>;
  addCrewMembership: (companyId: string, actorProfileId: string, input: WorkforceAddMembershipInput) => Promise<WorkforceMembershipRow>;
  updateCrewMembership: (companyId: string, actorProfileId: string, membershipId: string, input: WorkforceUpdateMembershipInput) => Promise<WorkforceMembershipRow | null>;
  endCrewMembership: (companyId: string, actorProfileId: string, membershipId: string, endsOn: string) => Promise<WorkforceMembershipRow | null>;
  listWorkforceAssignments: (companyId: string, filters?: WorkforceAssignmentFilters) => Promise<WorkforceAssignmentRow[]>;
  getEmployeeDirectory: (companyId: string, filters: EmployeeDirectoryFilters) => Promise<EmployeeDirectoryResult>;
  getEmployeeProfile: (companyId: string, employeeId: string) => Promise<EmployeeProfileData | null>;
  getCrewDirectory: (companyId: string, filters: CrewDirectoryFilters) => Promise<CrewDirectoryResult>;
  getCrewProfile: (companyId: string, crewId: string) => Promise<CrewProfileData | null>;
};