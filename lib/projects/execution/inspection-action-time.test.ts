import assert from "node:assert/strict";
import { assertInspectionActionTime } from "./inspection-action-time";
import { createProjectExecutionService } from "./service";

const now = "2026-11-07T16:00:00Z";
const future = "2026-11-08T14:00:00Z";
assert.throws(() => assertInspectionActionTime({ nextStatus: "in_progress", scheduledAt: future, now }), /Reschedule it/);
for (const nextStatus of ["passed", "failed"]) assert.throws(() => assertInspectionActionTime({ nextStatus, scheduledAt: future, completedAt: now, now }), /cannot be completed before/);
for (const nextStatus of ["in_progress", "passed", "failed"]) assert.doesNotThrow(() => assertInspectionActionTime({ nextStatus, scheduledAt: now, completedAt: now, now }));
assert.doesNotThrow(() => assertInspectionActionTime({ nextStatus: "in_progress", scheduledAt: "2026-11-07T10:00:00-05:00", now }));
assert.doesNotThrow(() => assertInspectionActionTime({ nextStatus: "cancelled", scheduledAt: future, now }));
assert.throws(() => assertInspectionActionTime({ nextStatus: "in_progress", scheduledAt: "invalid", now }), /schedule is invalid/);
assert.throws(() => assertInspectionActionTime({ nextStatus: "in_progress", scheduledAt: now, reinspectionRequired: true, reinspectionAt: future, now }), /scheduled for the future/);
assert.doesNotThrow(() => assertInspectionActionTime({ nextStatus: "in_progress", scheduledAt: now, reinspectionRequired: false, reinspectionAt: future, now }));

async function main() {
  for (const action of ["startInspection", "passInspection", "failInspection"] as const) {
    let writes = 0;
    const filters: Record<string, unknown> = {};
    const row = { id: "synthetic-inspection", status: action === "startInspection" ? "scheduled" : "in_progress", scheduled_at: "2099-01-01T00:00:00Z" };
    const builder = { eq(column: string, value: unknown) { filters[column] = value; return builder; }, async maybeSingle() { return { data: row, error: null }; } };
    const fake = { from(table: string) { assert.equal(table, "project_inspections", "blocked actions must not publish workflow events"); return { select() { return builder; }, update() { writes += 1; throw new Error("Unexpected write"); } }; } };
    const service = createProjectExecutionService(fake as unknown as Parameters<typeof createProjectExecutionService>[0]);
    await assert.rejects(service[action]({ companyId: "synthetic-company", actorProfileId: null, inspectionId: row.id }), /scheduled for the future|cannot be completed before/);
    assert.deepEqual(filters, { company_id: "synthetic-company", id: row.id });
    assert.equal(writes, 0, `${action} must reject before mutation`);
  }
  let reschedulePatch: Record<string, unknown> = {};
  const row = { id: "synthetic-reinspection", status: "reinspection_required", scheduled_at: now, reinspection_required: true, reinspection_date: future };
  const builder = { eq() { return builder; }, async maybeSingle() { return { data: row, error: null }; } };
  const fake = { from() { return { select() { return builder; }, update(patch: Record<string, unknown>) { reschedulePatch = patch; throw new Error("captured reschedule"); } }; } };
  const service = createProjectExecutionService(fake as unknown as Parameters<typeof createProjectExecutionService>[0]);
  await assert.rejects(service.rescheduleInspection({ companyId: "synthetic-company", actorProfileId: null, inspectionId: row.id, scheduledAt: now }), /captured reschedule/);
  assert.equal(reschedulePatch.scheduled_at, now);
  assert.equal(reschedulePatch.reinspection_date, now, "rescheduling a required reinspection must move both dates");
  assert.equal(reschedulePatch.reinspection_required, undefined, "rescheduling must not clear the outstanding reinspection requirement");
  console.log("Inspection timing checks passed: early start/result blocked before writes/events; company scope, exact start, offsets, reinspection rescheduling and cancellation preserved.");
}
void main();
