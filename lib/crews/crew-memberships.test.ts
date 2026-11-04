import assert from "node:assert/strict";
import fs from "node:fs";
import { syncCrewMemberships } from "./crew-memberships";

async function verify(timeZone: string, instant: string, expected: string) {
  const added: Array<Record<string, unknown>> = [];
  const ended: string[] = [];
  const updated: Array<Record<string, unknown>> = [];
  const workforce = {
    listCrewMemberships: async () => [
      { id: "keep", employee_id: "existing", starts_on: "2020-01-01" },
      { id: "remove", employee_id: "removed", starts_on: "2020-01-01" },
    ],
    addCrewMembership: async (_company: string, _actor: string, input: Record<string, unknown>) => { added.push(input); },
    updateCrewMembership: async (_company: string, _actor: string, _id: string, input: Record<string, unknown>) => { updated.push(input); },
    endCrewMembership: async (_company: string, _actor: string, _id: string, date: string) => { ended.push(date); },
  };
  await syncCrewMemberships({
    companyId: "synthetic-company", actorProfileId: "synthetic-actor", crewId: "synthetic-crew",
    timeZone, now: new Date(instant), workforce: workforce as never,
    input: { members: [
      { employeeId: "new", joinedOn: "", role: "QA", primaryCrew: true },
      { employeeId: "existing", joinedOn: "2020-01-01", role: "QA", primaryCrew: false },
      { employeeId: "planned", joinedOn: "2026-12-01", role: "QA", primaryCrew: false },
    ] } as never,
  });
  assert.equal(added[0].starts_on, expected, "new membership uses the company calendar");
  assert.equal(added[1].starts_on, "2026-12-01", "explicit dates are preserved");
  assert.deepEqual(ended, [expected], "membership ends use the same company calendar");
  assert.equal(Object.hasOwn(updated[0], "starts_on"), false, "existing membership history is preserved");
}
async function main() {
  await verify("America/New_York", "2026-11-04T01:20:00Z", "2026-11-03");
  await verify("Pacific/Auckland", "2026-11-03T12:20:00Z", "2026-11-04");
  await verify("UTC", "2026-11-04T01:20:00Z", "2026-11-04");
  await verify("America/New_York", "2026-07-04T01:20:00Z", "2026-07-03");
  const form = fs.readFileSync("components/crews/crew-form.tsx", "utf8");
  assert.ok(!form.includes("joinedOn: new Date().toISOString()"), "form defers automatic dates to company-scoped save");
  const service = fs.readFileSync("lib/crews/service.ts", "utf8");
  assert.equal((service.match(/const timeZone = await loadScheduleTimeZone\(supabase, workspace.companyId\)/g) || []).length, 2);
  assert.equal((service.match(/await syncCrewMemberships\(\{\s*timeZone,/g) || []).length, 2);
  console.log("Crew membership company calendar: date boundaries, DST, explicit dates, removals, and historical preservation passed.");
}
void main();
