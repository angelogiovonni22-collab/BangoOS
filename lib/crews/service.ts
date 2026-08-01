import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createWorkforceService } from "@/lib/workforce";
import type {
  Crew,
  CrewDashboardSummary,
  CrewEmployeeOption,
  CrewProfile,
  CrewFilters,
  CrewListResult,
  ProjectCrewAssignmentSummary,
  UpsertCrewInput,
} from "./types";
import type { WorkforceEmployeeRow } from "@/lib/workforce";

export type CrewService = {
  getCrews: (filters: CrewFilters) => Promise<CrewListResult>;
  getSummary: () => Promise<CrewDashboardSummary>;
  getCrew: (crewId: string) => Promise<CrewProfile | null>;
  getSpecialtyOptions: () => Promise<string[]>;
  getLeadOptions: () => Promise<Array<{ id: string; label: string }>>;
  getSupervisorOptions: () => Promise<Array<{ id: string; label: string }>>;
  getProjectOptions: () => Promise<Array<{ id: string; label: string }>>;
  getEmployeeOptions: () => Promise<CrewEmployeeOption[]>;
  getCrewsForProject: (projectName: string) => Promise<ProjectCrewAssignmentSummary[]>;
  createCrew: (input: UpsertCrewInput) => Promise<Crew>;
  updateCrew: (crewId: string, input: UpsertCrewInput) => Promise<Crew | null>;
};

type CrewDirectoryPayload = Awaited<ReturnType<typeof loadDirectory>>;

type CrewServiceDeps = {
  loadDirectory?: (filters: CrewFilters) => Promise<CrewDirectoryPayload>;
  loadCrewProfile?: (crewId: string) => Promise<CrewProfile | null>;
  loadEmployeeRows?: () => Promise<WorkforceEmployeeRow[]>;
};

const DEFAULT_DIRECTORY_FILTERS: CrewFilters = {
  query: "",
  status: "all",
  leadId: "all",
  supervisorId: "all",
  projectId: "all",
  assignmentStatus: "all",
  sortBy: "name_asc",
  page: 1,
  pageSize: 1,
};

async function loadDirectory(filters: CrewFilters) {
  const supabase = createClient();
  const workspace = await resolveWorkspaceContext(supabase);

  if (!supabase || !workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve workforce workspace context.");
  }

  const workforce = createWorkforceService(supabase);
  return workforce.getCrewDirectory(workspace.context.companyId, {
    query: filters.query,
    status: filters.status,
    leadId: filters.leadId,
    supervisorId: filters.supervisorId,
    projectId: filters.projectId,
    assignmentStatus: filters.assignmentStatus,
    sortBy: filters.sortBy,
    page: filters.page,
    pageSize: filters.pageSize,
  });
}

async function loadCrewProfile(crewId: string): Promise<CrewProfile | null> {
  const supabase = createClient();
  const workspace = await resolveWorkspaceContext(supabase);

  if (!supabase || !workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve workforce workspace context.");
  }

  const workforce = createWorkforceService(supabase);
  return workforce.getCrewProfile(workspace.context.companyId, crewId);
}

async function loadEmployeeRows(): Promise<WorkforceEmployeeRow[]> {
  const supabase = createClient();
  const workspace = await resolveWorkspaceContext(supabase);

  if (!supabase || !workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve workforce workspace context.");
  }

  const workforce = createWorkforceService(supabase);
  return workforce.listEmployees(workspace.context.companyId);
}

export function createCrewService(deps: CrewServiceDeps = {}): CrewService {
  const loadDirectoryImpl = deps.loadDirectory ?? loadDirectory;
  const loadCrewProfileImpl = deps.loadCrewProfile ?? loadCrewProfile;
  const loadEmployeeRowsImpl = deps.loadEmployeeRows ?? loadEmployeeRows;
  let defaultDirectoryPromise: Promise<CrewDirectoryPayload> | null = null;

  const loadDefaultDirectory = async (): Promise<CrewDirectoryPayload> => {
    if (!defaultDirectoryPromise) {
      defaultDirectoryPromise = loadDirectoryImpl(DEFAULT_DIRECTORY_FILTERS).finally(() => {
        defaultDirectoryPromise = null;
      });
    }

    return defaultDirectoryPromise;
  };

  return {
    async getCrews(filters) {
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

    async getCrew(crewId) {
      return loadCrewProfileImpl(crewId);
    },

    async getSpecialtyOptions() {
      const employees = await loadEmployeeRowsImpl();
      const seen = new Set<string>();
      const specialties: string[] = [];

      for (const employee of employees) {
        const trade = employee.trade?.trim();
        if (!trade) {
          continue;
        }

        const key = trade.toLowerCase();
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        specialties.push(trade);
      }

      return specialties.sort((left, right) => left.localeCompare(right));
    },

    async getLeadOptions() {
      const directory = await loadDefaultDirectory();

      return directory.options.leadOptions;
    },

    async getSupervisorOptions() {
      const directory = await loadDefaultDirectory();

      return directory.options.supervisorOptions;
    },

    async getProjectOptions() {
      const directory = await loadDefaultDirectory();

      return directory.options.projectOptions;
    },

    async getEmployeeOptions(): Promise<CrewEmployeeOption[]> {
      return [];
    },

    async getCrewsForProject(projectName) {
      void projectName;
      return [];
    },

    async createCrew(input) {
      void input;
      throw new Error("Crew editing is not available in CrewOS Phase 1.");
    },

    async updateCrew(crewId, input) {
      void crewId;
      void input;
      throw new Error("Crew editing is not available in CrewOS Phase 1.");
    },
  };
}
