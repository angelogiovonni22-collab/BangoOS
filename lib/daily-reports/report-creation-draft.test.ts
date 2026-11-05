import assert from "node:assert/strict";
import {createReportCreationDraftStore,type ReportCreationDraft,type ReportCreationDraftStorage} from "./report-creation-draft";
import type {DailyReportUpsertInput} from "./types";
async function main(){
 let checks=0;const check=(x:unknown,label:string)=>{assert.ok(x,label);checks++;};
 const rows=new Map<string,ReportCreationDraft>();let fail=false,tail=Promise.resolve();
 const storage:ReportCreationDraftStorage={
  async read(key){return rows.has(key)?structuredClone(rows.get(key)!):null;},
  change(key,update){const result=tail.then(()=>{if(fail)throw new Error("Simulated quota failure");const next=update(rows.has(key)?structuredClone(rows.get(key)!):null);if(next)rows.set(key,structuredClone(next));else rows.delete(key);});tail=result.catch(()=>undefined);return result;},
 };
 let companyId="company-a",userId="user-a";
 const store=()=>createReportCreationDraftStore(async()=>({companyId,userId}),storage);
 const draft={header:{projectId:"project-a",date:"2026-11-05"},labor:[],workCompleted:[{activity:"Synthetic recovery note"}]} as unknown as DailyReportUpsertInput;
 const first={creationId:"attempt-a",draft};
 check(await store().load()===null,"empty scope starts clean");
 await store().save(first);
 check((await store().load())?.creationId==="attempt-a","new instance restores the same first-save identity");
 check((await store().load())?.draft.workCompleted[0].activity==="Synthetic recovery note","full report fields survive reopen");
 const edited={...first,draft:{...draft,workCompleted:[{...draft.workCompleted[0],activity:"unsent later edit"}]}};
 await store().save(edited);
 check((await store().load())?.draft.workCompleted[0].activity==="unsent later edit","same attempt preserves later unsent fields");
 await assert.rejects(()=>store().save({...first,creationId:"attempt-b"}),/unfinished report/);checks++;
 check((await store().load())?.creationId==="attempt-a","a second tab cannot replace another unfinished attempt");
 await store().remove("attempt-b");
 check((await store().load())?.creationId==="attempt-a","cleanup for another identity cannot erase this draft");
 userId="user-b";check(await store().load()===null,"another account cannot load pending report");
 userId="user-a";companyId="company-b";check(await store().load()===null,"another company cannot load pending report");
 companyId="company-a";
 fail=true;await assert.rejects(()=>store().save(first),/quota/);checks++;
 fail=false;check((await store().load())?.draft.workCompleted[0].activity==="unsent later edit","failed save preserves previous recovery copy");
 await store().remove("attempt-a");check(await store().load()===null,"explicit matching cleanup clears only this device draft");
 const concurrent=await Promise.allSettled([store().save(first),store().save({...first,creationId:"attempt-b"})]);
 check(concurrent.filter(x=>x.status==="fulfilled").length===1,"atomic store admits one concurrent first-save identity");
 check((await store().load())?.creationId==="attempt-a","concurrent loser leaves winning draft intact");
 await store().remove("attempt-a");await store().save({...first,creationId:"attempt-b"});
 check((await store().load())?.creationId==="attempt-b","a separate report can start after explicit cleanup");
 console.log("Full editor creation draft: "+checks+" assertions passed.");
}
void main();
