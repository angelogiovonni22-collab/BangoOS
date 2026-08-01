import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createWorkforceService } from "@/lib/workforce";
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
      void input;
      throw new Error("Employee editing is not available in CrewOS Phase 1.");
    },

    async updateEmployee(employeeId, input) {
      void employeeId;
      void input;
      throw new Error("Employee editing is not available in CrewOS Phase 1.");
    },
  };
}
