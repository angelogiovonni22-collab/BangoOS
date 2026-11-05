import assert from "node:assert/strict";
import { createFieldPhotoPreview } from "./field-photo-preview";

const revoked: string[] = [];
let next = 0, fail = false;
const preview = createFieldPhotoPreview({
  createObjectURL() { if (fail) throw new Error("Synthetic unsupported preview"); return "blob:synthetic-" + ++next; },
  revokeObjectURL(url) { revoked.push(url); },
});
const photo = new Blob(["synthetic image fixture"], { type: "image/jpeg" });
assert.equal(preview.replace(photo), "blob:synthetic-1");
assert.deepEqual(revoked, [], "keep the selected preview alive for rendering");
assert.equal(preview.replace(photo), "blob:synthetic-2");
assert.deepEqual(revoked, ["blob:synthetic-1"], "retaking replaces and releases the prior preview");
assert.equal(preview.replace(null), null);
assert.deepEqual(revoked, ["blob:synthetic-1", "blob:synthetic-2"], "removing or finishing an upload releases the preview");
preview.dispose();
assert.equal(revoked.length, 2, "repeated cleanup does not revoke a released URL twice");
assert.equal(preview.replace(photo), "blob:synthetic-3");
fail = true;
assert.equal(preview.replace(photo), null, "unsupported previews return a displayable fallback state");
assert.equal(revoked.at(-1), "blob:synthetic-3", "failed replacement does not leak the old preview");
fail = false;
assert.equal(preview.replace(photo), "blob:synthetic-4", "a later retake can recover");
preview.dispose();
assert.equal(revoked.at(-1), "blob:synthetic-4", "unmount releases the current preview");
console.log("Field photo preview lifecycle: 12 assertions passed.");
