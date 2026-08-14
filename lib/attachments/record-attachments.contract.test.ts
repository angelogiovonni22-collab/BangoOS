import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MAX_RECORD_ATTACHMENT_BYTES, validateRecordAttachment } from "./record-attachments";

test("record attachment validation accepts supported images and rejects invalid files", () => {
  assert.equal(validateRecordAttachment(new File(["photo"], "site.webp", { type: "image/webp" })), null);
  assert.match(validateRecordAttachment(new File(["data"], "notes.txt", { type: "text/plain" })) || "", /JPEG/);
  assert.match(validateRecordAttachment(new File([new Uint8Array(MAX_RECORD_ATTACHMENT_BYTES + 1)], "large.jpg", { type: "image/jpeg" })) || "", /10 MB/);
});

test("all new-record workflows mount the shared Orion-visible photo widget", () => {
  const files = [
    "app/(app)/customers/new/page.tsx",
    "components/estimates/estimate-form.tsx",
    "components/invoices/invoice-form.tsx",
    "app/(app)/projects/new/page.tsx",
  ];
  files.forEach((file) => assert.match(readFileSync(file, "utf8"), /RecordPhotoUpload/));
  const widget = readFileSync("components/attachments/record-photo-upload.tsx", "utf8");
  assert.match(widget, /data-orion-action="attachments\.choose"/);
  assert.match(widget, /capture="environment"/);
});

test("attachment migration enforces tenant and entity ownership", () => {
  const sql = readFileSync("supabase/migrations/20260811123000_record_attachments_foundation.sql", "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /record_attachment_entity_belongs_to_company/);
  assert.match(sql, /file_size_limit/);
  assert.match(sql, /record-attachments/);
});
