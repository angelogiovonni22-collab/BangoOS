"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import {
  correctWorkforceTime, getWorkforceTimeCompliance, getWorkforceTimeReviewAccess,
  listSubmittedWorkforceTime, reviewWorkforceTime, type WorkforceTimeReview,
} from "@/lib/crews/workforce-time";
import { MobileFieldConfirmAction } from "./mobile-field-confirm-action";

const formatStamp=(value:string)=>new Intl.DateTimeFormat(undefined,{
  month:"short",day:"numeric",hour:"numeric",minute:"2-digit"
}).format(new Date(value));
function localInputDate(value:string){
  const date=new Date(value);
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
type CorrectionDraft={startedAt:string;endedAt:string;breakMinutes:string;notes:string;reason:string};
function draftFromRow(row:WorkforceTimeReview):CorrectionDraft{
  return {startedAt:localInputDate(row.startedAt),endedAt:localInputDate(row.endedAt),
    breakMinutes:String(row.breakMinutes),notes:row.notes||"",reason:""};
}

export function MobileTimeApprovals(){
  const [rows,setRows]=useState<WorkforceTimeReview[]>([]);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState<string|null>(null);
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [draft,setDraft]=useState<CorrectionDraft|null>(null);
  const decisionRef=useRef("");

  const load=useCallback(async()=>{
    try{
      const access=await getWorkforceTimeReviewAccess();
      setAllowed(access);
      if(!access){setRows([]);setMessage(null);return;}
      setRows(await listSubmittedWorkforceTime());
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to load time approvals.");}
  },[]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[load]);

  const decide=async(id:string,decision:"approved"|"rejected")=>{
    if(decisionRef.current)return;
    decisionRef.current=id;setBusy(id);setMessage(null);
    try{
      await reviewWorkforceTime(id,decision);
      setMessage(decision==="approved"?"Time entry approved.":"Time entry rejected.");
      await load();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Unable to review time entry.");
      await load();
    }finally{decisionRef.current="";setBusy("");}
  };

  const saveCorrection=async(row:WorkforceTimeReview)=>{
    if(decisionRef.current||!draft)return;
    decisionRef.current=row.id;setBusy(row.id);setMessage(null);
    try{
      await correctWorkforceTime({
        entryId:row.id,startedAt:draft.startedAt,endedAt:draft.endedAt,
        breakMinutes:Number(draft.breakMinutes),notes:draft.notes,reason:draft.reason
      });
      setEditingId(null);setDraft(null);
      setMessage("Correction saved with audit history and submitted for manager approval.");
      await load();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Unable to correct time entry.");
    }finally{decisionRef.current="";setBusy("");}
  };

  return <section data-orion-region="mobile-time-approvals" className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
    <p className="text-sm font-semibold text-[var(--text-primary)]">Time approvals & corrections</p>
    {allowed===false?<p className="mt-2 text-xs text-[var(--text-secondary)]">Time approval controls are available to authorized supervisors and managers.</p>:
    <div className="mt-3 space-y-2">
      {rows.map(row=>{
        const compliance=getWorkforceTimeCompliance(row);
        const locationEvidence=Boolean(row.clockInLocation&&row.clockOutLocation);
        const isEditing=editingId===row.id&&draft!==null;
        return <article key={row.id} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">{row.employeeName} · {row.hours.toFixed(2)} hours</p>
          <p className="text-xs text-[var(--text-secondary)]">{row.projectName||"No project"} · {formatStamp(row.startedAt)}–{formatStamp(row.endedAt)} · {row.status==="rejected"?"Rejected":"Submitted"}</p>
          <p className="text-xs text-[var(--text-secondary)]">Regular {compliance.regularHours.toFixed(2)} · Overtime {compliance.overtimeHours.toFixed(2)} · Break {row.breakMinutes} min</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Location evidence: {locationEvidence?"clock-in and clock-out verified":row.clockInLocation||row.clockOutLocation?"partial":"not captured"}</p>
          {row.notes?<p className="mt-1 text-xs text-[var(--text-secondary)]">Note: {row.notes}</p>:null}
          {compliance.requiresAttention?<p role="alert" className="mt-1 text-xs text-[var(--color-warning-700)]">{compliance.missingBreak?"Missing break record. ":""}{compliance.overtimeHours>0?`${compliance.overtimeHours.toFixed(2)} overtime hours require review.`:""}</p>:null}
          <div className="mt-2 flex flex-wrap gap-2">
            {row.status==="submitted"?<><Button size="sm" disabled={Boolean(busy)} onClick={()=>void decide(row.id,"approved")}>Approve</Button>
            <MobileFieldConfirmAction label="Reject" confirmLabel="Confirm rejection" description={`Reject ${row.employeeName}'s submitted time entry?`} disabled={Boolean(busy)} onConfirm={()=>decide(row.id,"rejected")}/></>:null}
            <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={()=>{
              if(isEditing){setEditingId(null);setDraft(null);}
              else {setEditingId(row.id);setDraft(draftFromRow(row));}
            }}>{isEditing?"Cancel correction":"Correct time"}</Button>
          </div>
          {isEditing&&draft?<div className="mt-3 space-y-2 rounded-lg border border-[var(--border-subtle)] p-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Correct & resubmit</p>
            <label className="block text-xs text-[var(--text-secondary)]">Clock-in
              <Input type="datetime-local" className="mt-1" value={draft.startedAt} onChange={event=>setDraft(v=>v?{...v,startedAt:event.target.value}:v)}/>
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">Clock-out
              <Input type="datetime-local" className="mt-1" value={draft.endedAt} onChange={event=>setDraft(v=>v?{...v,endedAt:event.target.value}:v)}/>
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">Unpaid break (minutes)
              <Input type="number" min="0" step="1" className="mt-1" value={draft.breakMinutes} onChange={event=>setDraft(v=>v?{...v,breakMinutes:event.target.value}:v)}/>
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">Time notes
              <Textarea className="mt-1" value={draft.notes} onChange={event=>setDraft(v=>v?{...v,notes:event.target.value}:v)}/>
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">Correction reason (required)
              <Textarea className="mt-1" value={draft.reason} onChange={event=>setDraft(v=>v?{...v,reason:event.target.value}:v)} placeholder="Why this time needs correcting"/>
            </label>
            <Button disabled={Boolean(busy)||draft.reason.trim().length<5||!draft.startedAt||!draft.endedAt||draft.breakMinutes.trim()===""} onClick={()=>void saveCorrection(row)}>Save correction & resubmit</Button>
            <p className="text-xs text-[var(--text-secondary)]">Corrections are recorded in the audit history. Approved and payroll-processed time cannot be edited here.</p>
          </div>:null}
        </article>;
      })}
      {allowed===true&&!rows.length?<p className="text-xs text-[var(--text-secondary)]">No submitted or rejected time entries awaiting review.</p>:null}
    </div>}
    {message?<p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p>:null}
  </section>;
}
