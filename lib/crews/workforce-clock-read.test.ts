import assert from "node:assert/strict";
import { getWorkforceClockEntry } from "./workforce-time";
const reads: Array<Record<string,string>> = [];
let rows: Array<Record<string,unknown>> = [], failure = false;
const client = { from(table:string) {
  assert.equal(table,"workforce_time_entries");
  const filters:Record<string,string>={};
  const chain={
    select(){return chain;},eq(k:string,v:string){filters[k]=v;return chain;},
    order(){return chain;},limit(){return chain;},
    async maybeSingle(){
      reads.push({...filters});
      const matching=rows.filter(row=>Object.entries(filters).every(([k,v])=>row[k]===v));
      return {data:matching[0]||null,error:failure?{message:"Synthetic read failure"}:null};
    },
  };return chain;
}};
const deps={supabaseClient:client as never,resolveWorkspace:async()=>({context:{companyId:"company-a"},errorMessage:null}) as never};
const base={id:"closed",company_id:"company-a",employee_id:"employee-a",status:"submitted",started_at:"2026-11-04T12:00:00Z",ended_at:"2026-11-04T13:00:00Z",break_minutes:5};
async function main(){
  rows=[{...base,company_id:"other-company",id:"foreign"},{...base,employee_id:"other-employee",id:"other"}];
  assert.equal(await getWorkforceClockEntry("employee-a",deps),null);
  assert.ok(reads.every(read=>read.company_id==="company-a"&&read.employee_id==="employee-a"),"every query scopes company and selected employee");
  rows=[base,{...base,id:"open",status:"open",ended_at:null}];
  assert.equal((await getWorkforceClockEntry("employee-a",deps))?.id,"open","open shift wins over closed history");
  rows=[base];
  const closed=await getWorkforceClockEntry("employee-a",deps);
  assert.equal(closed?.id,"closed");
  assert.equal(closed?.breakMinutes,5);
  failure=true;
  await assert.rejects(getWorkforceClockEntry("employee-a",deps),/Synthetic read failure/);
  failure=false;rows=[{...base,started_at:"bad"}];
  await assert.rejects(getWorkforceClockEntry("employee-a",deps),/verify the saved/);
  console.log("Workforce clock scoped persistence reads: 7 assertions passed.");
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
