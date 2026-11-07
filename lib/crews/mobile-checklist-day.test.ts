import assert from "node:assert/strict";
import test from "node:test";
import { checklistMatchesDay, dailyChecklistForDay, MOBILE_CHECKLIST_EVENT, selectDailyChecklists } from "./mobile-checklist-day";
import { createMobileChecklistDraftStore, type StoredChecklistDraft } from "./mobile-checklist-drafts";
import { createEmptyChecklist } from "./mobile-field-operations-types";

const completed = { ...createEmptyChecklist(), safetyBriefing: true, ppeVerification: true, equipmentInspection: true, dailyGoals: "Synthetic", updatedAt: "2026-11-07T02:00:00Z" };

test("legacy saved checks use the company day rather than the UTC day", () => {
  assert.equal(checklistMatchesDay(completed, "2026-11-06", "America/New_York"), true);
  assert.equal(checklistMatchesDay(completed, "2026-11-07", "America/New_York"), false);
  assert.equal(checklistMatchesDay(completed, "2026-11-07", "UTC"), true);
});

test("a later day starts with no inherited safety checks or notes", () => {
  assert.deepEqual(dailyChecklistForDay(completed, "2026-11-07", "America/New_York"), createEmptyChecklist());
});

test("positive UTC offsets and both sides of daylight-saving fallback retain the correct day", () => {
  assert.equal(checklistMatchesDay({ ...completed, updatedAt: "2026-11-06T12:00:00Z" }, "2026-11-07", "Pacific/Kiritimati"), true);
  for (const updatedAt of ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"]) {
    assert.equal(checklistMatchesDay({ ...completed, updatedAt }, "2026-11-01", "America/New_York"), true);
  }
});

test("an old offline replay cannot replace a newer work day's checklist", () => {
  const event = (workDate: string, note: string) => ({ event_type: MOBILE_CHECKLIST_EVENT, reference_id: "crew", occurred_at: "2026-11-08T01:00:00Z", payload: { crewId: "crew", checklist: { ...completed, workDate, supervisorNotes: note } } });
  const selected = selectDailyChecklists([event("2026-11-06", "old replay"), event("2026-11-07", "today")], "2026-11-07", "America/New_York");
  assert.equal(selected.crew.supervisorNotes, "today");
  assert.equal(selected.crew.workDate, "2026-11-07");
});

test("undated, invalid-date and unverifiable-calendar checks are not represented as complete", () => {
  assert.equal(checklistMatchesDay({ ...completed, updatedAt: null }, "2026-11-07", "UTC"), false);
  assert.equal(checklistMatchesDay({ ...completed, workDate: "2026-02-30" }, "2026-02-30", "UTC"), false);
  assert.equal(checklistMatchesDay(completed, "2026-11-07", null), false);
  assert.equal(checklistMatchesDay(completed, "2026-11-07", "Invalid/Zone"), false);
});

function memoryStorage() {
  const rows = new Map<string, StoredChecklistDraft>();
  return { rows, storage: { get: async (key: string) => rows.get(key), put: async (draft: StoredChecklistDraft) => { rows.set(draft.key, structuredClone(draft)); }, remove: async (key: string) => rows.delete(key) } };
}

test("device drafts isolate dates, crews, companies and users", async () => {
  const { storage } = memoryStorage();
  let scope = { companyId: "company-a", userId: "user-a" };
  const store = createMobileChecklistDraftStore(async () => scope, storage);
  await store.save("crew-a", "2026-11-06", completed);
  assert.equal((await store.load("crew-a", "2026-11-06", "America/New_York"))?.safetyBriefing, true);
  assert.equal(await store.load("crew-a", "2026-11-07", "America/New_York"), null);
  assert.equal(await store.load("crew-b", "2026-11-06", "America/New_York"), null);
  scope = { companyId: "company-b", userId: "user-a" };
  assert.equal(await store.load("crew-a", "2026-11-06", "America/New_York"), null);
  scope = { companyId: "company-a", userId: "user-b" };
  assert.equal(await store.load("crew-a", "2026-11-06", "America/New_York"), null);
});

test("legacy device notes recover only on their last-edited company day and remain preserved", async () => {
  const { rows, storage } = memoryStorage();
  const legacy = "company:user:crew";
  rows.set(legacy, { key: legacy, checklist: { ...completed, updatedAt: null }, updatedAt: "2026-11-07T02:00:00Z" });
  const store = createMobileChecklistDraftStore(async () => ({ companyId: "company", userId: "user" }), storage);
  assert.equal((await store.load("crew", "2026-11-06", "America/New_York"))?.workDate, "2026-11-06");
  assert.equal(await store.load("crew", "2026-11-07", "America/New_York"), null);
  assert.equal(rows.has(legacy), true, "previous device evidence is not deleted by the date migration");
});

test("clearing one saved day's device draft leaves other days intact", async () => {
  const { storage } = memoryStorage();
  const store = createMobileChecklistDraftStore(async () => ({ companyId: "company", userId: "user" }), storage);
  await store.save("crew", "2026-11-06", completed);
  await store.save("crew", "2026-11-07", completed);
  await store.remove("crew", "2026-11-07");
  assert.equal(await store.load("crew", "2026-11-07", "UTC"), null);
  assert.ok(await store.load("crew", "2026-11-06", "UTC"));
  await assert.rejects(store.save("crew", "2026-02-30", completed), /checklist date/);
});
