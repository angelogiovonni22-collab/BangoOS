import assert from "node:assert/strict";
import { loadReportPhotoEvidence, type ReportPhotoClient } from "./report-photo-evidence";
import type { AttachmentItem } from "./types";
let checks = 0;
function check(value: unknown, label: string) { assert.ok(value, label); checks++; }
const attachment = (projectPhotoId?: string): AttachmentItem => ({ id:"attachment",fileName:"synthetic.png",caption:"Synthetic",category:"progress",uploadedAt:"2026-11-05T14:00:00Z",...(projectPhotoId ? {projectPhotoId}: {}) });
const row = { id:"photo-a",company_id:"company-a",project_id:"project-a",storage_path:"company-a/project-a/photo-a/synthetic.png",original_filename:"synthetic.png",mime_type:"image/png" };
function harness(rows: Array<Record<string,unknown>>, failRead = false, failSign = false) {
 const reads: Array<Record<string,unknown>> = [], signed:string[] = [];
 const client = { from(table:string) {
   assert.equal(table,"project_photos"); const filters:Record<string,unknown> = {};
   const query = { select(){return query;},eq(k:string,v:string){filters[k]=v;return query;},in(k:string,v:string[]){filters.column=k;filters.values=v;return query;},
    then(resolve:(value:unknown)=>unknown) {reads.push({...filters});return Promise.resolve({data:rows.filter(item=>(filters.values as string[]).includes(String(item[String(filters.column)]))),error:failRead?{message:"Synthetic read failure"}:null}).then(resolve);}
   }; return query;
 },storage:{from(bucket:string){assert.equal(bucket,"project-photos");return {async createSignedUrl(path:string,seconds:number){assert.equal(seconds,300);signed.push(path);return {data:failSign?null:{signedUrl:"https://example.invalid/synthetic-signed-photo"},error:failSign?{message:"Synthetic signing failure"}:null};}};}} };
 return {client:client as unknown as ReportPhotoClient,reads,signed};
}
async function main(){
 let h=harness([row]); let result=await loadReportPhotoEvidence(h.client,"company-a","project-a",[attachment("photo-a")]);
 check(Boolean(result[0].url)&&result[0].isImage,"explicit photo identity opens an image");
 check(h.reads.every(read=>read.company_id==="company-a"&&read.project_id==="project-a"),"every photo read is company/project scoped");
 check(h.reads[0].column==="id","explicit references query by ID");
 check(h.signed.length===1&&h.signed[0]===row.storage_path,"only the verified row storage path is signed");
 h=harness([row]);result=await loadReportPhotoEvidence(h.client,"company-a","project-a",[attachment()]);
 check(Boolean(result[0].url),"legacy filename resolves when unique in the current project");
 check(h.reads[0].column==="original_filename","legacy snapshots use a scoped filename lookup");
 h=harness([row,{...row,id:"photo-b",storage_path:"company-a/project-a/photo-b/synthetic.png"}]);
 result=await loadReportPhotoEvidence(h.client,"company-a","project-a",[attachment()]);
 check(result[0].url===null&&/More than one/.test(result[0].message||""),"ambiguous legacy filenames never select a guessed image");
 check(h.signed.length===0,"ambiguous filenames never generate a signed URL");
 h=harness([row]);result=await loadReportPhotoEvidence(h.client,"company-a","project-a",[attachment("deleted-photo")]);
 check(result[0].url===null&&h.signed.length===0,"missing explicit identity never falls back to another file with the same name");
 for(const patch of [{company_id:"other-company"},{project_id:"other-project"},{storage_path:"other-company/project-a/photo-a/image.png"},{storage_path:"company-a/project-a/../private.png"},{storage_path:"company-a/project-a/%2e%2e/private.png"},{storage_path:"company-a/project-a/%2fprivate.png"}]){
  h=harness([{...row,...patch}]);result=await loadReportPhotoEvidence(h.client,"company-a","project-a",[attachment("photo-a")]);
  check(result[0].url===null&&h.signed.length===0,"foreign or unsafe path cannot be signed: "+JSON.stringify(patch));
 }
 h=harness([row],true);await assert.rejects(()=>loadReportPhotoEvidence(h.client,"company-a","project-a",[attachment("photo-a")]),/Unable to load/);checks++;
 h=harness([row],false,true);result=await loadReportPhotoEvidence(h.client,"company-a","project-a",[attachment("photo-a")]);
 check(result[0].url===null&&Boolean(result[0].message),"signing failures show unavailable evidence");
 h=harness([]);check((await loadReportPhotoEvidence(h.client,"company-a","project-a",[])).length===0&&h.reads.length===0,"empty reports do not issue photo reads");
 await assert.rejects(()=>loadReportPhotoEvidence(h.client,"","project-a",[attachment()]),/verified workspace/);checks++;
 console.log("Report photo scope and resolution: "+checks+" assertions passed.");
}
void main();
