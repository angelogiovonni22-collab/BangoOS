import assert from "node:assert/strict";
import fs from "node:fs";
import { activeFieldCrews, effectiveFieldCrewId, mobileReportDate } from "./mobile-field-context";
import { payrollBuildError, payrollBuildIssue } from "../payroll/payroll-build";
const crews = [
 { crewId:"archived",lifecycleStatus:"archived" },
 { crewId:"inactive",lifecycleStatus:"inactive" },
 { crewId:"a",lifecycleStatus:"active" },
 { crewId:"b",lifecycleStatus:"active" },
 { crewId:"unknown" },
];
const active = activeFieldCrews(crews);
assert.deepEqual(active.map(c=>c.crewId),["a","b"]);
assert.equal(effectiveFieldCrewId(active,"archived"),"a");
assert.equal(effectiveFieldCrewId(active,"b"),"b");
assert.equal(effectiveFieldCrewId([],"archived"),"");
assert.equal(mobileReportDate("America/New_York","",new Date("2026-11-04T01:00:00Z")),"2026-11-03");
assert.equal(mobileReportDate("Pacific/Auckland","",new Date("2026-11-03T12:00:00Z")),"2026-11-04");
assert.equal(mobileReportDate(null,"",new Date("2026-11-04T01:00:00Z")),"");
assert.equal(mobileReportDate("America/New_York","2026-10-01"),"2026-10-01");
const base={periods:[],start:"2026-11-02",end:"2026-11-08",approvedHours:2,missingRates:0};
assert.equal(payrollBuildIssue(base),null);
for (const status of ["draft","review","approved","exported"]) {
 assert.match(payrollBuildIssue({...base,periods:[{period_start:base.start,period_end:base.end,status}]})||"",/already exists/);
}
assert.equal(payrollBuildIssue({...base,periods:[{period_start:base.start,period_end:base.end,status:"void"}]}),null);
assert.match(payrollBuildIssue({...base,approvedHours:0})||"",/No approved/);
assert.match(payrollBuildIssue({...base,missingRates:1})||"",/rates/);
assert.match(payrollBuildError({message:'duplicate key value violates unique constraint "payroll_periods_active_company_dates"'}),/already exists/);
assert.ok(!payrollBuildError({message:"private database detail"}).includes("private"));
const ui=fs.readFileSync("components/crews/mobile-field-operations-workspace.tsx","utf8");
assert.ok(ui.includes("loadScheduleTimeZone(client, workspace.context.companyId)"));
assert.ok(ui.includes("value={effectiveCrewId}"));
assert.ok(ui.includes("fieldCrews.map"));
assert.ok(!ui.includes("todayIso()"));
assert.ok(fs.readFileSync("lib/crews/workforce-operations-service.ts","utf8").includes("lifecycleStatus: crew.status"));
const pay=fs.readFileSync("app/(app)/invoices/payroll/page.tsx","utf8");
assert.ok(pay.includes("setError(payrollBuildError(result.error))"));
assert.ok(pay.includes("disabled={busy||Boolean(buildIssue)}"));
console.log("Field crew lifecycle, company report calendar, edited-date preservation, and duplicate payroll guards passed.");
