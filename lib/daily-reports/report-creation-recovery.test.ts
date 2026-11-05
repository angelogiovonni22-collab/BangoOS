import assert from "node:assert/strict";
import { createDailyReportsService } from "./service";
import type { DailyReport, DailyReportUpsertInput } from "./types";

type EventRow = { id: string; company_id: string; reference_id: string; actor_profile_id: string; idempotency_key: string; event_type: string; occurred_at: string; payload: { report: DailyReport } };
type PublishInput = { company_id: string; actor_profile_id: string; aggregate_id: string; idempotency_key: string; event_type: string; payload: { report: DailyReport } };
const rows: EventRow[] = [];
let actor = "user-a", company = "company-a", mode: "ok" | "before" | "lost" = "ok", disconnected = false, writes = 0;
const client = {
  from(table: string) {
    assert.equal(table, "workflow_events");
    let matches = [...rows];
    const query = {
      select() { return query; },
      eq(column: string, value: string) { matches = matches.filter(row => row[column as keyof EventRow] === value || column === "reference_entity"); return query; },
      in(column: string, values: string[]) { matches = matches.filter(row => values.includes(String(row[column as keyof EventRow]))); return query; },
      order() { matches.sort((a,b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id)); return query; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(disconnected ? {data:null,error:{message:"Simulated disconnected read"}} : {data:structuredClone(matches),error:null}).then(resolve); },
    };
    return query;
  },
};
const publisher = {
  async publishEvent(input: PublishInput) {
    if (mode === "before") throw new Error("Simulated failure before write");
    await Promise.resolve();
    const existing = rows.find(row => row.company_id === input.company_id && row.event_type === input.event_type && row.idempotency_key === input.idempotency_key);
    if (existing) return { event: structuredClone(existing), idempotent: true };
    writes++;
    const event:EventRow={id:String(writes).padStart(5,"0"),company_id:input.company_id,reference_id:input.aggregate_id,actor_profile_id:input.actor_profile_id,idempotency_key:input.idempotency_key,event_type:input.event_type,occurred_at:new Date().toISOString(),payload:structuredClone(input.payload)};
    rows.push(event);
    if (mode === "lost") { disconnected = true; throw new Error("Simulated lost response after commit"); }
    return {event:structuredClone(event),idempotent:false};
  },
};
const service = () => createDailyReportsService({
  supabaseClient:client as never,eventPublisher:publisher as never,
  resolveWorkspace:(async()=>({context:{companyId:company,userId:actor},errorMessage:null})) as never,
});
const input:DailyReportUpsertInput={
 header:{projectId:"project-a",projectName:"Synthetic",date:"2026-11-05",shift:"day",superintendentId:"",superintendentName:"Synthetic",projectManagerName:"",weather:"mixed",temperatureF:0,siteConditions:"dry",overallStatus:"draft"},
 schedulingPreload:{assignmentId:"assignment-a",assignmentTitle:"Synthetic",plannedHours:0,scheduledProjectId:"project-a",scheduledProjectName:"Synthetic",assignedCrewNames:[],scheduledEmployees:[],supervisor:""},
 labor:[],workCompleted:[],materials:[],equipment:[],safety:[],delays:[],attachments:[],timeline:[],aiSummaryVersion:1,
};
const firstId="11111111-1111-4111-8111-111111111111";
const raceId="22222222-2222-4222-8222-222222222222";
async function main(){
 let checks=0;const check=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
 mode="lost";
 await assert.rejects(()=>service().createReport(input,"draft",firstId),/lost response/);checks++;
 check(writes===1&&rows.length===1,"server commit survives total response/read interruption");
 disconnected=false;mode="ok";
 const edited={...structuredClone(input),header:{...input.header,weather:"rain" as const}};
 const recovered=await service().createReport(edited,"submitted",firstId);
 check(recovered.id===firstId&&recovered.recoveredCreation===true,"new service instance recovers the durable creation identity");
 check(writes===1&&rows.length===1,"retry does not append a second create event");
 check(recovered.header.weather==="mixed"&&recovered.header.overallStatus==="draft","later edits/status are not falsely acknowledged or written on recovery");
 const before=JSON.stringify(rows);
 actor="user-b";
 await assert.rejects(()=>service().createReport(input,"draft",firstId),/account/);checks++;
 check(JSON.stringify(rows)===before,"another actor cannot recover or overwrite this creation");
 actor="user-a";
 for(const changed of [
  {...input,header:{...input.header,projectId:"project-b"}},
  {...input,header:{...input.header,date:"2026-11-06"}},
  {...input,schedulingPreload:{...input.schedulingPreload!,assignmentId:"assignment-b"}},
 ]) {await assert.rejects(()=>service().createReport(changed,"draft",firstId),/different job or date/);checks++;}
 check(JSON.stringify(rows)===before,"scope mismatches leave the committed snapshot intact");
 await assert.rejects(()=>service().createReport(input,"draft","invalid-reference"),/invalid/);checks++;
 mode="before";
 await assert.rejects(()=>service().createReport(input,"draft",raceId),/before write/);checks++;
 check(writes===1,"failure before commit creates no event");
 mode="ok";
 const concurrent=await Promise.all([service().createReport(input,"draft",raceId),service().createReport(input,"draft",raceId)]);
 check(rows.filter(row=>row.reference_id===raceId).length===1,"concurrent attempts share one unique event");
 check(concurrent.every(report=>report.id===raceId)&&concurrent.some(report=>report.recoveredCreation),"concurrent loser receives the stored report rather than its unsaved candidate");
 const original=rows.find(row=>row.reference_id===firstId)!;
 const approved={...structuredClone(original.payload.report),header:{...original.payload.report.header,overallStatus:"approved" as const},updatedAt:"2099-01-01T00:00:00.000Z"};
 rows.push({...original,id:"latest-review",event_type:"daily_report.updated",occurred_at:"2099-01-01T00:00:00.000Z",payload:{report:approved}});
 const latest=await service().createReport(input,"draft",firstId);
 check(latest.header.overallStatus==="approved"&&latest.updatedAt===approved.updatedAt,"recovery preserves later approval instead of reverting it");
 check(rows.length===3,"recovering an advanced report appends no new event");
 company="company-b";
 const otherCompany=await service().createReport(edited,"draft",firstId);
 check(!otherCompany.recoveredCreation&&otherCompany.header.weather==="rain","another company does not inherit the original report");
 check(rows.filter(row=>row.company_id==="company-a"&&row.event_type==="daily_report.created").length===2,"company-a history remains unchanged");
 console.log("Report creation acknowledgement recovery: "+checks+" assertions passed.");
}
void main();
