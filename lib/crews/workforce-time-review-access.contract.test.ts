import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),service=readFileSync(resolve(root,"lib/crews/workforce-time.ts"),"utf8"),surface=readFileSync(resolve(root,"components/crews/mobile-time-approvals.tsx"),"utf8");
assert.match(service,/WORKFORCE_TIME_REVIEW_ROLES/);
assert.match(service,/canReviewWorkforceTime\(workspace\.context\.role\)/);
assert.match(service,/db\.from\("profiles"\)\.select\("id, display_name"\)\.eq\("company_id",workspace\.context\.companyId\)/);
assert.match(surface,/getWorkforceTimeReviewAccess/);
assert.match(surface,/allowed===false/);
assert.match(surface,/authorized supervisors and managers/);
assert.match(surface,/allowed===true&&!rows\.length/);

console.log("Workforce time review access contract checks passed.");
