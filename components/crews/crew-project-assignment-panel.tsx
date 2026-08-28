"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, FormField, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { compensationMethodLabel, type CompensationMethod } from "@/lib/projects/project-commitments";
import { useScheduling, type AssignmentDraft } from "@/lib/scheduling";

type CrewProjectAssignmentPanelProps = { crewId: string; crewName: string; activeMemberCount: number; supervisorName: string | null };
type CrewPayRow = { employeeId:string; name:string; hourlyRate:number|null; fringeHourly:number|null };
type RpcResult<T>={data:T|null;error:{message?:string}|null};

function todayIso() { return new Date().toISOString().slice(0, 10); }
function shiftHours(start:string,end:string,shift:AssignmentDraft["shift"]){const [sh,sm]=start.split(":").map(Number);const [eh,em]=end.split(":").map(Number);let minutes=(eh*60+em)-(sh*60+sm);if(minutes<=0&&shift==="night")minutes+=1440;return Math.max(0,minutes/60);}
const money=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);

export function CrewProjectAssignmentPanel({ crewId, crewName, activeMemberCount, supervisorName }: CrewProjectAssignmentPanelProps) {
  const { payload, isLoading, errorMessage, createNewAssignment } = useScheduling();
  const supabase=useMemo(()=>createClient(),[]);
  const [open,setOpen]=useState(false); const [projectId,setProjectId]=useState(""); const [date,setDate]=useState(todayIso());
  const [shift,setShift]=useState<AssignmentDraft["shift"]>("day"); const [startTime,setStartTime]=useState("07:00"); const [endTime,setEndTime]=useState("15:30"); const [notes,setNotes]=useState("");
  const [method,setMethod]=useState<CompensationMethod>("payroll_rate"); const [rate,setRate]=useState(""); const [plannedDays,setPlannedDays]=useState("1"); const [plannedUnits,setPlannedUnits]=useState(""); const [lumpSum,setLumpSum]=useState("");
  const [crewPay,setCrewPay]=useState<CrewPayRow[]>([]); const [projectBudgets,setProjectBudgets]=useState<Record<string,number>>({});
  const [saving,setSaving]=useState(false); const [loadingPay,setLoadingPay]=useState(false); const [localError,setLocalError]=useState<string|null>(null); const [success,setSuccess]=useState<string|null>(null);
  const projectOptions=payload?.projectOptions??[]; const selectedProject=useMemo(()=>projectOptions.find((p)=>p.id===projectId)??null,[projectId,projectOptions]);
  const hours=shiftHours(startTime,endTime,shift);
  const payrollHourly=crewPay.reduce((sum,row)=>sum+Number(row.hourlyRate||0)+Number(row.fringeHourly||0),0);
  const projectedCost=method==="payroll_rate"?payrollHourly*hours:method==="lump_sum"?Number(lumpSum||0):method==="day_rate"?Number(rate||0)*Number(plannedDays||0):method==="piece_rate"?Number(rate||0)*Number(plannedUnits||0):Number(rate||0)*hours;
  const selectedBudget=projectBudgets[projectId]; const remaining=Number.isFinite(selectedBudget)?selectedBudget-projectedCost:null;

  async function loadFinancialSetup(){
    if(!supabase)return; setLoadingPay(true);
    const workspace=await resolveWorkspaceContext(supabase); if(!workspace.context){setLocalError(workspace.errorMessage||"Unable to load pay setup.");setLoadingPay(false);return;}
    const db=supabase as unknown as { // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from:(table:string)=>any;
    }; const companyId=workspace.context.companyId;
    const memberships=await db.from("crew_memberships").select("employee_id").eq("company_id",companyId).eq("crew_id",crewId).eq("status","active");
    const ids=[...new Set((memberships.data||[]).map((row:{employee_id:string})=>row.employee_id))] as string[];
    if(ids.length){
      const [employeesResult,payResult]=await Promise.all([
        db.from("employees").select("id,employee_number,profile_id").eq("company_id",companyId).in("id",ids),
        db.from("payroll_employee_settings").select("employee_id,hourly_rate,fringe_hourly,status").eq("company_id",companyId).in("employee_id",ids).eq("status","active"),
      ]);
      const employees=(employeesResult.data||[]) as Array<{id:string;employee_number:string;profile_id:string|null}>; const profileIds=employees.map((e)=>e.profile_id).filter(Boolean) as string[];
      const profileResult=profileIds.length?await db.from("profiles").select("id,first_name,last_name").eq("company_id",companyId).in("id",profileIds):{data:[]};
      const profiles=new Map(((profileResult.data||[]) as Array<{id:string;first_name:string|null;last_name:string|null}>).map((p)=>[p.id,p])); const pays=new Map(((payResult.data||[]) as Array<{employee_id:string;hourly_rate:number|null;fringe_hourly:number|null}>).map((p)=>[p.employee_id,p]));
      setCrewPay(employees.map((e)=>{const p=e.profile_id?profiles.get(e.profile_id):null;const pay=pays.get(e.id);return{employeeId:e.id,name:[p?.first_name,p?.last_name].filter(Boolean).join(" ")||e.employee_number,hourlyRate:pay?.hourly_rate??null,fringeHourly:pay?.fringe_hourly??null};}));
    } else setCrewPay([]);
    if(projectOptions.length){const result=await db.from("projects").select("id,contract_amount,estimated_cost").eq("company_id",companyId).in("id",projectOptions.map((p)=>p.id));const budgets:Record<string,number>={};for(const row of result.data||[])budgets[String(row.id)]=Number(row.contract_amount??row.estimated_cost??0);setProjectBudgets(budgets);}
    setLoadingPay(false);
  }

  const handleOpen=()=>{setOpen(true);setLocalError(null);setSuccess(null);if(!projectId&&projectOptions[0]?.id)setProjectId(projectOptions[0].id);void loadFinancialSetup();};

  async function saveCompensation(companyId:string){
    if(!supabase)throw new Error("B.O.S. database is unavailable.");
    const call=async(args:Record<string,unknown>)=>{const result=await supabase.rpc("save_project_labor_commitment" as never,args as never) as unknown as RpcResult<string>;if(result.error)throw new Error(result.error.message||"Unable to save project compensation.");};
    if(method==="payroll_rate"){
      const missing=crewPay.filter((row)=>row.hourlyRate==null); if(missing.length)throw new Error(`Set payroll rates for ${missing.map((r)=>r.name).join(", ")} before using Payroll rates.`);
      if(!crewPay.length)throw new Error("This crew has no active members with payroll setup.");
      for(const row of crewPay){await call({p_company_id:companyId,p_project_id:projectId,p_employee_id:row.employeeId,p_crew_id:null,p_compensation_method:"payroll_rate",p_rate:Number(row.hourlyRate||0)+Number(row.fringeHourly||0),p_projected_hours:hours,p_projected_days:0,p_projected_units:0,p_lump_sum_amount:0,p_rate_details:{crewId,crewName,baseHourly:Number(row.hourlyRate||0),fringeHourly:Number(row.fringeHourly||0),employeeName:row.name},p_notes:notes});}
      return;
    }
    await call({p_company_id:companyId,p_project_id:projectId,p_employee_id:null,p_crew_id:crewId,p_compensation_method:method,p_rate:Number(rate||0),p_projected_hours:["hourly","prevailing_wage"].includes(method)?hours:0,p_projected_days:method==="day_rate"?Number(plannedDays||0):0,p_projected_units:method==="piece_rate"?Number(plannedUnits||0):0,p_lump_sum_amount:method==="lump_sum"?Number(lumpSum||0):0,p_rate_details:{crewId,crewName},p_notes:notes});
  }

  const handleSubmit=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setLocalError(null);setSuccess(null);
    if(!projectId){setLocalError("Select a project before assigning this crew.");return;} if(!date){setLocalError("Select an assignment date.");return;} if(hours<=0){setLocalError("Enter a valid assignment start and end time.");return;}
    if(method==="payroll_rate"&&crewPay.some((row)=>row.hourlyRate==null)){setLocalError("Every active crew member needs an employee pay rate before this assignment can use Payroll rates.");return;}
    if(["hourly","day_rate","piece_rate","prevailing_wage"].includes(method)&&(!Number.isFinite(Number(rate))||Number(rate)<0)){setLocalError("Enter a valid compensation rate.");return;} if(method==="piece_rate"&&Number(plannedUnits)<=0){setLocalError("Enter the planned quantity for piece/unit rate work.");return;} if(method==="lump_sum"&&Number(lumpSum)<=0){setLocalError("Enter the lump-sum amount.");return;}
    const projectName=selectedProject?.name||"Project"; const trade=payload?.tradeOptions[0]||"General Labor";
    const draft:AssignmentDraft={title:`${crewName} - ${projectName}`,type:"project_work",projectId,location:"",date,startTime,endTime,shift,assignedCrewIds:[crewId],assignedEmployeeIds:[],requiredTrade:trade,requiredHeadcount:Math.max(1,activeMemberCount),supervisor:supervisorName||"",priority:"medium",status:"published",notes,travelTimeMinutes:30,recurrence:{enabled:false,frequency:"weekly",interval:1,endDate:null},equipment:{requiredEquipment:[],assignedEquipment:[],operatorRequired:false},safetyRequirement:"",certificationRequirement:""};
    setSaving(true);
    try{
      const workspace=await resolveWorkspaceContext(supabase);if(!workspace.context)throw new Error(workspace.errorMessage||"Unable to resolve workspace.");
      const saved=await createNewAssignment(draft);if(!saved){setLocalError("B.O.S. could not assign this crew. Check for a scheduling conflict and try again.");return;}
      await saveCompensation(workspace.context.companyId);
      setSuccess(`${crewName} is assigned to ${projectName}. Projected labor commitment: ${money(projectedCost)}.`);setOpen(false);
    }catch(caught){setLocalError(caught instanceof Error?caught.message:"Unable to save crew compensation.");}finally{setSaving(false);}
  };

  return <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-small)]">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Project Assignment</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Assign this crew and commit how the project will pay for the work before it hits the schedule.</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={handleOpen} disabled={isLoading||projectOptions.length===0}>Assign to Project</Button><Link href={`/schedule?crew=${encodeURIComponent(crewId)}`} className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-brand-700)] transition hover:bg-[var(--color-surface-subtle)]">View Schedule</Link></div></div>
    {projectOptions.length===0&&!isLoading?<p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-2 text-sm text-[var(--color-warning-800)]">No projects are available to assign.</p>:null}
    {errorMessage?<p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2 text-sm text-[var(--color-danger-700)]">Scheduling data could not be loaded.</p>:null}
    {success?<p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-3 py-2 text-sm font-medium text-[var(--color-success-800)]">{success}</p>:null}
    {open?<form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-[var(--color-border-subtle)] pt-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><FormField label="Project"><Select value={projectId} onChange={(e)=>setProjectId(e.target.value)} required><option value="">Select project</option>{projectOptions.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</Select></FormField><FormField label="Assignment date"><Input type="date" value={date} onChange={(e)=>setDate(e.target.value)} required/></FormField><FormField label="Shift"><Select value={shift} onChange={(e)=>setShift(e.target.value as AssignmentDraft["shift"])}><option value="day">Day</option><option value="swing">Swing</option><option value="night">Night</option></Select></FormField><FormField label="Start time"><Input type="time" value={startTime} onChange={(e)=>setStartTime(e.target.value)} required/></FormField><FormField label="End time"><Input type="time" value={endTime} onChange={(e)=>setEndTime(e.target.value)} required/></FormField><FormField label="Crew"><Input value={crewName} readOnly/></FormField></div>
      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4"><h3 className="font-bold text-[var(--color-text-primary)]">Project compensation</h3><p className="mt-1 text-xs text-[var(--color-text-secondary)]">This creates the project's labor commitment. It does not change the employee payroll rate.</p><div className="mt-3 grid gap-3 md:grid-cols-3"><FormField label="How are we paying?"><Select value={method} onChange={(e)=>setMethod(e.target.value as CompensationMethod)}><option value="payroll_rate">Payroll rates</option><option value="hourly">Hourly crew rate</option><option value="day_rate">Day rate</option><option value="piece_rate">Piece / unit rate</option><option value="lump_sum">Lump sum</option><option value="prevailing_wage">Prevailing wage</option></Select></FormField>{["hourly","day_rate","piece_rate","prevailing_wage"].includes(method)?<FormField label={method==="day_rate"?"Rate per day":method==="piece_rate"?"Rate per unit":"Hourly rate"}><Input type="number" min="0" step="0.01" value={rate} onChange={(e)=>setRate(e.target.value)}/></FormField>:null}{method==="day_rate"?<FormField label="Planned days"><Input type="number" min="0" step="0.5" value={plannedDays} onChange={(e)=>setPlannedDays(e.target.value)}/></FormField>:null}{method==="piece_rate"?<FormField label="Planned quantity"><Input type="number" min="0" step="0.01" value={plannedUnits} onChange={(e)=>setPlannedUnits(e.target.value)}/></FormField>:null}{method==="lump_sum"?<FormField label="Lump-sum amount"><Input type="number" min="0" step="0.01" value={lumpSum} onChange={(e)=>setLumpSum(e.target.value)}/></FormField>:null}</div>
        {method==="payroll_rate"?<div className="mt-3 space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Crew member pay snapshot</p>{loadingPay?<p className="text-sm">Loading employee rates…</p>:crewPay.length?crewPay.map((row)=><div key={row.employeeId} className="flex flex-wrap justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"><span className="font-semibold">{row.name}</span><span>{row.hourlyRate==null?"Rate missing":`${money(Number(row.hourlyRate))}/hr${Number(row.fringeHourly||0)>0?` + ${money(Number(row.fringeHourly))} fringe`:""}`}</span></div>):<p className="text-sm">No active crew members found.</p>}</div>:null}
        {method==="prevailing_wage"?<p className="mt-3 text-xs font-semibold text-[var(--color-warning-800)]">Use the applicable prevailing-wage determination/classification in the Prevailing Wage workspace. This rate is the project's planning commitment.</p>:null}
        <div className="mt-3 grid gap-2 sm:grid-cols-3"><Preview label="Planned duration" value={`${hours.toFixed(2)} hrs`}/><Preview label="Projected labor" value={money(projectedCost)}/><Preview label="Budget after assignment" value={remaining===null?"Budget unavailable":money(remaining)} danger={remaining!==null&&remaining<0}/></div>
      </div>
      <FormField label="Assignment notes"><textarea rows={3} value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Optional instructions, scope, meeting point, or compensation notes" className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"/></FormField>
      {localError?<p className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2 text-sm text-[var(--color-danger-700)]">{localError}</p>:null}
      <p className="text-xs text-[var(--color-text-secondary)]">B.O.S. checks overlapping schedule assignments. Project compensation is kept separate from the employee's payroll settings so job-specific prevailing wage, lump sum, day rate, or unit-rate work cannot corrupt payroll.</p>
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving||loadingPay}>{saving?"Assigning…":"Assign Crew & Commit Labor"}</Button></div>
    </form>:null}
  </section>;
}
function Preview({label,value,danger=false}:{label:string;value:string;danger?:boolean}){return <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</p><p className={`mt-1 font-extrabold ${danger?"text-[var(--color-danger-700)]":"text-[var(--color-text-primary)]"}`}>{value}</p></div>}
