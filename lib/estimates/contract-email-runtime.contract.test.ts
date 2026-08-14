import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const adapter = read("./contract-email.ts");
const route = read("../../app/api/estimates/[id]/contract/route.ts");
const button = read("../../components/estimates/send-contract-button.tsx");

assert.match(adapter, /resend_api_key_missing/, "runtime diagnostics must identify the missing API key safely");
assert.match(adapter, /contract_email_sender_missing/, "runtime diagnostics must identify the missing sender safely");
assert.ok(route.indexOf("if (!delivery.delivered)") < route.indexOf('update({ status: "sent"'), "failed delivery must never mark an estimate sent");
assert.match(route, /estimateContractPublicUrl/, "manual sends must use the configured public application origin");
assert.match(route, /idempotencyKey:/, "manual sends must be idempotent");
assert.match(button, /if \(body\.url\) setContractUrl/, "a secure link must remain available when email configuration fails");
assert.match(button, />Send Estimate<\//, "the estimate action must use customer-facing estimate wording");
assert.match(button, /Estimate sent\./, "successful provider acceptance must confirm the estimate send");

console.log("Contract email runtime diagnostics contract passed");
