import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult> };
export type WorkforceTimeReview={id:string;employeeId:string;employeeName:string;projectId:string|null;startedAt:string;endedAt:string;breakMinutes:number;hours:number;notes:string|null};
export type WorkforceTimeCompliance={regularHours:number;overtimeHours:number;missingBreak:boolean;requiresAttention:boolean};
export function getWorkforceTimeCompliance(entry:Pick<WorkforceTimeReview,"hours"|"breakMinutes">):WorkforceTimeCompliance{const overtimeHours=Math.max(0,entry.hours-8),missingBreak=entry.hours>=6&&entry.breakMinutes===0;return{regularHours:Math.min(8,entry.hours),overtimeHours,missingBreak,requiresAttention:overtimeHours>0||missingBreak};}
type QueryResult={data:Array<Record<string,unknown>>|null;error:{message?:string}|null};
type QueryBuilder=PromiseLike<QueryResult>&{select:(columns:string)=>QueryBuilder;update:(values:Record<string,unknown>)=>QueryBuilder;eq:(column:string,value:unknown)=>QueryBuilder;in:(column:string,values:string[])=>QueryBuilder;order:(column:string,options:{ascending:boolean})=>QueryBuilder;limit:(count:number)=>QueryBuilder;maybeSingle:()=>Promise<{data:unknown;error:{message?:string}|null}>};
type LooseDb={from:(table:string)=>QueryBuilder};

export async function recordWorkforceTimeEvent(input:{employeeId:string;action:"clock_in"|"clock_out";projectId?:string|null;assignmentId?:string|null;notes?:string;location?:{latitude:number;longitude:number;accuracy:number}|null;breakMinutes?:number}) {
  const supabase=createClient();
  const workspace=await resolveWorkspaceContext(supabase);
  if(!supabase||!workspace.context) throw new Error(workspace.errorMessage||"Time tracking is unavailable.");
  const {data,error}=await (supabase as unknown as RpcClient).rpc("record_workforce_time_event",{p_company_id:workspace.context.companyId,p_employee_id:input.employeeId,p_action:input.action,p_project_id:input.projectId||null,p_assignment_id:input.assignmentId||null,p_notes:input.notes||null,p_location:input.location||null,p_break_minutes:Math.max(0,Math.floor(input.breakMinutes||0))});
  if(error) throw new Error(error.message||"Unable to record time.");
  return data;
}

export async function listSubmittedWorkforceTime():Promise<WorkforceTimeReview[]>{
  const supabase=createClient(),workspace=await resolveWorkspaceContext(supabase);if(!supabase||!workspace.context)throw new Error(workspace.errorMessage||"Time approvals are unavailable.");const db=supabase as unknown as LooseDb;
  const entries:QueryResult=await db.from("workforce_time_entries").select("id, employee_id, project_id, started_at, ended_at, break_minutes, notes").eq("company_id",workspace.context.companyId).eq("status","submitted").order("ended_at",{ascending:false}).limit(50);if(entries.error)throw new Error(entries.error.message||"Unable to load submitted time.");
  const ids=[...new Set((entries.data||[]).map(row=>String(row.employee_id)))];let names=new Map<string,string>();if(ids.length){const employees:QueryResult=await db.from("employees").select("id, employee_number, position_title").eq("company_id",workspace.context.companyId).in("id",ids);if(!employees.error)names=new Map((employees.data||[]).map(row=>[String(row.id),String(row.employee_number||row.position_title||"Employee")]));}
  return(entries.data||[]).map(row=>{const started=String(row.started_at),ended=String(row.ended_at),breakMinutes=Number(row.break_minutes||0);return{id:String(row.id),employeeId:String(row.employee_id),employeeName:names.get(String(row.employee_id))||"Employee",projectId:row.project_id?String(row.project_id):null,startedAt:started,endedAt:ended,breakMinutes,hours:Math.max(0,(new Date(ended).getTime()-new Date(started).getTime())/3600000-breakMinutes/60),notes:row.notes?String(row.notes):null};});
}

export async function reviewWorkforceTime(entryId:string,decision:"approved"|"rejected"){
  const supabase=createClient(),workspace=await resolveWorkspaceContext(supabase);if(!supabase||!workspace.context)throw new Error(workspace.errorMessage||"Time approvals are unavailable.");const values=decision==="approved"?{status:decision,approved_by:workspace.context.userId,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}:{status:decision,approved_by:null,approved_at:null,updated_at:new Date().toISOString()};const result=await (supabase as unknown as LooseDb).from("workforce_time_entries").update(values).eq("company_id",workspace.context.companyId).eq("id",entryId).eq("status","submitted").select("id").maybeSingle();if(result.error)throw new Error(result.error.message||"Unable to review time entry.");return result.data;
}
