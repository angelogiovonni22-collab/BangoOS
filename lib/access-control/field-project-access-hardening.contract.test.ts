import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canAccessPath, hasBosPermission } from "./permissions";

const read = (path: string) => readFileSync(path, "utf8");
const projectsPage = read("app/(app)/projects/page.tsx");
const projectTable = read("components/projects/project-table.tsx");
const migration = read("supabase/migrations/20260831014748_field_project_access_hardening.sql");

assert.equal(canAccessPath("employee", "/crews/field"), true, "employees retain their field workspace");
assert.equal(canAccessPath("employee", "/crews"), false, "employees cannot browse the company crew directory");
assert.equal(canAccessPath("employee", "/employees"), false, "employees cannot browse workforce records");
assert.equal(canAccessPath("employee", "/projects/new"), false, "employees cannot open the project creation route");
assert.equal(canAccessPath("employee", "/projects/deleted"), false, "employees cannot open deleted projects");
assert.equal(canAccessPath("project_manager", "/projects/new"), true, "project managers retain project creation access");
assert.equal(hasBosPermission("employee", "project_financials.view"), false, "employees cannot view project financials");
assert.equal(hasBosPermission("employee", "projects.manage"), false, "employees cannot create or manage projects");

assert.match(projectsPage, /canManageProjects \? \(/, "project creation must be permission-gated");
assert.match(projectsPage, /showFinancials=\{showFinancials\}/, "the directory must receive a financial visibility boundary");
assert.match(projectTable, /showFinancials \? <EnterpriseTableHeading>/, "financial columns must be hidden without permission");
assert.match(projectTable, /canManageProjects \? <Link href="\/projects\/deleted">/, "deleted projects must be limited to project managers");

assert.match(migration, /private\.can_access_internal_project/, "project reads must use an assignment-aware RLS helper");
assert.match(migration, /membership\.role in \('foreman', 'employee'\)/, "field roles must use assignment-scoped access");
assert.match(migration, /assignment\.employee_id = employee\.id/, "direct employee assignments must grant project access");
assert.match(migration, /crew_member\.employee_id = employee\.id/, "crew assignments must grant project access");
assert.match(migration, /array\['owner', 'administrator', 'operations_manager', 'project_manager'\]/, "project mutation must remain management-only");

console.log("+ field project access hardening invariants hold");
