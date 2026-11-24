import assert from "node:assert/strict";
import { listSubmittedWorkforceTime } from "./workforce-time";

type Row = Record<string, unknown>;
type Deps = NonNullable<Parameters<typeof listSubmittedWorkforceTime>[0]>;
const companyId = "company-a";
const columns: Record<string, string[]> = {
  workforce_time_entries: ["id", "company_id", "employee_id", "project_id", "started_at", "ended_at", "break_minutes", "notes", "status", "clock_in_location", "clock_out_location"],
  employees: ["id", "company_id", "full_name", "profile_id", "employee_number", "position_title"],
  profiles: ["id", "company_id", "first_name", "last_name"],
  projects: ["id", "company_id", "name"],
};

function fixture(options: { role?: string; fail?: string; empty?: boolean; workspaceMissing?: boolean } = {}) {
  const tables: Record<string, Row[]> = {
    workforce_time_entries: options.empty ? [] : ["named", "legacy", "number", "partial"].map((id, index) => ({
      id: `time-${id}`, company_id: companyId, employee_id: id, project_id: "project-a",
      started_at: "2026-11-23T14:00:00Z", ended_at: "2026-11-23T18:30:00Z", break_minutes: 30,
      notes: "Synthetic only", status: index === 1 ? "rejected" : "submitted", clock_in_location: null, clock_out_location: null,
    })),
    employees: [
      { id: "named", company_id: companyId, full_name: " BOS Saved Employee ", profile_id: "profile-named", employee_number: "A-001", position_title: "Carpenter" },
      { id: "legacy", company_id: companyId, full_name: null, profile_id: "profile-legacy", employee_number: "A-002", position_title: "Carpenter" },
      { id: "number", company_id: companyId, full_name: " ", profile_id: null, employee_number: "A-003", position_title: "Carpenter" },
      { id: "partial", company_id: companyId, full_name: null, profile_id: "profile-partial", employee_number: "A-004", position_title: "Carpenter" },
      { id: "named", company_id: "company-b", full_name: "Wrong company", profile_id: null, employee_number: "B-001" },
    ],
    profiles: [
      { id: "profile-named", company_id: companyId, first_name: "Old", last_name: "Account Name" },
      { id: "profile-legacy", company_id: companyId, first_name: " Legacy ", last_name: " Employee " },
      { id: "profile-partial", company_id: companyId, first_name: null, last_name: " SingleName " },
      { id: "profile-legacy", company_id: "company-b", first_name: "Wrong", last_name: "Company" },
    ],
    projects: [
      { id: "project-a", company_id: companyId, name: "Synthetic Project" },
      { id: "project-a", company_id: "company-b", name: "Wrong company project" },
    ],
  };
  const calls: string[] = [];
  const db = {
    from(table: string) {
      assert.ok(columns[table], `Unexpected table ${table}`);
      calls.push(table);
      let selected: string[] = [];
      const filters: Array<(row: Row) => boolean> = [];
      let scoped = false;
      let max = Infinity;
      const query = {
        select(value: string) { selected = value.split(",").map(column => column.trim()); return query; },
        eq(column: string, value: unknown) {
          if (column === "company_id") { assert.equal(value, companyId); scoped = true; }
          filters.push(row => row[column] === value); return query;
        },
        in(column: string, values: unknown[]) { filters.push(row => values.includes(row[column])); return query; },
        order() { return query; },
        limit(count: number) { max = count; return query; },
        then(resolve: (value: { data: Row[] | null; error: { message: string } | null }) => unknown) {
          assert.ok(scoped, `${table} must be company scoped`);
          const invalid = selected.find(column => !columns[table].includes(column));
          if (options.fail === table || invalid) return Promise.resolve({ data: null, error: { message: invalid ? `Unknown column ${invalid}` : "Synthetic lookup failure" } }).then(resolve);
          const data = tables[table].filter(row => filters.every(filter => filter(row))).slice(0, max)
            .map(row => Object.fromEntries(selected.map(column => [column, row[column]])));
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  const deps: Deps = {
    supabaseClient: db as unknown as Deps["supabaseClient"],
    resolveWorkspace: (async () => options.workspaceMissing ? { context: null, errorMessage: "Workspace unavailable" }
      : { context: { companyId, userId: "reviewer", role: options.role || "owner" }, errorMessage: null }) as unknown as Deps["resolveWorkspace"],
  };
  return { deps, calls };
}

async function main() {
  const valid = fixture();
  const rows = await listSubmittedWorkforceTime(valid.deps);
  assert.deepEqual(rows.map(row => row.employeeName), ["BOS Saved Employee", "Legacy Employee", "A-003", "SingleName"]);
  assert.equal(rows[1].status, "rejected", "rejected entries remain available for correction");
  assert.ok(rows.every(row => row.hours === 4 && row.projectName === "Synthetic Project" && row.clockInLocation === null));
  for (const table of ["workforce_time_entries", "employees", "profiles", "projects"]) {
    await assert.rejects(listSubmittedWorkforceTime(fixture({ fail: table }).deps), table === "workforce_time_entries" ? /Synthetic lookup failure/ : /Unable to load/,
      `${table} failures must not turn into an apparently complete review list`);
  }
  const denied = fixture({ role: "employee" });
  await assert.rejects(listSubmittedWorkforceTime(denied.deps), /does not include workforce time approval/);
  assert.deepEqual(denied.calls, [], "reject unauthorized roles before querying time");
  const missing = fixture({ workspaceMissing: true });
  await assert.rejects(listSubmittedWorkforceTime(missing.deps), /Workspace unavailable/);
  assert.deepEqual(missing.calls, []);
  const empty = fixture({ empty: true });
  assert.deepEqual(await listSubmittedWorkforceTime(empty.deps), []);
  assert.deepEqual(empty.calls, ["workforce_time_entries"]);
  console.log("Workforce review identity passed: saved names, legacy profile names, number fallback, rejected time, net hours, company isolation, role gates, empty results and lookup failures.");
}
void main();
