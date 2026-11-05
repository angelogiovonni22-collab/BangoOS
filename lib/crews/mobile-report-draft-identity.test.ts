import assert from "node:assert/strict";
import { createMobileFieldOperationsService } from "./mobile-field-operations-service";
import { createEmptyMobileDailyReportDraft, type MobileDailyReportDraft } from "./mobile-field-operations-types";
import type { DailyReport, DailyReportUpsertInput } from "@/lib/daily-reports";

const base: DailyReportUpsertInput = {
 header:{projectId:"project-a",projectName:"Synthetic project",date:"2026-11-05",shift:"day",superintendentId:"",superintendentName:"Synthetic supervisor",projectManagerName:"",weather:"mixed",temperatureF:0,siteConditions:"dry",overallStatus:"draft"},
 schedulingPreload:{assignmentId:"assignment-a",assignmentTitle:"Synthetic job",plannedHours:1,scheduledProjectId:"project-a",scheduledProjectName:"Synthetic project",assignedCrewNames:["Synthetic crew"],scheduledEmployees:[],supervisor:""},
 labor:[],workCompleted:[],materials:[],equipment:[],safety:[],delays:[],attachments:[],timeline:[],aiSummaryVersion:1,
};
let saved:DailyReport|null=null,creates=0,updates=0,revision=0,updateExpected:unknown;
const reports = {
 async createDraftFromSchedule(){return structuredClone(base);},
 async createReport(input:DailyReportUpsertInput,status:string){creates++;saved={...structuredClone(input),id:"saved-report",reportNumber:"SYNTHETIC-1",header:{...input.header,overallStatus:status},updatedAt:String(++revision),createdAt:"0",submittedAt:null,reviewedAt:null,approvedAt:null} as DailyReport;return saved;},
 async getReport(id:string){return saved?.id===id?structuredClone(saved):null;},
 toUpsertInput(report:DailyReport){return structuredClone(report) as DailyReportUpsertInput;},
 async updateReport(id:string,input:DailyReportUpsertInput,status:string,expected:unknown){assert.equal(id,saved?.id);updateExpected=expected;updates++;saved={...saved!,...structuredClone(input),id,header:{...input.header,overallStatus:status},updatedAt:String(++revision)} as DailyReport;return saved;},
};
const service = () => createMobileFieldOperationsService({dailyReportsService:reports as never,workforceService:{} as never,supabaseClient:null,offlineQueue:{async enqueue(item){return {...item,id:"queue",status:"queued",createdAt:"0"};},async list(){return [];},async setStatus(){}}});
let draft: MobileDailyReportDraft={...createEmptyMobileDailyReportDraft(),assignmentId:"assignment-a",notes:"Synthetic first save",photos:["test.png"],photoIds:["photo-a"]};
let checks=0;
function check(value:unknown,label:string){assert.ok(value,label);checks++;}
async function main(){
 const input={crewId:"crew-a",reportDate:"2026-11-05",status:"draft" as const,draft};
 const first=await service().submitMobileDailyReport(input);
 check(creates===1&&updates===0,"first save creates one report");
 check(first.reportId==="saved-report"&&first.reportUpdatedAt==="1","server acknowledgement returns stable identity and version");
 draft={...draft,reportId:first.reportId,reportUpdatedAt:first.reportUpdatedAt,notes:"Synthetic second save"};
 await service().submitMobileDailyReport({...input,draft});
 check(creates===1&&updates===1,"another service instance updates the same saved report instead of creating a duplicate");
 check((saved?.timeline[0]?.description)==="Synthetic second save","new field edits reach the existing report");
 check(saved?.attachments[0]?.projectPhotoId==="photo-a","photo identity survives repeated saves");
 assert.deepEqual(updateExpected,{status:"draft",updatedAt:"1"});checks++;
 const secondVersion=saved!.updatedAt;
 const reopened=JSON.parse(JSON.stringify({...draft,reportUpdatedAt:secondVersion}));
 const submitted=await service().submitMobileDailyReport({...input,status:"submitted",draft:reopened});
 check(creates===1&&updates===2&&submitted.reportId===first.reportId,"reopened draft submits the same report");
 check(saved?.header.overallStatus==="submitted","submission advances that report's state");
 await assert.rejects(()=>service().submitMobileDailyReport({...input,draft:reopened}),/already left Draft/);checks++;
 check(creates===1&&updates===2,"stale post-submit save neither duplicates nor reverts the report");
 for(const status of ["reviewed","approved"] as const){saved!.header.overallStatus=status;await assert.rejects(()=>service().submitMobileDailyReport({...input,draft:reopened}),/already left Draft/);checks++;}
 saved!.header.overallStatus="draft";
 await assert.rejects(()=>service().submitMobileDailyReport({...input,draft:{...reopened,reportUpdatedAt:"stale"}}),/changed elsewhere/);checks++;
 await assert.rejects(()=>service().submitMobileDailyReport({...input,draft:{...reopened,reportUpdatedAt:undefined}}),/changed elsewhere/);checks++;
 await assert.rejects(()=>service().submitMobileDailyReport({...input,draft:{...reopened,reportId:"missing"}}),/unavailable/);checks++;
 saved!.header.projectId="other-project";
 await assert.rejects(()=>service().submitMobileDailyReport({...input,draft:{...reopened,reportUpdatedAt:saved!.updatedAt}}),/different scheduled job/);checks++;
 saved!.header.projectId="project-a";saved!.header.date="2026-11-04";
 await assert.rejects(()=>service().submitMobileDailyReport({...input,draft:{...reopened,reportUpdatedAt:saved!.updatedAt}}),/different scheduled job/);checks++;
 saved!.header.date="2026-11-05";saved!.schedulingPreload!.assignmentId="other-assignment";
 await assert.rejects(()=>service().submitMobileDailyReport({...input,draft:{...reopened,reportUpdatedAt:saved!.updatedAt}}),/different scheduled job/);checks++;
 check(creates===1&&updates===2,"all rejected saves preserve report count and contents");
 console.log("Mobile saved-draft lifecycle: "+checks+" assertions passed.");
}
void main();
