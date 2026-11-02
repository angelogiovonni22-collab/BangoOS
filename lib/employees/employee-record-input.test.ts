import assert from "node:assert/strict";
import fs from "node:fs";
import { employeeRecordInput } from "./employee-record-input";
import { formatEmployeeCalendarDate } from "./employee-calendar-date";
import { normalizeEmployeeDirectory } from "../workforce/workforce-normalizer";
import { archivedEmployeeState } from "../workforce/workforce-semantics";
import type { UpsertEmployeeInput } from "./types";
import type { WorkforceEmployeeRow } from "../workforce/workforce-types";

const input: UpsertEmployeeInput = {
  employeeNumber: " AUDIT-EMPLOYEE-1 ", fullName: " BOS Employee Audit ", position: " Carpenter ",
  trade: " Finish carpentry ", supervisorProfileId: "supervisor", supervisor: "Audit Supervisor",
  crew: "", phone: " 614-555-0100 ", email: " AUDIT@EXAMPLE.INVALID ",
  employmentStatus: "leave", availabilityStatus: "restricted", hiredOn: "2026-11-02", terminationDate: null,
  currentAssignment: null, activeToday: false, birthDate: "", address: "",
  emergencyContact: { name: "", relationship: "", phone: "" }, certifications: [], skills: [],
  assignedProjects: [], employmentHistory: [], notes: " Synthetic, no work or wages ",
};
const stored = JSON.parse(JSON.stringify({
  ...employeeRecordInput(input, "create"), id: "employee", company_id: "company",
  created_by: null, updated_by: null, created_at: "2026-11-02T12:00:00Z", updated_at: "2026-11-02T12:00:00Z",
})) as WorkforceEmployeeRow;
assert.equal(stored.full_name, "BOS Employee Audit");
assert.equal(stored.contact_email, "audit@example.invalid");
assert.equal(stored.contact_phone, "614-555-0100");
assert.equal(stored.supervisor_profile_id, "supervisor");
assert.equal(stored.primary_crew_id, null, "new employee does not inherit an archived or arbitrary crew");
assert.equal(stored.trade, "Finish carpentry", "trade is independent from crew membership");
assert.equal(stored.employment_status, "leave");
assert.equal(stored.availability_status, "restricted");
const normalize = (employee: WorkforceEmployeeRow, query = "") => normalizeEmployeeDirectory({
  employees: [employee], crews: [], memberships: [], assignments: [], projects: [], phases: [], tasks: [], equipment: [],
  profiles: [{ id: "supervisor", first_name: "Audit", last_name: "Supervisor" }, { id: "login", first_name: "Existing", last_name: "Account" }],
  filters: { query, crewId: "all", supervisorId: "all", projectId: "all", employmentStatus: "all", availabilityStatus: "all", sortBy: "name_asc", page: 1, pageSize: 20 },
});
const reloaded = normalize(stored).items[0];
assert.equal(reloaded.fullName, "BOS Employee Audit");
assert.equal(reloaded.phone, "614-555-0100");
assert.equal(reloaded.email, "audit@example.invalid");
assert.equal(reloaded.supervisorName, "Audit Supervisor");
assert.equal(normalize(stored, "AUDIT@EXAMPLE.INVALID").items.length, 1);
assert.equal(normalize(stored, "614-555-0100").items.length, 1);
assert.equal(normalize({ ...stored, profile_id: "login" }).items[0].fullName, "BOS Employee Audit", "employee identity does not require changing the linked account");
assert.equal(normalize({ ...stored, profile_id: "login", full_name: null }).items[0].fullName, "Existing Account", "legacy linked identity remains supported");
assert.equal(normalize({ ...stored, full_name: null }).items[0].fullName, "AUDIT-EMPLOYEE-1", "legacy unlinked records retain their number fallback");

const patch = JSON.parse(JSON.stringify(employeeRecordInput({ ...input, phone: "", email: "", trade: "", supervisorProfileId: null }, "edit")));
assert.equal(patch.contact_phone, null);
assert.equal(patch.contact_email, null);
assert.equal(patch.supervisor_profile_id, null);
assert.equal(patch.trade, null);
assert.ok(!("profile_id" in patch));
assert.ok(!("primary_crew_id" in patch), "ordinary employee edit preserves crew membership identity");
const cleared = normalize({ ...stored, ...patch }).items[0];
assert.equal(cleared.phone, null);
assert.equal(cleared.email, null);
assert.equal(cleared.supervisorName, null);
for (const employmentStatus of ["active", "leave", "inactive", "terminated"] as const) {
  assert.equal(employeeRecordInput({ ...input, employmentStatus, terminationDate: "2026-11-03" }, "edit").employment_status, employmentStatus);
}
for (const availabilityStatus of ["available", "assigned", "unavailable", "restricted", "unknown"] as const) {
  assert.equal(employeeRecordInput({ ...input, availabilityStatus }, "edit").availability_status, availabilityStatus);
}
assert.throws(() => employeeRecordInput({ ...input, employmentStatus: "terminated" }, "edit"), /Termination date/);
assert.throws(() => employeeRecordInput({ ...input, employeeNumber: "" }, "create"), /Employee number/);
assert.throws(() => employeeRecordInput({ ...input, email: "invalid" }, "edit"), /email/);
assert.throws(() => employeeRecordInput({ ...input, fullName: "" }, "edit"), /name/);
assert.throws(() => employeeRecordInput({ ...input, birthDate: "2000-01-01" }, "edit"), /unsupported/);
assert.throws(() => employeeRecordInput({ ...input, availabilityStatus: "invalid" as never }, "edit"), /Unsupported availability/);
assert.deepEqual(archivedEmployeeState({ employment_status: "terminated" }), { employment_status: "terminated", availability_status: "unavailable" }, "archiving retains termination status/date history");
assert.deepEqual(archivedEmployeeState({ employment_status: "leave" }), { employment_status: "inactive", availability_status: "unavailable" });

const read = (path: string) => fs.readFileSync(path, "utf8");
const form = read("components/employees/employee-form.tsx");
const service = read("lib/employees/service.ts");
assert.ok(service.includes('employeeRecordInput(input, "create")') && service.includes('employeeRecordInput(input, "edit")'));
assert.ok(form.includes('href="/crews"') && !form.includes("crewOptions[0]"));
assert.ok(form.includes('supervisorProfileId: state.supervisorProfileId || null'));
assert.ok(form.includes('role="alert"'));
assert.ok(form.includes('employees.validation.duplicateNumber') && form.includes('"23505"'));
const en = JSON.parse(read("locales/en/employees.json"));
const es = JSON.parse(read("locales/es/employees.json"));
for (const key of Object.keys(en).filter((key) => key.startsWith("recordStatus.") || key.startsWith("recordAvailability."))) assert.ok(es[key], key);
const previousTimezone = process.env.TZ;
try {
  process.env.TZ = "America/New_York";
  assert.equal(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date("2026-11-02")), "Nov 1, 2026", "reproduce the original previous-day display");
  for (const timezone of ["UTC", "America/New_York", "Pacific/Honolulu", "Pacific/Kiritimati"]) {
    process.env.TZ = timezone;
    for (const [date, expected] of [["2026-11-02", "Nov 2, 2026"], ["2026-03-08", "Mar 8, 2026"], ["2024-02-29", "Feb 29, 2024"]]) {
      assert.equal(formatEmployeeCalendarDate(date, "en-US"), expected, timezone);
    }
    assert.equal(formatEmployeeCalendarDate("2026-11-02", "es-ES"), "2 nov 2026", timezone);
  }
} finally {
  if (previousTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = previousTimezone;
}
const profileSections = read("components/employees/employee-profile-sections.tsx");
assert.ok(profileSections.includes("formatEmployeeCalendarDate(overview.hireDate, locale)") && profileSections.includes("formatEmployeeCalendarDate(overview.terminationDate, locale)"));
console.log("PASS: employee save/reload identity, contact/search, supervisor/clear, legacy accounts, membership preservation, all status enums, calendar dates and validation.");
