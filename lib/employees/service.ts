import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createWorkforceService } from "@/lib/workforce";
import type { WorkforceEmployeeRow } from "@/lib/workforce";
import type {
  EmployeeDirectoryPayload,
  EmployeeProfile,
  EmployeeDashboardSummary,
  EmployeeFilters,
  EmployeeListResult,
  Employee,
  UpsertEmployeeInput,
} from "./types";

export type EmployeeService = {
  getEmployees: (filters: EmployeeFilters) => Promise<EmployeeListResult>;
  getSummary: () => Promise<EmployeeDashboardSummary>;
  getEmployee: (employeeId: string) => Promise<EmployeeProfile | null>;
  getCrewOptions: () => Promise<Array<{ id: string; label: string }>>;
  getSupervisorOptions: () => Promise<Array<{ id: string; label: string }>>;
  getProjectOptions: () => Promise<Array<{ id: string; label: string }>>;
  createEmployee: (input: UpsertEmployeeInput) => Promise<Employee>;
  updateEmployee: (employeeId: string, input: UpsertEmployeeInput) => Promise<Employee | null>;
  archiveEmployee: (employeeId: string) => Promise<Employee | null>;
};

type EmployeeServiceDeps = {
  loadDirectory?: (filters: EmployeeFilters) => Promise<EmployeeDirectoryPayload>;
  loadEmployeeProfile?: (employeeId: string) => Promise<EmployeeProfile | null>;
};

const DEFAULT_DIRECTORY_FILTERS: EmployeeFilters = {
  query: "",
  crewId: "all",
  supervisorId: "all",
  projectId: "all",
  employmentStatus: "all",
  availabilityStatus: "all",
  sortBy: "name_asc",
  page: 1,
  pageSize: 1,
};

function toEmploymentStatus(status: string): "active" | "inactive" | "leave" {
  if (status === "on_leave" || status === "leave") {
    return "leave";
  }

  if (status === "inactive") {
    return "inactive";
  }

  return "active";
}

function toAvailabilityStatus(status: string): "available" | "assigned" | "unavailable" {
  if (status === "assigned") {
    return "assigned";
  }

  if (status === "off_shift") {
    return "unavailable";
  }

  return "available";
}

function normalizeEmployeeNumber(input: UpsertEmployeeInput): string {
  const explicit = input.employeeNumber?.trim();
  if (explicit) {
    return explicit;
  }

  const fromEmail = input.email
    .split("@")[0]
    ?.replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  if (fromEmail) {
    return `EMP-${fromEmail}`;
  }

  throw new Error("Employee number is required.");
}

async function resolveContext() {
  const supabase = createClient();
  const workspace = await resolveWorkspaceContext(supabase);

  if (!supabase || !workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve workforce workspace context.");
  }

  return {
    supabase,
    workspace: workspace.context,
    workforce: createWorkforceService(supabase),
  };
}

async function loadDirectory(filters: EmployeeFilters): Promise<EmployeeDirectoryPayload> {
  const supabase = createClient();
  const workspace = await resolveWorkspaceContext(supabase);

  if (!supabase || !workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve workforce workspace context.");
  }

  const workforce = createWorkforceService(supabase);
  return workforce.getEmployeeDirectory(workspace.context.companyId, {
    query: filters.query,
    crewId: filters.crewId,
    supervisorId: filters.supervisorId,
    projectId: filters.projectId,
    employmentStatus: filters.employmentStatus,
    availabilityStatus: filters.availabilityStatus,
    sortBy: filters.sortBy,
    page: filters.page,
    pageSize: filters.pageSize,
  });
}

async function loadEmployeeProfile(employeeId: string): Promise<EmployeeProfile | null> {
  const supabase = createClient();
  const workspace = await resolveWorkspaceContext(supabase);

  if (!supabase || !workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve workforce workspace context.");
  }

  const workforce = createWorkforceService(supabase);
  return workforce.getEmployeeProfile(workspace.context.companyId, employeeId);
}

function toEmployee(row: WorkforceEmployeeRow, input: Pick<
  UpsertEmployeeInput,
  "fullName" | "position" | "crew" | "supervisor" | "currentAssignment" | "activeToday" | "supervisorProfileId"
>): Employee {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    fullName: input.fullName,
    positionTitle: row.position_title,
    trade: row.trade,
    employmentStatus: row.employment_status,
    availabilityStatus: row.availability_status,
    supervisorName: input.supervisor || null,
    supervisorProfileId: input.supervisorProfileId ?? null,
    primaryCrewId: row.primary_crew_id,
    primaryCrewName: input.crew || null,
    currentAssignmentId: null,
    currentAssignmentTitle: input.currentAssignment,
    currentProjectId: null,
    currentProjectName: null,
    currentPhaseOrTask: null,
    currentAssignmentStatus: null,
    hireDate: row.hire_date,
    updatedAt: row.updated_at,
    notes: row.notes,
    terminationDate: row.termination_date,
    assignmentBucket: null,
    equipmentCount: 0,
    position: row.position_title,
    crew: input.crew,
    supervisor: input.supervisor,
    currentAssignment: input.currentAssignment,
    activeToday: input.activeToday,
    hiredOn: row.hire_date,
  } satisfies Employee;
}

export function createEmployeeService(deps: EmployeeServiceDeps = {}): EmployeeService {
  const loadDirectoryImpl = deps.loadDirectory ?? loadDirectory;
  const loadEmployeeProfileImpl = deps.loadEmployeeProfile ?? loadEmployeeProfile;
  let defaultDirectoryPromise: Promise<EmployeeDirectoryPayload> | null = null;

  const loadDefaultDirectory = async (): Promise<EmployeeDirectoryPayload> => {
    if (!defaultDirectoryPromise) {
      defaultDirectoryPromise = loadDirectoryImpl(DEFAULT_DIRECTORY_FILTERS).finally(() => {
        defaultDirectoryPromise = null;
      });
    }

    return defaultDirectoryPromise;
  };

  return {
    async getEmployees(filters) {
      const directory = await loadDirectoryImpl(filters);
      return {
        items: directory.items,
        total: directory.total,
        totalPages: directory.totalPages,
        page: directory.page,
        pageSize: directory.pageSize,
        summary: directory.summary,
        options: directory.options,
        partialNotices: directory.partialNotices,
      };
    },

    async getSummary() {
      const directory = await loadDefaultDirectory();

      return directory.summary;
    },

    async getEmployee(employeeId) {
      return loadEmployeeProfileImpl(employeeId);
    },

    async getCrewOptions() {
      const directory = await loadDefaultDirectory();

      return directory.options.crewOptions;
    },

    async getSupervisorOptions() {
      const directory = await loadDefaultDirectory();

      return directory.options.supervisorOptions;
    },

    async getProjectOptions() {
      const directory = await loadDefaultDirectory();

      return directory.options.projectOptions;
    },

    async createEmployee(input) {
      const { workforce, workspace } = await resolveContext();

      const created = await workforce.createEmployee(workspace.companyId, workspace.userId, {
        employee_number: normalizeEmployeeNumber(input),
        profile_id: input.profileId ?? null,
        trade: input.crew?.trim() || null,
        position_title: input.position.trim(),
        employment_status: toEmploymentStatus(input.employmentStatus),
        primary_crew_id: input.primaryCrewId ?? null,
        hire_date: input.hiredOn,
        availability_status: toAvailabilityStatus(input.availabilityStatus),
        notes: input.notes.trim() || null,
      });

      return toEmployee(created, {
        fullName: input.fullName,
        position: input.position,
        crew: input.crew,
        supervisor: input.supervisor,
        currentAssignment: input.currentAssignment,
        activeToday: input.activeToday,
        supervisorProfileId: input.supervisorProfileId,
      });
    },

    async updateEmployee(employeeId, input) {
      const { workforce, workspace } = await resolveContext();

      const updated = await workforce.updateEmployee(workspace.companyId, workspace.userId, employeeId, {
        employee_number: input.employeeNumber?.trim() || undefined,
        profile_id: input.profileId ?? undefined,
        trade: input.crew?.trim() || undefined,
        position_title: input.position.trim() || undefined,
        employment_status: toEmploymentStatus(input.employmentStatus),
        primary_crew_id: input.primaryCrewId ?? undefined,
        hire_date: input.hiredOn || undefined,
        availability_status: toAvailabilityStatus(input.availabilityStatus),
        notes: input.notes.trim() || null,
      });

      if (!updated) {
        return null;
      }

      return toEmployee(updated, {
        fullName: input.fullName,
        position: input.position,
        crew: input.crew,
        supervisor: input.supervisor,
        currentAssignment: input.currentAssignment,
        activeToday: input.activeToday,
        supervisorProfileId: input.supervisorProfileId,
      });
    },

    async archiveEmployee(employeeId) {
      const { workforce, workspace } = await resolveContext();
      const archived = await workforce.archiveEmployee(workspace.companyId, workspace.userId, employeeId);

      if (!archived) {
        return null;
      }

      return toEmployee(archived, {
        fullName: archived.employee_number,
        position: archived.position_title,
        crew: "",
        supervisor: "",
        currentAssignment: null,
        activeToday: false,
        supervisorProfileId: null,
      });
    },
  };
}
