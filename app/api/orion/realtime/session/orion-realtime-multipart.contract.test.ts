import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/orion/realtime/session/route.ts", "utf8");

assert.ok(
  route.includes('Content-Disposition: form-data; name="sdp"') && route.includes("Content-Type: application/sdp"),
  "Realtime call must send SDP as a named multipart field with application/sdp content type",
);
assert.ok(
  route.includes('Content-Disposition: form-data; name="session"') && route.includes("Content-Type: application/json"),
  "Realtime call must send session as a named JSON multipart field",
);
assert.ok(
  route.includes('"Content-Type": multipart.contentType'),
  "Realtime request must include the generated multipart boundary",
);
assert.equal(
  route.includes('new Blob([body.sdp]'),
  false,
  "SDP must not be encoded as a filename-bearing Blob because OpenAI expects the multipart field value",
);

console.log("Orion Realtime multipart regression tests passed.");
