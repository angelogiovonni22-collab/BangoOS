import { assignmentAssignee } from "./assignment-assignee";
import assert from "node:assert/strict";
import { activeAssignmentsOnDate, openStaffingCount } from "./workforce-summary";
import { scheduleClock } from "./time-zone";
import type { ScheduleAssignment, OpenShift } from "./types";

const assignment = (id: string, status: ScheduleAssignment["status"], date = "2026-10-20") => ({
  id, status, date, requiredHeadcount: 1, assignedEmployeeIds: [], plannedLaborHours: 2,
} as ScheduleAssignment);
const shift = (assignmentId: string, dismissed = false) => ({ id: `open-${assignmentId}`, assignmentId, dismissed } as OpenShift);
const active = assignment("active", "published");
const cancelled = assignment("cancelled", "cancelled");
const completed = assignment("completed", "completed");
const payload = { timeZone: "America/New_York", assignments: [active,cancelled,completed], openShifts: [shift("active"),shift("cancelled"),shift("completed")] };
const before = structuredClone(payload);
assert.equal(openStaffingCount(payload),1,"a derived open shift and its unstaffed assignment count once");
assert.equal(openStaffingCount({...payload,openShifts:[...payload.openShifts,shift("standalone")]}),2,"standalone demand remains");
assert.equal(openStaffingCount({...payload,openShifts:[shift("active",true)]}),0,"dismissed gaps stay dismissed");
assert.equal(openStaffingCount({assignments:[{...active,assignedEmployeeIds:["employee"]}],openShifts:[]}),0);
assert.equal(openStaffingCount({assignments:[active],openShifts:[]}),1);
assert.deepEqual(activeAssignmentsOnDate(payload,"2026-10-21T02:00:00Z"),[active],"today follows company date across UTC midnight");
assert.deepEqual(activeAssignmentsOnDate(payload,new Date("2026-10-21T05:00:00Z")),[],"tomorrow is a different company date");
assert.deepEqual(scheduleClock("2026-10-20T13:00:00Z",payload.timeZone),{date:"2026-10-20",time:"09:00"});
assert.equal(activeAssignmentsOnDate(payload,"2026-10-21T02:00:00Z").reduce((sum,row)=>sum+row.plannedLaborHours,0),2,"planned duration uses recorded hours, not an eight-hour assumption");
assert.deepEqual(payload,before,"history data is not mutated");
console.log("Workforce summary deduplication, lifecycle, company-date boundary, planned duration and history regressions passed.");

assert.deepEqual(assignmentAssignee({assignedCrewIds:["crew"],assignedEmployeeIds:["member1","member2"]}),{crewId:"crew",employeeId:null,useEmployee:false},"editing a staffed crew retains the booked crew");
assert.deepEqual(assignmentAssignee({assignedCrewIds:[],assignedEmployeeIds:["employee"]}),{crewId:null,employeeId:"employee",useEmployee:true});
assert.deepEqual(assignmentAssignee({assignedCrewIds:[],assignedEmployeeIds:[]}),{crewId:null,employeeId:null,useEmployee:false});
