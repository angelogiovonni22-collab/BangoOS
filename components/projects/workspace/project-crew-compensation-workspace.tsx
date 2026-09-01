"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, getButtonClassName } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { calculateLaborCost, compensationMethodLabel, type CompensationMethod } from "@/lib/projects/project-commitments";

type AssignmentRow = { id:string; title:string|null; status:string; starts_at:string|null; ends_at:string|null; crew_id:string|null; employee_id:string|null };
type CommitmentRow = { id:string; employee_id:string|null; crew_id:string|null; compensation_method:CompensationMethod; rate:number; projected_hours:number; projected_days:number; projected_units:number; lump_sum_amount:number; actual_hours:number; actual_days:number; actual_units:number; actual_cost_override:number|null; rate_details:Record<string,unknown>|null; notes:string|null };
type EmployeeRow = { id:string; employee_number:string; position_title:string; profile_id:string|null };
type ProfileRow = { id:string; first_name:string|null; last_name:string|null };
type CrewRow = { id:string; name:string };
type TimeRow = { employee_id:string; started_at:string; ended_at:string|null; break_minutes:number|null };
type PartnerRow = { id:string; vendor_id:string; trade_name:string; contract_status:string; contract_amount:number|null; payment_terms:string|null; retainage_percent:number|null; assignment_status:string; mobilization_status:string; start_date:string|null; target_completion_date:string|null };
type VendorRow = { id:string; company_name:string|null; first_name:string|null; last_name:string|null };

export function ProjectCrewCompensationWorkspace({ projectId, localeTag }: { projectId:string; localeTag:string }) {
  const client = useMemo(() => createClient(), []);
  const [assignments,setAssignments]=useState<AssignmentRow[]>([]);
  const [commitments,setCommitments]=useState<CommitmentRow[]>([]);
  const [employees,setEmployees]=useState<EmployeeRow[]>([]);
  const [profiles,setProfiles]=useState<ProfileRow[]>([]);
  const [crews,setCrews]=useState<CrewRow[]>([]);
  const [time,setTime]=useState<TimeRow[]>([]);
  const [partners,setPartners]=useState<PartnerRow[]>([]);
  const [vendors,setVendors]=useState<VendorRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [financialRestricted,setFinancialRestricted]=useState(false);

  useEffect(()=>{
    let active=true;
    async function load(){
      if(!client){setError("B.O.S. database is unavailable.");setLoading(false);return;}
      const workspace=await resolveWorkspaceContext(client);
      if(!workspace.context){setError(workspace.errorMessage||"Unable to load project crew.");setLoading(false);return;}
      const db=client as unknown as { // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from:(table:string)=>any;
      };
      const companyId=workspace.context.companyId;
      const [assignmentResult,commitmentResult,timeResult,partnerResult]=await Promise.all([
        db.from("workforce_assignments").select("id,title,status,starts_at,ends_at,crew_id,employee_id").eq("company_id",companyId).eq("project_id",projectId).order("starts_at",{ascending:false}),
        db.from("project_labor_commitments").select("id,employee_id,crew_id,compensation_method,rate,projected_hours,projected_days,projected_units,lump_sum_amount,actual_hours,actual_days,actual_units,actual_cost_override,rate_details,notes").eq("company_id",companyId).eq("project_id",projectId),
        db.from("workforce_time_entries").select("employee_id,started_at,ended_at,break_minutes").eq("company_id",companyId).eq("project_id",projectId).eq("status","approved").not("ended_at","is",null),
        db.from("trade_partner_assignments").select("id,vendor_id,trade_name,contract_status,contract_amount,payment_terms,retainage_percent,assignment_status,mobilization_status,start_date,target_completion_date").eq("company_id",companyId).eq("project_id",projectId).neq("assignment_status","archived"),
      ]);
      if(!active)return;
      if(assignmentResult.error){setError(assignmentResult.error.message||"Unable to load workforce assignments.");setLoading(false);return;}
      setAssignments((assignmentResult.data||[]) as AssignmentRow[]);
      if(commitmentResult.error){setFinancialRestricted(true);setCommitments([]);}else setCommitments((commitmentResult.data||[]) as CommitmentRow[]);
      setTime((timeResult.data||[]) as TimeRow[]);
      setPartners((partnerResult.data||[]) as PartnerRow[]);

      const employeeIds=[...new Set([...(assignmentResult.data||[]).map((r:AssignmentRow)=>r.employee_id),...(commitmentResult.data||[]).map((r:CommitmentRow)=>r.employee_id)].filter(Boolean))] as string[];
      const crewIds=[...new Set([...(assignmentResult.data||[]).map((r:AssignmentRow)=>r.crew_id),...(commitmentResult.data||[]).map((r:CommitmentRow)=>r.crew_id)].filter(Boolean))] as string[];
      const vendorIds=[...new Set((partnerResult.data||[]).map((r:PartnerRow)=>r.vendor_id).filter(Boolean))] as string[];
      const [employeeResult,crewResult,vendorResult]=await Promise.all([
        employeeIds.length?db.from("employees").select("id,employee_number,position_title,profile_id").eq("company_id",companyId).in("id",employeeIds):Promise.resolve({data:[],error:null}),
        crewIds.length?db.from("crews").select("id,name").eq("company_id",companyId).in("id",crewIds):Promise.resolve({data:[],error:null}),
        vendorIds.length?db.from("vendors").select("id,company_name,first_name,last_name").eq("company_id",companyId).in("id",vendorIds):Promise.resolve({data:[],error:null}),
      ]);
      if(!active)return;
      const employeeRows=(employeeResult.data||[]) as EmployeeRow[]; setEmployees(employeeRows); setCrews((crewResult.data||[]) as CrewRow[]); setVendors((vendorResult.data||[]) as VendorRow[]);
      const profileIds=employeeRows.map((r)=>r.profile_id).filter(Boolean) as string[];
      if(profileIds.length){const profileResult=await db.from("profiles").select("id,first_name,last_name").eq("company_id",companyId).in("id",profileIds);if(active)setProfiles((profileResult.data||[]) as ProfileRow[]);}
      if(active)setLoading(false);
    }
    void load(); return()=>{active=false;};
  },[client,projectId]);

  const employeeById=useMemo(()=>new Map(employees.map((e)=>[e.id,e])),[employees]);
  const profileById=useMemo(()=>new Map(profiles.map((p)=>[p.id,p])),[profiles]);
  const crewById=useMemo(()=>new Map(crews.map((c)=>[c.id,c])),[crews]);
  const vendorById=useMemo(()=>new Map(vendors.map((v)=>[v.id,v])),[vendors]);
  const hoursByEmployee=useMemo(()=>{const map=new Map<string,number>();for(const row of time){if(!row.ended_at)continue;const hours=Math.max(0,(new Date(row.ended_at).getTime()-new Date(row.started_at).getTime())/3_600_000-Number(row.break_minutes||0)/60);map.set(row.employee_id,(map.get(row.employee_id)||0)+hours);}return map;},[time]);
  const money=(value:number)=>new Intl.NumberFormat(localeTag,{style:"currency",currency:"USD"}).format(value);
  const commitmentFor=(assignment:AssignmentRow)=>commitments.find((c)=>assignment.employee_id?c.employee_id===assignment.employee_id:c.crew_id===assignment.crew_id);
  const projectedTotal=commitments.reduce((sum,c)=>sum+calculateLaborCost(commitmentInput(c,false)),0);
  const actualTotal=commitments.reduce((sum,c)=>sum+calculateLaborCost(commitmentInput(c,true,hoursByEmployee)),0);

  if(loading)return <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-5"><p className="text-sm font-semibold text-[var(--bos-text-medium-on-light)]">Loading crew costs…</p></section>;
  if(error)return <section className="rounded-[18px] border border-[var(--color-danger-200)] bg-[var(--bos-bg-workspace-surface)] p-5"><p className="font-bold text-[var(--color-danger-700)]">{error}</p></section>;

  return <div className="space-y-4">
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold text-[var(--bos-text-strong-on-light)]">Employees & Crews</h2><p className="mt-1 text-sm text-[var(--bos-text-medium-on-light)]">Project assignments, schedules, and employee compensation details.</p></div><div className="flex items-center gap-2"><span className="text-xs font-bold text-[var(--bos-text-medium-on-light)]">{assignments.length} assignment{assignments.length===1?"":"s"}</span><Link href="/crews" className={getButtonClassName({ variant: "outline", size: "sm" })}>Open CrewOS</Link></div></div>
      {assignments.length===0?<Empty text="No employee or crew assignments are connected to this project yet."/>:assignments.map((assignment)=>{
        const commitment=commitmentFor(assignment); const title=assignment.crew_id?crewById.get(assignment.crew_id)?.name||assignment.title||"Crew":employeeName(assignment.employee_id,employeeById,profileById)||assignment.title||"Employee";
        const actualHours=commitment?.employee_id?hoursByEmployee.get(commitment.employee_id)||0:Number(commitment?.actual_hours||0);
        return <article key={assignment.id} className="rounded-[16px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-extrabold text-[var(--bos-text-strong-on-light)]">{title}</p><p className="mt-1 text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{dateRange(assignment.starts_at,assignment.ends_at,localeTag)}</p></div><Badge tone={assignment.status==="active"||assignment.status==="published"?"success":"neutral"}>{pretty(assignment.status)}</Badge></div>
          {commitment&&!financialRestricted?<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><Detail label="Pay method" value={compensationMethodLabel(commitment.compensation_method)}/><Detail label="Rate / amount" value={commitment.compensation_method==="lump_sum"?money(Number(commitment.lump_sum_amount||0)):rateLabel(commitment,money)}/><Detail label="Planned" value={plannedLabel(commitment)}/><Detail label="Projected cost" value={money(calculateLaborCost(commitmentInput(commitment,false)))}/><Detail label="Actual" value={`${actualHours.toFixed(2)} hrs · ${money(calculateLaborCost(commitmentInput(commitment,true,hoursByEmployee)))}`}/></div>:!financialRestricted?<p className="mt-3 rounded-xl border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-2 text-sm font-semibold text-[var(--color-warning-800)]">Compensation has not been set for this assignment. Open the crew profile to set the project pay arrangement.</p>:null}
          {commitment?.compensation_method==="prevailing_wage"?<p className="mt-3 text-xs font-semibold text-[var(--bos-text-medium-on-light)]">Prevailing-wage classifications, fringe, apprentices, and certified-payroll compliance remain governed by the project Prevailing Wage workspace.</p>:null}
        </article>;
      })}
    </section>

    <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-5 shadow-[var(--shadow-small)]">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold text-[var(--bos-text-strong-on-light)]">Labor & Subcontractor Agreements</h2><p className="mt-1 text-sm text-[var(--bos-text-medium-on-light)]">Employee labor totals and each subcontractor&apos;s compensation agreement, commitment, and authorization status.</p></div><div className="flex flex-wrap gap-2"><Link href="/invoices/payroll" className={getButtonClassName({ variant: "outline", size: "sm" })}>Employee Pay Rates</Link><Link href={`/projects/${projectId}?tab=subcontractors`} className={getButtonClassName({ size: "sm" })}>Manage Subcontractors</Link></div></div>
      {!financialRestricted?<div className="mt-4 grid gap-3 sm:grid-cols-2"><Summary label="Projected employee/crew labor" value={money(projectedTotal)}/><Summary label="Actual approved-time labor" value={money(actualTotal)}/></div>:<p className="mt-4 rounded-xl bg-[var(--color-warning-100)] p-3 text-sm font-semibold text-[var(--color-warning-800)]">Compensation details are restricted to authorized project/financial roles. Assignment and schedule details remain visible.</p>}
      <div className="mt-5 space-y-3"><div className="flex items-center justify-between"><h3 className="text-lg font-extrabold text-[var(--bos-text-strong-on-light)]">Subcontractor Compensation Agreements</h3><span className="text-xs font-bold text-[var(--bos-text-medium-on-light)]">{partners.length} subcontractor{partners.length===1?"":"s"}</span></div>
      {partners.length===0?<Empty text="No subcontractors are selected for this project."/>:partners.map((partner)=>{const vendor=vendorById.get(partner.vendor_id);const name=vendor?.company_name||[vendor?.first_name,vendor?.last_name].filter(Boolean).join(" ")||partner.trade_name;return <article key={partner.id} className="rounded-[16px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-extrabold text-[var(--bos-text-strong-on-light)]">{name}</p><p className="text-sm font-semibold text-[var(--bos-text-medium-on-light)]">{partner.trade_name}</p></div><Badge tone={partner.contract_status==="signed"?partner.mobilization_status==="cleared"?"success":"warning":"neutral"}>{pretty(partner.contract_status)}</Badge></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><Detail label="Committed amount" value={money(Number(partner.contract_amount||0))}/><Detail label="Compensation & payment terms" value={partner.payment_terms||"Not provided"}/><Detail label="Retainage" value={partner.retainage_percent==null?"None specified":`${partner.retainage_percent}%`}/><Detail label="Authorized to start" value={partner.contract_status==="signed"&&partner.mobilization_status==="cleared"&&partner.assignment_status==="active"?"Yes":"No"}/></div></article>;})}</div>
    </section>
  </div>;
}

function commitmentInput(c:CommitmentRow,actual:boolean,hours?:Map<string,number>){return {method:c.compensation_method,rate:Number(c.rate||0),projectedHours:Number(c.projected_hours||0),projectedDays:Number(c.projected_days||0),projectedUnits:Number(c.projected_units||0),lumpSumAmount:Number(c.lump_sum_amount||0),actualHours:actual&&c.employee_id?hours?.get(c.employee_id)||Number(c.actual_hours||0):Number(c.actual_hours||0),actualDays:Number(c.actual_days||0),actualUnits:Number(c.actual_units||0),actualCostOverride:c.actual_cost_override};}
function employeeName(id:string|null,employees:Map<string,EmployeeRow>,profiles:Map<string,ProfileRow>){if(!id)return null;const employee=employees.get(id);if(!employee)return null;const profile=employee.profile_id?profiles.get(employee.profile_id):null;return [profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||employee.employee_number;}
function rateLabel(c:CommitmentRow,money:(v:number)=>string){if(c.compensation_method==="day_rate")return `${money(Number(c.rate||0))}/day`;if(c.compensation_method==="piece_rate")return `${money(Number(c.rate||0))}/unit`;return `${money(Number(c.rate||0))}/hr`;}
function plannedLabel(c:CommitmentRow){if(c.compensation_method==="lump_sum")return "Fixed commitment";if(c.compensation_method==="day_rate")return `${Number(c.projected_days||0)} days`;if(c.compensation_method==="piece_rate")return `${Number(c.projected_units||0)} units`;return `${Number(c.projected_hours||0)} hrs`;}
function dateRange(start:string|null,end:string|null,locale:string){if(!start&&!end)return "Schedule not set";const fmt=(v:string)=>new Intl.DateTimeFormat(locale,{month:"short",day:"numeric",year:"numeric"}).format(new Date(v));return [start?`Starts ${fmt(start)}`:null,end?`Ends ${fmt(end)}`:null].filter(Boolean).join(" · ");}
function pretty(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,(c)=>c.toUpperCase());}
function Summary({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 text-xl font-extrabold text-[var(--bos-text-strong-on-light)]">{value}</p></div>}
function Detail({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 break-words text-sm font-extrabold text-[var(--bos-text-strong-on-light)]">{value}</p></div>}
function Empty({text}:{text:string}){return <div className="rounded-[16px] border border-dashed border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-5 text-sm font-semibold text-[var(--bos-text-medium-on-light)]">{text}</div>}
