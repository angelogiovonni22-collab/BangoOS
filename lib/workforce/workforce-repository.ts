import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  WorkforceAssignmentFilters,
  WorkforceAssignmentRow,
  WorkforceCrewRow,
  WorkforceEmployeeRow,
  WorkforceMembershipFilters,
  WorkforceMembershipRow,
  WorkforceEquipmentRow,
  WorkforcePhaseRow,
  WorkforceProfileRow,
  WorkforceProjectRow,
  WorkforceTaskRow,
} from "./workforce-types";

export type WorkforceRepository = {
  listEmployees: (companyId: string) => Promise<WorkforceEmployeeRow[]>;
  getEmployee: (companyId: string, employeeId: string) => Promise<WorkforceEmployeeRow | null>;
  listCrews: (companyId: string) => Promise<WorkforceCrewRow[]>;
  getCrew: (companyId: string, crewId: string) => Promise<WorkforceCrewRow | null>;
  listCrewMemberships: (companyId: string, filters?: WorkforceMembershipFilters) => Promise<WorkforceMembershipRow[]>;
  listWorkforceAssignments: (companyId: string, filters?: WorkforceAssignmentFilters) => Promise<WorkforceAssignmentRow[]>;
  listProfiles: (companyId: string) => Promise<WorkforceProfileRow[]>;
  listProjects: (companyId: string) => Promise<WorkforceProjectRow[]>;
  listPhases: (companyId: string) => Promise<WorkforcePhaseRow[]>;
  listTasks: (companyId: string) => Promise<WorkforceTaskRow[]>;
  listEquipment: (companyId: string) => Promise<WorkforceEquipmentRow[]>;
};

export function createWorkforceRepository(supabase: SupabaseClient<Database>): WorkforceRepository {
  return {
    async listEmployees(companyId) {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId)
        .order("employee_number", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as WorkforceEmployeeRow[];
    },

    async getEmployee(companyId, employeeId) {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", employeeId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data ?? null) as WorkforceEmployeeRow | null;
    },

    async listCrews(companyId) {
      const { data, error } = await supabase
        .from("crews")
        .select("*")
        .eq("company_id", companyId)
        .order("crew_code", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as WorkforceCrewRow[];
    },

    async getCrew(companyId, crewId) {
      const { data, error } = await supabase
        .from("crews")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", crewId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data ?? null) as WorkforceCrewRow | null;
    },

    async listCrewMemberships(companyId, filters: WorkforceMembershipFilters = {}) {
      let query = supabase
        .from("crew_memberships")
        .select("*")
        .eq("company_id", companyId)
        .order("starts_on", { ascending: false })
        .order("created_at", { ascending: true });

      if (filters.crewId) {
        query = query.eq("crew_id", filters.crewId);
      }

      if (filters.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data ?? []) as WorkforceMembershipRow[];
    },

    async listWorkforceAssignments(companyId, filters: WorkforceAssignmentFilters = {}) {
      let query = supabase
        .from("workforce_assignments")
        .select("*")
        .eq("company_id", companyId)
        .order("starts_at", { ascending: true })
        .order("created_at", { ascending: true });

      if (filters.assignmentType && filters.assignmentType !== "all") {
        query = query.eq("assignment_type", filters.assignmentType);
      }

      if (filters.crewId) {
        query = query.eq("crew_id", filters.crewId);
      }

      if (filters.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }

      if (filters.projectId) {
        query = query.eq("project_id", filters.projectId);
      }

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data ?? []) as WorkforceAssignmentRow[];
    },

    async listProfiles(companyId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("company_id", companyId)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as WorkforceProfileRow[];
    },

    async listProjects(companyId) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as WorkforceProjectRow[];
    },

    async listPhases(companyId) {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, project_id, name")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as WorkforcePhaseRow[];
    },

    async listTasks(companyId) {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, project_id, phase_id, title")
        .eq("company_id", companyId)
        .order("title", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as WorkforceTaskRow[];
    },

    async listEquipment(companyId) {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, equipment_number, name, status, maintenance_status, assigned_job_id, assigned_crew_id, assigned_employee_id, expected_return_date")
        .eq("company_id", companyId)
        .order("equipment_number", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as WorkforceEquipmentRow[];
    },
  };
}
