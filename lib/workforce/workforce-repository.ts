import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createWorkforceEventRepository } from "./workforce-event-repository";
import type {
  WorkforceAddMembershipInput,
  WorkforceAssignmentFilters,
  WorkforceAssignmentRow,
  WorkforceCreateCrewInput,
  WorkforceCreateEmployeeInput,
  WorkforceCrewRow,
  WorkforceEmployeeRow,
  WorkforceMembershipFilters,
  WorkforceMembershipRow,
  WorkforceUpdateCrewInput,
  WorkforceUpdateEmployeeInput,
  WorkforceUpdateMembershipInput,
  WorkforceEquipmentRow,
  WorkforcePhaseRow,
  WorkforceProfileRow,
  WorkforceProjectRow,
  WorkforceTaskRow,
} from "./workforce-types";

export type WorkforceRepository = {
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
  listProfiles: (companyId: string) => Promise<WorkforceProfileRow[]>;
  listProjects: (companyId: string) => Promise<WorkforceProjectRow[]>;
  listPhases: (companyId: string) => Promise<WorkforcePhaseRow[]>;
  listTasks: (companyId: string) => Promise<WorkforceTaskRow[]>;
  listEquipment: (companyId: string) => Promise<WorkforceEquipmentRow[]>;
};

const EMPLOYEE_FIELDS: Array<keyof WorkforceCreateEmployeeInput> = [
  "employee_number",
  "profile_id",
  "trade",
  "position_title",
  "employment_status",
  "primary_crew_id",
  "hire_date",
  "availability_status",
  "notes",
];

const CREW_FIELDS: Array<keyof WorkforceCreateCrewInput> = [
  "crew_code",
  "name",
  "description",
  "status",
  "lead_profile_id",
  "supervisor_profile_id",
  "home_location",
  "notes",
];

function compactRecord(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}

function buildChangedFieldPayload<T extends Record<string, unknown>>(params: {
  idKey: string;
  idValue: string;
  before: T;
  after: T;
  keys: Array<keyof T>;
}) {
  const changedFields: Record<string, { before: unknown; after: unknown }> = {};

  for (const key of params.keys) {
    const beforeValue = params.before[key];
    const afterValue = params.after[key];
    if (!Object.is(beforeValue, afterValue)) {
      changedFields[String(key)] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  }

  return {
    [params.idKey]: params.idValue,
    changed_fields: changedFields,
  };
}

export function createWorkforceRepository(supabase: SupabaseClient<Database>): WorkforceRepository {
  const events = createWorkforceEventRepository(supabase);

  const getEmployeeById = async (companyId: string, employeeId: string) => {
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
  };

  const getCrewById = async (companyId: string, crewId: string) => {
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
  };

  const getMembershipById = async (companyId: string, membershipId: string) => {
    const { data, error } = await supabase
      .from("crew_memberships")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", membershipId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as WorkforceMembershipRow | null;
  };

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
      return getEmployeeById(companyId, employeeId);
    },

    async createEmployee(companyId, actorProfileId, input) {
      const { data, error } = await supabase
        .from("employees")
        .insert({
          company_id: companyId,
          created_by: actorProfileId,
          updated_by: actorProfileId,
          ...input,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const employee = data as WorkforceEmployeeRow;

      await events.recordEvent({
        companyId,
        eventType: "workforce.employee.created",
        entityType: "employee",
        entityId: employee.id,
        action: "create",
        actorProfileId,
        payload: {
          employee_id: employee.id,
          fields: compactRecord({
            employee_number: employee.employee_number,
            profile_id: employee.profile_id,
            trade: employee.trade,
            position_title: employee.position_title,
            employment_status: employee.employment_status,
            primary_crew_id: employee.primary_crew_id,
            hire_date: employee.hire_date,
            availability_status: employee.availability_status,
            notes: employee.notes,
          }),
        },
      });

      return employee;
    },

    async updateEmployee(companyId, actorProfileId, employeeId, input) {
      const before = await getEmployeeById(companyId, employeeId);
      if (!before) {
        return null;
      }

      const patch = compactRecord({
        ...input,
        updated_by: actorProfileId,
      });

      const { data, error } = await supabase
        .from("employees")
        .update(patch as Database["public"]["Tables"]["employees"]["Update"])
        .eq("company_id", companyId)
        .eq("id", employeeId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const employee = data as WorkforceEmployeeRow;

      await events.recordEvent({
        companyId,
        eventType: "workforce.employee.updated",
        entityType: "employee",
        entityId: employee.id,
        action: "update",
        actorProfileId,
        payload: buildChangedFieldPayload({
          idKey: "employee_id",
          idValue: employee.id,
          before,
          after: employee,
          keys: EMPLOYEE_FIELDS,
        }),
      });

      return employee;
    },

    async archiveEmployee(companyId, actorProfileId, employeeId) {
      const before = await getEmployeeById(companyId, employeeId);
      if (!before) {
        return null;
      }

      const { data, error } = await supabase
        .from("employees")
        .update({
          employment_status: "inactive",
          availability_status: "unavailable",
          updated_by: actorProfileId,
        })
        .eq("company_id", companyId)
        .eq("id", employeeId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const employee = data as WorkforceEmployeeRow;

      await events.recordEvent({
        companyId,
        eventType: "workforce.employee.archived",
        entityType: "employee",
        entityId: employee.id,
        action: "archive",
        actorProfileId,
        payload: buildChangedFieldPayload({
          idKey: "employee_id",
          idValue: employee.id,
          before,
          after: employee,
          keys: ["employment_status", "availability_status", "termination_date", "notes"],
        }),
      });

      return employee;
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
      return getCrewById(companyId, crewId);
    },

    async createCrew(companyId, actorProfileId, input) {
      const { data, error } = await supabase
        .from("crews")
        .insert({
          company_id: companyId,
          created_by: actorProfileId,
          updated_by: actorProfileId,
          ...input,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const crew = data as WorkforceCrewRow;

      await events.recordEvent({
        companyId,
        eventType: "workforce.crew.created",
        entityType: "crew",
        entityId: crew.id,
        action: "create",
        actorProfileId,
        payload: {
          crew_id: crew.id,
          fields: compactRecord({
            crew_code: crew.crew_code,
            name: crew.name,
            description: crew.description,
            status: crew.status,
            lead_profile_id: crew.lead_profile_id,
            supervisor_profile_id: crew.supervisor_profile_id,
            home_location: crew.home_location,
            notes: crew.notes,
          }),
        },
      });

      return crew;
    },

    async updateCrew(companyId, actorProfileId, crewId, input) {
      const before = await getCrewById(companyId, crewId);
      if (!before) {
        return null;
      }

      const patch = compactRecord({
        ...input,
        updated_by: actorProfileId,
      });

      const { data, error } = await supabase
        .from("crews")
        .update(patch as Database["public"]["Tables"]["crews"]["Update"])
        .eq("company_id", companyId)
        .eq("id", crewId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const crew = data as WorkforceCrewRow;

      await events.recordEvent({
        companyId,
        eventType: "workforce.crew.updated",
        entityType: "crew",
        entityId: crew.id,
        action: "update",
        actorProfileId,
        payload: buildChangedFieldPayload({
          idKey: "crew_id",
          idValue: crew.id,
          before,
          after: crew,
          keys: CREW_FIELDS,
        }),
      });

      return crew;
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

    async addCrewMembership(companyId, actorProfileId, input) {
      if (input.is_primary && input.status === "active") {
        const { error: clearPrimaryError } = await supabase
          .from("crew_memberships")
          .update({
            is_primary: false,
            updated_by: actorProfileId,
          })
          .eq("company_id", companyId)
          .eq("employee_id", input.employee_id)
          .eq("status", "active");

        if (clearPrimaryError) {
          throw clearPrimaryError;
        }
      }

      const { data, error } = await supabase
        .from("crew_memberships")
        .insert({
          company_id: companyId,
          created_by: actorProfileId,
          updated_by: actorProfileId,
          ...input,
          ends_on: null,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const membership = data as WorkforceMembershipRow;

      await events.recordEvent({
        companyId,
        eventType: "workforce.crew_membership.added",
        entityType: "crew_membership",
        entityId: membership.id,
        action: "add",
        actorProfileId,
        payload: {
          membership_id: membership.id,
          employee_id: membership.employee_id,
          crew_id: membership.crew_id,
          fields: compactRecord({
            crew_id: membership.crew_id,
            employee_id: membership.employee_id,
            role: membership.role,
            is_primary: membership.is_primary,
            starts_on: membership.starts_on,
            status: membership.status,
          }),
        },
      });

      return membership;
    },

    async updateCrewMembership(companyId, actorProfileId, membershipId, input) {
      const before = await getMembershipById(companyId, membershipId);
      if (!before) {
        return null;
      }

      const nextStatus = input.status ?? before.status;
      const nextIsPrimary = input.is_primary ?? before.is_primary;

      if (nextIsPrimary && nextStatus === "active") {
        const { error: clearPrimaryError } = await supabase
          .from("crew_memberships")
          .update({
            is_primary: false,
            updated_by: actorProfileId,
          })
          .eq("company_id", companyId)
          .eq("employee_id", before.employee_id)
          .eq("status", "active")
          .neq("id", membershipId);

        if (clearPrimaryError) {
          throw clearPrimaryError;
        }
      }

      const patch = compactRecord({
        ...input,
        updated_by: actorProfileId,
      });

      const { data, error } = await supabase
        .from("crew_memberships")
        .update(patch as Database["public"]["Tables"]["crew_memberships"]["Update"])
        .eq("company_id", companyId)
        .eq("id", membershipId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const membership = data as WorkforceMembershipRow;

      await events.recordEvent({
        companyId,
        eventType: "workforce.crew_membership.updated",
        entityType: "crew_membership",
        entityId: membership.id,
        action: "update",
        actorProfileId,
        payload: {
          ...buildChangedFieldPayload({
            idKey: "membership_id",
            idValue: membership.id,
            before,
            after: membership,
            keys: ["role", "is_primary", "starts_on", "ends_on", "status"],
          }),
          employee_id: membership.employee_id,
          crew_id: membership.crew_id,
        },
      });

      return membership;
    },

    async endCrewMembership(companyId, actorProfileId, membershipId, endsOn) {
      const before = await getMembershipById(companyId, membershipId);
      if (!before) {
        return null;
      }

      const { data, error } = await supabase
        .from("crew_memberships")
        .update({
          status: "ended",
          ends_on: endsOn,
          updated_by: actorProfileId,
        })
        .eq("company_id", companyId)
        .eq("id", membershipId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const membership = data as WorkforceMembershipRow;

      await events.recordEvent({
        companyId,
        eventType: "workforce.crew_membership.ended",
        entityType: "crew_membership",
        entityId: membership.id,
        action: "end",
        actorProfileId,
        payload: {
          ...buildChangedFieldPayload({
            idKey: "membership_id",
            idValue: membership.id,
            before,
            after: membership,
            keys: ["ends_on", "status"],
          }),
          employee_id: membership.employee_id,
          crew_id: membership.crew_id,
        },
      });

      return membership;
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
