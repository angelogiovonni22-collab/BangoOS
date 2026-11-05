import assert from "node:assert/strict";
import { createFieldPhotoDraftStore, type FieldPhotoDraft, type FieldPhotoDraftStorage } from "./field-photo-drafts";

async function main() {
  let checks = 0;
  const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };
  const rows = new Map<string, FieldPhotoDraft>();
  let failWrite = false;
  const storage: FieldPhotoDraftStorage = {
    async read(key) { return rows.has(key) ? structuredClone(rows.get(key)!) : null; },
    async write(key, draft) { if (failWrite) throw new Error("Simulated device quota failure"); await Promise.resolve(); if (draft) rows.set(key, structuredClone(draft)); else rows.delete(key); },
  };
  const scope = { companyId: "company-a", userId: "user-a", projectId: "project-a", draftKey: "crew-a:2026-11-05" };
  const store = () => createFieldPhotoDraftStore(scope, storage);
  const draft: FieldPhotoDraft = { file: new Blob(["synthetic photo bytes"], { type: "image/png" }), fileName: "synthetic.png", lastModified: 1234, note: "Synthetic recovery note", category: "inspection" };
  check(await store().load() === null, "new scope has no pending photo");
  await store().save(draft);
  const restored = await store().load();
  check(restored?.file instanceof Blob, "photo bytes survive a new store instance");
  check(await restored!.file.text() === "synthetic photo bytes", "restored bytes match exactly");
  check(restored?.file.type === "image/png" && restored.fileName === "synthetic.png" && restored.lastModified === 1234, "file metadata survives");
  check(restored?.note === draft.note && restored.category === "inspection", "note and category survive");
  for (const other of [
    { ...scope, companyId: "company-b" }, { ...scope, userId: "user-b" }, { ...scope, projectId: "project-b" },
    { ...scope, draftKey: "crew-b:2026-11-05" }, { ...scope, draftKey: "crew-a:2026-11-06" },
  ]) check(await createFieldPhotoDraftStore(other, storage).load() === null, "another account/project/crew/date cannot load this photo");
  const upload = { id: "uploaded-photo", fileName: draft.fileName, category: draft.category };
  await store().save({ ...draft, uploaded: upload });
  check((await store().load())?.uploaded?.id === upload.id, "acknowledged upload identity survives reopen before report handoff");
  const serial = store();
  const first = serial.save({ ...draft, note: "older note" });
  const second = serial.save({ ...draft, note: "latest note" });
  await Promise.all([first, second]);
  check((await serial.load())?.note === "latest note", "overlapping edits commit in order");
  const pending = serial.save(draft);
  const removal = serial.remove();
  await Promise.all([pending, removal]);
  check(await store().load() === null, "removal waits for pending saves and prevents stale recovery");
  failWrite = true;
  await assert.rejects(() => serial.save(draft), /quota/); checks++;
  failWrite = false;
  await serial.save(draft);
  check((await serial.load())?.fileName === draft.fileName, "failed local save does not poison later retry");
  failWrite = true;
  await assert.rejects(() => serial.remove(), /quota/); checks++;
  check((await serial.load())?.fileName === draft.fileName, "failed removal keeps the recovery copy");
  failWrite = false;
  await serial.remove();
  check(rows.size === 0, "successful removal clears only local photo data");
  assert.throws(() => createFieldPhotoDraftStore({ ...scope, userId: "" }, storage), /account/); checks++;
  console.log("Field photo device recovery: " + checks + " assertions passed.");
}
void main();
