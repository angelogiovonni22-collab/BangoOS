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

function toCrewStatus(status: string): "active" | "inactive" | "archived" {
  if (status === "standby") {
    return "inactive";
  }

  if (status === "archived") {
    return "archived";
  }

  if (status === "inactive") {
    return "inactive";
  }

  return "active";
}

function toCrew(input: UpsertCrewInput, row: {
  id: string;
  crew_code: string;
  name: string;
  status: string;
  lead_profile_id: string | null;
  supervisor_profile_id: string | null;
  description: string | null;
  home_location: string | null;
  notes: string | null;
  updated_at: string;
}) {
  const memberCount = input.members.length;
  const primaryCount = input.members.filter((member) => member.primaryCrew).length;
  const availability = input.availability === "assigned" ? "assigned" : "available";

  return {
    id: row.id,
    crewCode: row.crew_code,
    name: row.name,
    status: row.status as "active" | "inactive" | "archived",
    leadName: input.lead || null,
    leadProfileId: input.leadProfileId ?? row.lead_profile_id,
    supervisorName: input.supervisor || null,
    supervisorProfileId: input.supervisorProfileId ?? row.supervisor_profile_id,
    homeLocation: row.home_location,
    description: row.description,
    notes: row.notes,
    activeMemberCount: memberCount,
    primaryMemberCount: primaryCount,
    currentAssignmentId: null,
    currentAssignmentTitle: input.currentProject,
    currentProjectId: null,
    currentProjectName: input.currentProject,
    currentPhaseOrTask: null,
    currentAssignmentStatus: null,
    nextAssignmentTitle: null,
    nextProjectName: null,
    updatedAt: row.updated_at,
    equipmentCount: 0,
    projectEquipmentCount: 0,
    hasEquipmentConflict: false,
    availability,
    isActive: row.status === "active",
    code: row.crew_code,
    lead: input.lead || null,
    supervisor: input.supervisor || null,
    primarySpecialty: input.primarySpecialty,
    secondarySpecialties: input.secondarySpecialties,
    currentProject: input.currentProject,
    members: input.members,
  } satisfies Crew;
}

async function resolveContext() {
  const supabase = createClient();
  const workspace = await resolveWorkspaceContext(supabase);

  if (!supabase || !workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve workforce workspace context.");
  }

  return {
    workforce: createWorkforceService(supabase),
    workspace: workspace.context,
  };
}

async function syncCrewMemberships(params: {
  companyId: string;
  actorProfileId: string;
  crewId: string;
  input: UpsertCrewInput;
  workforce: ReturnType<typeof createWorkforceService>;
}) {
  const existingActive = await params.workforce.listCrewMemberships(params.companyId, {
    crewId: params.crewId,
    status: "active",
  });

  const byEmployeeId = new Map(existingActive.map((membership) => [membership.employee_id, membership]));
  const seenEmployees = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);

  for (const member of params.input.members) {
    seenEmployees.add(member.employeeId);
    const existing = byEmployeeId.get(member.employeeId);

    if (!existing) {
      await params.workforce.addCrewMembership(params.companyId, params.actorProfileId, {
        crew_id: params.crewId,
        employee_id: member.employeeId,
        role: member.role,
        is_primary: member.primaryCrew,
        starts_on: member.joinedOn || today,
        status: "active",
      });
      continue;
    }

    await params.workforce.updateCrewMembership(params.companyId, params.actorProfileId, existing.id, {
      role: member.role,
      is_primary: member.primaryCrew,
      status: "active",
      ends_on: null,
    });
  }

  for (const membership of existingActive) {
    if (seenEmployees.has(membership.employee_id)) {
      continue;
    }

    await params.workforce.endCrewMembership(
      params.companyId,
      params.actorProfileId,
      membership.id,
      today,
    );
  }
}

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
      const employees = await loadEmployeeRowsImpl();
      return employees.map((employee) => ({
        employeeId: employee.id,
        fullName: employee.employee_number,
        position: employee.position_title,
        employmentStatus: employee.employment_status === "terminated"
          ? "inactive"
          : employee.employment_status === "leave"
            ? "on_leave"
            : employee.employment_status,
        availabilityStatus: employee.availability_status === "unavailable" || employee.availability_status === "restricted" || employee.availability_status === "unknown"
          ? "off_shift"
          : employee.availability_status,
        assignedCrewId: employee.primary_crew_id,
      }));
    },

    async getCrewsForProject(projectName) {
      void projectName;
      return [];
    },

    async createCrew(input) {
      const { workforce, workspace } = await resolveContext();
      const created = await workforce.createCrew(workspace.companyId, workspace.userId, {
        crew_code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.primarySpecialty.trim() || null,
        status: toCrewStatus(input.status),
        lead_profile_id: input.leadProfileId ?? null,
        supervisor_profile_id: input.supervisorProfileId ?? null,
        home_location: input.homeLocation.trim() || null,
        notes: input.notes.trim() || null,
      });

      await syncCrewMemberships({
        companyId: workspace.companyId,
        actorProfileId: workspace.userId,
        crewId: created.id,
        input,
        workforce,
      });

      return toCrew(input, created);
    },

    async updateCrew(crewId, input) {
      const { workforce, workspace } = await resolveContext();
      const updated = await workforce.updateCrew(workspace.companyId, workspace.userId, crewId, {
        crew_code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.primarySpecialty.trim() || null,
        status: toCrewStatus(input.status),
        lead_profile_id: input.leadProfileId ?? null,
        supervisor_profile_id: input.supervisorProfileId ?? null,
        home_location: input.homeLocation.trim() || null,
        notes: input.notes.trim() || null,
      });

      if (!updated) {
        return null;
      }

      await syncCrewMemberships({
        companyId: workspace.companyId,
        actorProfileId: workspace.userId,
        crewId: updated.id,
        input,
        workforce,
      });

      return toCrew(input, updated);
    },
  };
}
