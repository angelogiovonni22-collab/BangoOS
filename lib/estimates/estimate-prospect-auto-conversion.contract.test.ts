import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const form = read("components/estimates/estimate-form.tsx");
const customerSection = read("components/estimates/estimate-customer-project-section.tsx");
const validation = read("lib/estimates/validation.ts");
const prospectService = read("lib/estimates/prospect-service.ts");
const sendRoute = read("app/api/estimates/[id]/contract/route.ts");
const signRoute = read("app/api/contracts/estimate/[token]/route.ts");
const migration = read("supabase/migrations/20260819233000_estimate_prospect_auto_conversion.sql");
const recoveryMigration = read("supabase/migrations/20260820033000_estimate_acceptance_conversion_recovery.sql");
const jobsiteMigration = read("supabase/migrations/20260820040825_estimate_project_jobsite_snapshot.sql");

assert.match(customerSection, /New prospective customer/, "estimate form must support a prospect without a pre-created customer");
assert.match(form, /saveEstimateProspect/, "estimate form must persist the prospect snapshot");
assert.match(form, /removeEstimateProspect/, "selecting an existing customer must retire stale prospect data");
assert.doesNotMatch(validation, /Customer is required\./, "estimate validation must not require a formal customer before quoting");
assert.match(prospectService, /estimate_prospects/, "prospect service must use the dedicated estimate prospect table");
assert.match(sendRoute, /linkedCustomer\?\.email \? linkedCustomer : prospect/, "email delivery must fall back to the prospect");
assert.match(signRoute, /linkedCustomer \|\| prospect/, "public signing must resolve customer identity from the prospect when needed");
assert.match(form, /action: \"draft\" \| \"continue\" \| \"changes\" \| \"send\"/, "estimate form must expose an explicit create-and-send action");
assert.match(form, /fetch\(`\/api\/estimates\/\$\{result\.estimateId\}\/contract`, \{ method: \"POST\" \}\)/, "create-and-send must save the estimate before calling the canonical send route");
assert.match(form, /isOhioResidential \? "Create Estimate & Review" : "Send Estimate"/, "Ohio residential estimates must enter compliance review before send while other estimates can still send directly");
assert.match(form, /\?sendIssue=\$\{encodeURIComponent\(sendIssue\)\}/, "create-and-send failures must survive navigation to the saved estimate");

const detail = read("components/estimates/estimate-detail.tsx");
assert.match(detail, /data-orion-status="estimate-send-error"/, "the saved estimate must show the send failure prominently");
assert.match(form, /mode === \"edit\" \? \"changes\" : \"send\"/, "submitting a new estimate must use the send path by default");
assert.match(form, /response\.json\(\)\.catch\(\(\) => \(\{\}\)\)/, "send response parsing must not strand the newly saved estimate");
assert.match(form, /catch \(sendError\)/, "network delivery failures must be isolated from estimate creation failures");
assert.match(form, /router\.push\(`\/estimates\/\$\{result\.estimateId\}`\)/, "delivery failure must route to the canonical saved estimate instead of allowing duplicate creation");
assert.match(sendRoute, /version_number/, "send route must load the estimate version for stable provider idempotency");
assert.match(sendRoute, /idempotencyKey: `estimate-contract\/\$\{workspace\.context\.companyId\}\/\$\{estimateId\}\/v\$\{Number\(estimate\.version_number \|\| 1\)\}\/token-\$\{result\.tokenId\}`/, "provider delivery idempotency must be scoped to the exact secure-link email body");
assert.doesNotMatch(sendRoute, /result\.token\.slice\(0, 16\)/, "provider idempotency must not depend on a newly generated token");
assert.match(migration, /pg_advisory_xact_lock/, "conversion must remain concurrency-safe and idempotent");
assert.match(migration, /lower\(btrim\(coalesce\(c\.email,''\)\)\)=v_email/, "conversion must strongly match existing customers by normalized email");
assert.match(migration, /regexp_replace\(coalesce\(c\.phone,''\)/, "conversion must strongly match existing customers by normalized phone");
assert.match(migration, /insert into public\.customers/, "verified acceptance must create a customer when no strong match exists");
assert.match(migration, /insert into public\.projects/, "verified acceptance must create the project after customer resolution");
assert.match(migration, /set customer_id=v_customer_id/, "conversion must link the estimate back to the resolved customer");

assert.match(recoveryMigration, /create trigger estimates_ensure_approved_conversion/, "approved estimates must have an automatic conversion guard");
assert.match(recoveryMigration, /after update of status, approval_signature_id on public\.estimates/, "conversion guard must run in the approval transaction");
assert.match(recoveryMigration, /convert_verified_estimate_contract\(/, "conversion guard must invoke the canonical idempotent conversion RPC");
assert.match(recoveryMigration, /and e\.converted_project_id is null/, "recovery migration must target only stranded approved estimates");
assert.match(recoveryMigration, /s\.verification_result = 'verified'/, "recovery must require a verified signature");
assert.match(recoveryMigration, /coalesce\(r\.updated_by, r\.created_by\)/, "recovery must preserve a company-scoped conversion actor when available");

assert.match(jobsiteMigration, /Reload the estimate prospect even after a strong Customer match/, "conversion must preserve the estimate's quoted jobsite snapshot after customer matching");
assert.match(jobsiteMigration, /coalesce\(nullif\(btrim\(coalesce\(v_prospect\.address_line_1, ''\)\), ''\), v_customer\.address_line_1\)/, "project address must prefer the estimate prospect jobsite over stale customer master address");
assert.match(jobsiteMigration, /coalesce\(nullif\(btrim\(coalesce\(v_prospect\.email, ''\)\), ''\), v_customer\.email\)/, "project contact must prefer the accepted estimate contact snapshot");

console.log("Estimate prospect auto-conversion contract passed.");
