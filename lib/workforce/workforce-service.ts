import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkforceAssignmentFilters,
  WorkforceAssignmentRow,
  WorkforceCrewRow,
  WorkforceEmployeeRow,
  WorkforceMembershipFilters,
  WorkforceMembershipRow,
  WorkforceService,
} from "./workforce-types";

type WorkforceClient = SupabaseClient;

const EMPLOYEE_SELECT = "*";
const CREW_SELECT = "*";
const MEMBERSHIP_SELECT = "*";
const ASSIGNMENT_SELECT = "*";

export function createWorkforceService(supabase: WorkforceClient): WorkforceService {
  return {
    async listEmployees(companyId) {
      const { data, error } = await supabase
        .from("employees")
        .select(EMPLOYEE_SELECT)
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
        .select(EMPLOYEE_SELECT)
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
        .select(CREW_SELECT)
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
        .select(CREW_SELECT)
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
        .select(MEMBERSHIP_SELECT)
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
        .select(ASSIGNMENT_SELECT)
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
  };
}