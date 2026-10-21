import assert from "node:assert/strict";
import { normalizeCrewDirectory, normalizeCrewProfile } from "./workforce-normalizer";
import type { WorkforceAssignmentRow, WorkforceCrewRow } from "./workforce-types";

const now = Date.now();
const stamp = new Date(now).toISOString();
function crew(id: string, status: WorkforceCrewRow["status"]): WorkforceCrewRow {
  return { id, status, company_id: "company", crew_code: id, name: id, description: null,
    lead_profile_id: null, supervisor_profile_id: null, home_location: null, notes: null,
    created_by: null, updated_by: null, created_at: stamp, updated_at: stamp };
}
function assignment(crewId: string): WorkforceAssignmentRow {
  return { id: `assignment-${crewId}`, company_id: "company", assignment_type: "crew", crew_id: crewId,
    employee_id: null, project_id: "project", phase_id: null, task_id: null, title: crewId,
    description: null, starts_at: new Date(now - 3_600_000).toISOString(),
    ends_at: new Date(now + 3_600_000).toISOString(), planned_hours: 2, status: "confirmed",
    source_type: "manual", source_id: null, notes: null, created_by: null, updated_by: null,
    created_at: stamp, updated_at: stamp };
}
const crews = [crew("active-free", "active"), crew("active-booked", "active"),
  crew("inactive-free", "inactive"), crew("inactive-booked", "inactive"),
  crew("archived-free", "archived"), crew("archived-booked", "archived")];
const input = { crews, assignments: crews.filter(c => c.id.endsWith("booked")).map(c => assignment(c.id)),
  employees: [], memberships: [], projects: [{ id: "project", name: "Project" }], phases: [], tasks: [],
  profiles: [], equipment: [], filters: { query: "", status: "all" as const, leadId: "all", supervisorId: "all",
    projectId: "all", assignmentStatus: "all" as const, sortBy: "name_asc" as const, page: 1, pageSize: 20 } };
const directory = normalizeCrewDirectory(input);
assert.deepEqual(directory.summary, { totalCrews: 6, activeCrews: 2, availableCrews: 1, assignedCrews: 1 });
assert.equal(directory.items.length, 6, "inactive and archived records remain visible in history/all-status views");
const archived = normalizeCrewDirectory({ ...input, filters: { ...input.filters, status: "archived" } });
assert.equal(archived.total, 2, "the Archived filter still finds retained crews");
const profile = normalizeCrewProfile({ crewId: "archived-booked", directory,
  memberships: directory.membershipViews, assignments: directory.assignmentViews, equipment: directory.equipment });
assert.equal(profile?.overview.status, "archived");
assert.equal(profile?.assignments.current.length, 1, "status gating preserves existing assignment details");
console.log("crew availability and retained history regression passed");
