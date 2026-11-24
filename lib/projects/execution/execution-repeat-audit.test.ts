import assert from "node:assert/strict";
import { createProjectExecutionService } from "./service";

type Row = Record<string, unknown>;
const companyId = "company-a";
const inspectionId = "11111111-1111-4111-8111-111111111111";
const permitId = "22222222-2222-4222-8222-222222222222";
const inspection: Row = { id: inspectionId, company_id: companyId, project_id: "project-a", status: "scheduled", scheduled_at: "2000-01-01T00:00:00Z", inspection_type: "Synthetic QA" };
const permit: Row = { id: permitId, company_id: companyId, project_id: "project-a", status: "issued", permit_type: "Synthetic QA" };
const events: Row[] = [];
const fake = {
  from(table: string) {
    assert(["project_inspections", "project_permits", "workflow_events"].includes(table), `Unexpected table ${table}`);
    const source = table === "project_inspections" ? [inspection] : table === "project_permits" ? [permit] : events;
    const filters: Row = {};
    const read = { eq(column: string, value: unknown) { filters[column] = value; return read; }, async maybeSingle() { return { data: source.find(row => Object.entries(filters).every(([key, value]) => row[key] === value)) || null, error: null }; } };
    return {
      select() { return read; },
      update(patch: Row) {
        const update = { eq(column: string, value: unknown) { filters[column] = value; return update; }, select() { return update; }, async single() {
          const row = source.find(row => Object.entries(filters).every(([key, value]) => row[key] === value));
          assert(row, "all updates must match company and record");
          assert.equal(filters.company_id, companyId);
          Object.assign(row, patch);
          return { data: { ...row }, error: null };
        } };
        return update;
      },
      insert(payload: Row) {
        assert.equal(table, "workflow_events");
        return { select() { return { async single() { const row = { ...payload }; events.push(row); return { data: row, error: null }; } }; } };
      },
    };
  },
};

async function main() {
  const service = createProjectExecutionService(fake as unknown as Parameters<typeof createProjectExecutionService>[0]);
  const actor = { companyId, actorProfileId: null };
  await service.startInspection({ ...actor, inspectionId });
  await service.failInspection({ ...actor, inspectionId, correctionNotes: "Synthetic correction" });
  await service.scheduleReinspection({ ...actor, inspectionId, reinspectionDate: "2000-01-02T00:00:00Z" });
  await service.startInspection({ ...actor, inspectionId });
  assert.equal(events.filter(event => event.event_type === "inspection.started").length, 2, "each legitimate inspection cycle must retain its own start event");
  await service.failInspection({ ...actor, inspectionId });
  await service.scheduleReinspection({ ...actor, inspectionId, reinspectionDate: "2000-01-03T00:00:00Z" });
  await service.rescheduleInspection({ ...actor, inspectionId, scheduledAt: "2000-01-03T00:00:00Z" });
  await service.rescheduleInspection({ ...actor, inspectionId, scheduledAt: "2000-01-04T00:00:00Z" });
  assert.equal(events.filter(event => event.event_type === "inspection.rescheduled").length, 2);
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await service.markPermitRenewalRequired({ ...actor, permitId });
    await service.renewPermit({ ...actor, permitId });
  }
  assert.equal(events.filter(event => event.event_type === "permit.renewed").length, 2, "renewal cycles must not collapse into the first event");
  const before = events.length;
  await service.startInspection({ ...actor, inspectionId, idempotencyKey: "explicit-retry-operation" });
  await service.startInspection({ ...actor, inspectionId, idempotencyKey: "explicit-retry-operation" });
  assert.equal(events.length, before + 1, "a caller's stable retry identity still deduplicates event publication");
  const saved = events.length;
  await assert.rejects(service.startInspection({ ...actor, companyId: "company-b", inspectionId }), /not found/);
  assert.equal(events.length, saved, "cross-company failures must not append history");
  console.log("Repeat execution audit checks passed: distinct inspection/reinspection/rescheduling and permit renewal events, explicit retry deduplication, and company isolation.");
}
void main();
