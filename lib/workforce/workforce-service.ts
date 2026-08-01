import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  normalizeCrewDirectory,
  normalizeCrewProfile,
  normalizeEmployeeDirectory,
  normalizeEmployeeProfile,
} from "./workforce-normalizer";
import { createWorkforceRepository } from "./workforce-repository";
import type {
  CrewDirectoryFilters,
  CrewDirectoryResult,
  CrewProfileData,
  EmployeeDirectoryFilters,
  EmployeeDirectoryResult,
  EmployeeProfileData,
  WorkforceAssignmentFilters,
  WorkforceAssignmentRow,
  WorkforceCrewRow,
  WorkforceEmployeeRow,
  WorkforceMembershipFilters,
  WorkforceMembershipRow,
  WorkforceService,
} from "./workforce-types";

type WorkforceClient = SupabaseClient<Database>;

type ContextLoad = {
  employees: WorkforceEmployeeRow[];
  crews: WorkforceCrewRow[];
  memberships: WorkforceMembershipRow[];
  assignments: WorkforceAssignmentRow[];
  partialNotices: string[];
  profiles: Array<{ id: string; first_name: string | null; last_name: string | null }>;
  projects: Array<{ id: string; name: string }>;
  phases: Array<{ id: string; project_id: string; name: string }>;
  tasks: Array<{ id: string; project_id: string; phase_id: string | null; title: string }>;
  equipment: Array<{
    id: string;
    equipment_number: string;
    name: string;
    status: string;
    maintenance_status: string;
    assigned_job_id: string | null;
    assigned_crew_id: string | null;
    assigned_employee_id: string | null;
    expected_return_date: string | null;
  }>;
};

async function loadContext(
  companyId: string,
  loadCore: () => Promise<Pick<ContextLoad, "employees" | "crews" | "memberships" | "assignments">>,
  loadSecondary: () => Promise<
    Array<PromiseSettledResult<unknown>>
  >,
): Promise<ContextLoad> {
  const core = await loadCore();
  const partialNotices: string[] = [];

  const [profilesResult, projectsResult, phasesResult, tasksResult, equipmentResult] = await loadSecondary();

  const profiles = profilesResult.status === "fulfilled"
    ? (profilesResult.value as ContextLoad["profiles"])
    : [];
  const projects = projectsResult.status === "fulfilled"
    ? (projectsResult.value as ContextLoad["projects"])
    : [];
  const phases = phasesResult.status === "fulfilled"
    ? (phasesResult.value as ContextLoad["phases"])
    : [];
  const tasks = tasksResult.status === "fulfilled"
    ? (tasksResult.value as ContextLoad["tasks"])
    : [];
  const equipment = equipmentResult.status === "fulfilled"
    ? (equipmentResult.value as ContextLoad["equipment"])
    : [];

  if (profilesResult.status === "rejected") {
    partialNotices.push("Profile names are partially unavailable right now.");
  }

  if (projectsResult.status === "rejected" || phasesResult.status === "rejected" || tasksResult.status === "rejected") {
    partialNotices.push("Project, phase, or task labels are partially unavailable right now.");
  }

  if (equipmentResult.status === "rejected") {
    partialNotices.push("Equipment relationships are partially unavailable right now.");
  }

  return {
    ...core,
    profiles,
    projects,
    phases,
    tasks,
    equipment,
    partialNotices,
  };
}

export function createWorkforceService(supabase: WorkforceClient): WorkforceService {
  const repository = createWorkforceRepository(supabase);

  const fetchContext = async (companyId: string): Promise<ContextLoad> => loadContext(
    companyId,
    async () => {
      const [employees, crews, memberships, assignments] = await Promise.all([
        repository.listEmployees(companyId),
        repository.listCrews(companyId),
        repository.listCrewMemberships(companyId),
        repository.listWorkforceAssignments(companyId),
      ]);

      return {
        employees,
        crews,
        memberships,
        assignments,
      };
    },
    async () => Promise.allSettled([
      repository.listProfiles(companyId),
      repository.listProjects(companyId),
      repository.listPhases(companyId),
      repository.listTasks(companyId),
      repository.listEquipment(companyId),
    ]),
  );

  return {
    async listEmployees(companyId) {
      return repository.listEmployees(companyId);
    },

    async getEmployee(companyId, employeeId) {
      return repository.getEmployee(companyId, employeeId);
    },

    async listCrews(companyId) {
      return repository.listCrews(companyId);
    },

    async getCrew(companyId, crewId) {
      return repository.getCrew(companyId, crewId);
    },

    async listCrewMemberships(companyId, filters: WorkforceMembershipFilters = {}) {
      return repository.listCrewMemberships(companyId, filters);
    },

    async listWorkforceAssignments(companyId, filters: WorkforceAssignmentFilters = {}) {
      return repository.listWorkforceAssignments(companyId, filters);
    },

    async getEmployeeDirectory(companyId, filters: EmployeeDirectoryFilters): Promise<EmployeeDirectoryResult> {
      const context = await fetchContext(companyId);

      return normalizeEmployeeDirectory({
        employees: context.employees,
        crews: context.crews,
        memberships: context.memberships,
        assignments: context.assignments,
        projects: context.projects,
        phases: context.phases,
        tasks: context.tasks,
        profiles: context.profiles,
        equipment: context.equipment,
        filters,
        partialNotices: context.partialNotices,
      });
    },

    async getEmployeeProfile(companyId, employeeId): Promise<EmployeeProfileData | null> {
      const context = await fetchContext(companyId);
      const directory = normalizeEmployeeDirectory({
        employees: context.employees,
        crews: context.crews,
        memberships: context.memberships,
        assignments: context.assignments,
        projects: context.projects,
        phases: context.phases,
        tasks: context.tasks,
        profiles: context.profiles,
        equipment: context.equipment,
        filters: {
          query: "",
          employmentStatus: "all",
          availabilityStatus: "all",
          crewId: "all",
          supervisorId: "all",
          projectId: "all",
          sortBy: "name_asc",
          page: 1,
          pageSize: Math.max(1, context.employees.length),
        },
        partialNotices: context.partialNotices,
      });

      return normalizeEmployeeProfile({
        employeeId,
        directory,
        memberships: directory.membershipViews,
        assignments: directory.assignmentViews,
        equipment: directory.equipment,
      });
    },

    async getCrewDirectory(companyId, filters: CrewDirectoryFilters): Promise<CrewDirectoryResult> {
      const context = await fetchContext(companyId);

      return normalizeCrewDirectory({
        crews: context.crews,
        employees: context.employees,
        memberships: context.memberships,
        assignments: context.assignments,
        projects: context.projects,
        phases: context.phases,
        tasks: context.tasks,
        profiles: context.profiles,
        equipment: context.equipment,
        filters,
        partialNotices: context.partialNotices,
      });
    },

    async getCrewProfile(companyId, crewId): Promise<CrewProfileData | null> {
      const context = await fetchContext(companyId);
      const directory = normalizeCrewDirectory({
        crews: context.crews,
        employees: context.employees,
        memberships: context.memberships,
        assignments: context.assignments,
        projects: context.projects,
        phases: context.phases,
        tasks: context.tasks,
        profiles: context.profiles,
        equipment: context.equipment,
        filters: {
          query: "",
          status: "all",
          leadId: "all",
          supervisorId: "all",
          projectId: "all",
          assignmentStatus: "all",
          sortBy: "name_asc",
          page: 1,
          pageSize: Math.max(1, context.crews.length),
        },
        partialNotices: context.partialNotices,
      });

      return normalizeCrewProfile({
        crewId,
        directory,
        memberships: directory.membershipViews,
        assignments: directory.assignmentViews,
        equipment: directory.equipment,
      });
    },
  };
}