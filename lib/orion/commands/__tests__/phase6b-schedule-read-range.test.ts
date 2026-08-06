import assert from "node:assert/strict";
import { createOrionCommandRouter, createOrionCommandRegistry } from "../index";

type Row = Record<string, unknown>;

function createFakeSupabase() {
  const workflowInserts: Row[] = [];
  const companies = [{ id: "company-1", timezone: "America/Chicago" }];
  const workforceAssignments = [
    {
      id: "asg-1",
      company_id: "company-1",
      assignment_type: "crew",
      crew_id: "crew-1",
      employee_id: null,
      project_id: "project-1",
      phase_id: null,
      task_id: null,
      title: "Site visit",
      description: null,
      starts_at: "2026-08-05T14:00:00.000Z",
      ends_at: "2026-08-05T15:00:00.000Z",
      planned_hours: 1,
      status: "confirmed",
      source_type: "manual",
      source_id: null,
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "asg-2",
      company_id: "company-1",
      assignment_type: "employee",
      crew_id: null,
      employee_id: "employee-1",
      project_id: "project-1",
      phase_id: null,
      task_id: "task-1",
      title: "Inspection prep",
      description: null,
      starts_at: "2026-08-06T16:00:00.000Z",
      ends_at: "2026-08-06T18:00:00.000Z",
      planned_hours: 2,
      status: "planned",
      source_type: "task",
      source_id: null,
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
  ];
  const projects = [{ id: "project-1", name: "Lakeside" }];
  const crews = [{ id: "crew-1", company_id: "company-1", crew_code: "C-1", name: "Concrete Crew", description: null, status: "active", lead_profile_id: null, supervisor_profile_id: null, home_location: null, notes: null, created_by: null, updated_by: null, created_at: "", updated_at: "" }];
  const memberships = [{ id: "membership-1", company_id: "company-1", crew_id: "crew-1", employee_id: "employee-1", role: "member", is_primary: true, starts_on: "2026-01-01", ends_on: null, status: "active", created_by: null, updated_by: null, created_at: "", updated_at: "" }];
  const employees = [{ id: "employee-1", company_id: "company-1", profile_id: "profile-1", employee_number: "EMP-1", employment_status: "active", position_title: "Superintendent", trade: "General", supervisor_profile_id: null, primary_crew_id: "crew-1", hire_date: "2025-01-01", termination_date: null, availability_status: "available", notes: null, created_by: null, updated_by: null, created_at: "", updated_at: "" }];
  const profiles = [{ id: "profile-1", first_name: "Maya", last_name: "Rivera" }];

  function filterRows(rows: Row[], filters: Array<{ column: string; value: unknown }>) {
    return rows.filter((row) => filters.every((filter) => row[filter.column] === filter.value));
  }

  function buildSelect(table: string) {
    const filters: Array<{ column: string; value: unknown }> = [];
    const orders: Array<{ column: string; ascending: boolean }> = [];

    const builder = {
      eq(column: string, value: unknown) {
        filters.push({ column, value });
        return builder;
      },
      order(column: string, options: { ascending: boolean }) {
        orders.push({ column, ascending: options.ascending });
        return builder;
      },
      async maybeSingle() {
        const rows = resolveRows(table, filters, orders);
        return { data: rows[0] ?? null, error: null };
      },
      async single() {
        const rows = resolveRows(table, filters, orders);
        return { data: rows[0] ?? null, error: null };
      },
      async then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        return resolve({ data: resolveRows(table, filters, orders), error: null });
      },
    };

    return builder;
  }

  function resolveRows(table: string, filters: Array<{ column: string; value: unknown }>, orders: Array<{ column: string; ascending: boolean }>) {
    let rows: Row[] = [];
    if (table === "companies") rows = companies;
    if (table === "workforce_assignments") rows = workforceAssignments;
    if (table === "projects") rows = projects;
    if (table === "crews") rows = crews;
    if (table === "crew_memberships") rows = memberships;
    if (table === "employees") rows = employees;
    if (table === "profiles") rows = profiles;
    if (table === "project_phases") rows = [];
    if (table === "tasks") rows = [{ id: "task-1", project_id: "project-1", phase_id: null, title: "Inspection prep" }];

    let filtered = filterRows(rows, filters);
    for (const order of orders) {
      filtered = filtered.slice().sort((left, right) => {
        const leftValue = String(left[order.column] ?? "");
        const rightValue = String(right[order.column] ?? "");
        return order.ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
      });
    }
    return filtered;
  }

  return {
    workflowInserts,
    from(table: string) {
      if (table === "workflow_events") {
        return {
          insert(payload: Row) {
            workflowInserts.push(payload);
            return {
              select() {
                return {
                  async single() {
                    return { data: { id: `wf-${workflowInserts.length}` }, error: null };
                  },
                };
              },
            };
          },
          select() {
            return buildSelect(table);
          },
        };
      }

      return {
        select() {
          return buildSelect(table);
        },
      };
    },
  };
}

async function main() {
  const registry = createOrionCommandRegistry();
  const command = registry.getById("schedule.read_range");
  assert(command, "schedule.read_range is registered");
  assert.equal(command.confirmationLevel, "NONE", "schedule.read_range remains confirmation-free");
  assert.deepEqual(command.requiredPermissions, ["owner", "administrator", "operations_manager", "project_manager", "superintendent", "employee"], "schedule.read_range uses TEAM permissions");

  const valid = command.validate({ rangeType: "day", rangeKey: "today" });
  assert.equal(valid.ok, true, "validator accepts today day range");

  const invalid = command.validate({ rangeType: "day", rangeKey: "this_week" });
  assert.equal(invalid.ok, false, "validator rejects mismatched range key");

  const fakeSupabase = createFakeSupabase();
  const router = createOrionCommandRouter({ supabase: fakeSupabase as never });

  const result = await router.executeCommand({
    commandId: "schedule.read_range",
    params: {
      rangeType: "day",
      rangeKey: "today",
      timezone: "America/Chicago",
    },
    companyContext: { companyId: "company-1" },
    userContext: { actorProfileId: null, role: "employee" },
  });

  assert.equal(result.success, true, "schedule.read_range executes successfully");
  assert.equal(result.status, "completed", "schedule.read_range returns completed status");
  assert.equal(result.href, null, "schedule.read_range does not trigger navigation");
  assert.equal(result.details.resultType, "schedule_summary", "schedule.read_range returns structured summary type");
  assert.equal((result.details.items as unknown[]).length, 1, "today range filters to one item");
  assert.equal((result.details.range as { weekStartsOn: string }).weekStartsOn, "monday", "week convention matches schedule UI");
  assert.match(result.userMessage, /scheduled item today|scheduled items today/i, "read command returns spoken summary");
  assert.equal(fakeSupabase.workflowInserts.length > 0, true, "read command still records command history");
  assert.equal(fakeSupabase.workflowInserts[0]?.reference_id ?? null, null, "read command uses null history reference id");

  const tomorrow = await router.executeCommand({
    commandId: "schedule.read_range",
    params: {
      rangeType: "day",
      rangeKey: "tomorrow",
      timezone: "America/Chicago",
    },
    companyContext: { companyId: "company-1" },
    userContext: { actorProfileId: null, role: "employee" },
  });

  assert.equal((tomorrow.details.items as unknown[]).length, 1, "tomorrow range filters independently");

  const denied = await router.executeCommand({
    commandId: "schedule.read_range",
    params: {
      rangeType: "week",
      rangeKey: "this_week",
      timezone: "America/Chicago",
    },
    companyContext: { companyId: "company-1" },
    userContext: { actorProfileId: null, role: "accountant" },
  });

  assert.equal(denied.success, false, "permission enforcement remains server-side");
  assert.equal(denied.status, "rejected", "unauthorized schedule read is rejected");

  console.log("\nPhase 6B schedule read range results: passed");
}

void main();