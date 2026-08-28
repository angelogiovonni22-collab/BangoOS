"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Input } from "@/components/ui";

type ChangeOrder = { id:string; change_order_number:string; title:string; description:string|null; amount_delta:number; schedule_impact_days:number; status:string; review_notes:string|null };
type Bill = { id:string; bill_number:string; status:string; total_amount:number; amount_paid:number; balance_due:number; retainage_amount:number; due_date:string|null };
type PaymentApplication = { id:string; request_number:string; period_through:string; description:string; amount_requested:number; retainage_amount:number; net_requested:number; status:string; review_notes:string|null; bill:Bill|null };
type CloseoutRequirement = { id:string; requirement_type:string; required:boolean; status:string; verified_at:string|null };
type RetainageRelease = { id:string; amount:number; vendor_bill_id:string; created_at:string; bill:Bill|null };
type OperationsPayload = {
  assignment:{ contract_status:string; assignment_status:string; mobilization_status:string };
  commitment:{ base:number; approvedChanges:number; total:number };
  changeOrders:ChangeOrder[];
  paymentApplications:PaymentApplication[];
  closeoutRequirements:CloseoutRequirement[];
  billing:{ paid:number; outstanding:number; convertedBills:number };
  retainage:{ held:number; release:RetainageRelease|null; resolved:boolean };
  retainageReleaseReady:boolean;
  closeoutReady:boolean;
  requiredCloseoutOpen:number;
};

const money=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value||0));
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());

export function SubcontractorOperationsActions({ projectId, assignmentId }: { projectId:string; assignmentId:string }) {
  const [data,setData]=useState<OperationsPayload|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState<string|null>(null);
  const [coTitle,setCoTitle]=useState("");
  const [coAmount,setCoAmount]=useState("");
  const [coDays,setCoDays]=useState("0");
  const [coDescription,setCoDescription]=useState("");

  const endpoint=useMemo(()=>`/api/projects/${encodeURIComponent(projectId)}/subcontractors/${encodeURIComponent(assignmentId)}/operations`,[assignmentId,projectId]);
  const load=useCallback(async()=>{
    try{
      const response=await fetch(endpoint,{cache:"no-store"});
      const body=await response.json() as OperationsPayload&{error?:string};
      if(!response.ok)throw new Error(body.error||"Unable to load subcontractor operations.");
      setData(body);setError(null);
    }catch(caught){setError(caught instanceof Error?caught.message:"Unable to load subcontractor operations.");}
  },[endpoint]);
  useEffect(()=>{
    let cancelled=false;
    void fetch(endpoint,{cache:"no-store"})
      .then(async(response)=>{
        const body=await response.json() as OperationsPayload&{error?:string};
        if(!response.ok)throw new Error(body.error||"Unable to load subcontractor operations.");
        return body;
      })
      .then((body)=>{if(cancelled)return;setData(body);setError(null);})
      .catch((caught)=>{if(cancelled)return;setError(caught instanceof Error?caught.message:"Unable to load subcontractor operations.");});
    return ()=>{cancelled=true;};
  },[endpoint]);

  async function act(action:string,payload:Record<string,unknown>={}){
    setBusy(action+String(payload.changeOrderId||payload.applicationId||payload.requirementId||""));setError(null);
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error||"Unable to update subcontractor operations.");
      await load();
    }catch(caught){setError(caught instanceof Error?caught.message:"Unable to update subcontractor operations.");}
    finally{setBusy(null);}
  }

  async function createChangeOrder(){
    if(!coTitle.trim()){setError("Enter a subcontract change-order title.");return;}
    const amount=Number(coAmount||0);const days=Number(coDays||0);
    if(!Number.isFinite(amount)||!Number.isFinite(days)){setError("Enter valid change-order values.");return;}
    await act("create_change_order",{title:coTitle.trim(),description:coDescription.trim()||null,amountDelta:amount,scheduleImpactDays:Math.trunc(days)});
    setCoTitle("");setCoAmount("");setCoDays("0");setCoDescription("");
  }

  if(!data&&!error)return <div className="rounded-[12px] border border-[var(--bos-border-light)] bg-white px-3 py-3 text-xs font-semibold text-[var(--bos-text-medium-on-light)]">Loading billing, changes, and closeout…</div>;

  return <div className="space-y-3 border-t border-[var(--bos-border-light)] pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">Operations</p><p className="mt-1 text-sm font-bold text-[var(--bos-text-strong-on-light)]">Billing · Changes · Closeout</p></div>{data?<Badge tone={data.closeoutReady?"success":data.requiredCloseoutOpen?"warning":"info"}>{data.closeoutReady?"Ready to close":`${data.requiredCloseoutOpen} closeout open`}</Badge>:null}</div>
    {error?<p role="status" className="rounded-lg bg-[var(--color-warning-100)] px-3 py-2 text-xs font-semibold text-[var(--color-warning-800)]">{error}</p>:null}
    {data?<>
      <div className="grid gap-2 sm:grid-cols-4"><Metric label="Commitment" value={money(data.commitment.total)} detail={`${money(data.commitment.approvedChanges)} approved changes`}/><Metric label="Paid" value={money(data.billing.paid)} detail={`${data.billing.convertedBills} AP bills`}/><Metric label="Outstanding" value={money(data.billing.outstanding)} detail="Current progress billing"/><Metric label="Retainage Held" value={money(data.retainage.held)} detail={data.retainage.release?"Released to final AP":"Held until closeout"}/></div>

      <details className="rounded-lg border border-[var(--bos-border-light)] bg-white p-3"><summary className="cursor-pointer text-xs font-black text-[var(--bos-text-strong-on-light)]">Subcontract Change Orders ({data.changeOrders.length})</summary><div className="mt-3 space-y-3">
        {data.assignment.contract_status==="signed"?<div className="grid gap-2 rounded-lg bg-[var(--color-neutral-50)] p-3 sm:grid-cols-2"><Input value={coTitle} onChange={(event)=>setCoTitle(event.target.value)} placeholder="Change-order title"/><Input value={coAmount} onChange={(event)=>setCoAmount(event.target.value)} inputMode="decimal" placeholder="Amount + / -"/><Input value={coDays} onChange={(event)=>setCoDays(event.target.value)} inputMode="numeric" placeholder="Schedule days"/><Input value={coDescription} onChange={(event)=>setCoDescription(event.target.value)} placeholder="Scope / reason"/><Button type="button" size="sm" className="sm:col-span-2" disabled={busy!==null} onClick={()=>void createChangeOrder()}>Create Change Order</Button></div>:null}
        {data.changeOrders.length?data.changeOrders.map((row)=><div key={row.id} className="rounded-lg border border-[var(--bos-border-light)] px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black">{row.change_order_number} · {row.title}</p><p className="mt-1 text-[11px] font-semibold text-[var(--bos-text-medium-on-light)]">{money(row.amount_delta)} · {row.schedule_impact_days} schedule days</p></div><Badge tone={row.status==="approved"?"success":row.status==="rejected"?"danger":"warning"}>{label(row.status)}</Badge></div>{row.status==="submitted"?<div className="mt-2 flex gap-2"><Button type="button" size="sm" disabled={busy!==null} onClick={()=>void act("review_change_order",{changeOrderId:row.id,reviewAction:"approve"})}>Approve</Button><Button type="button" size="sm" variant="outline" disabled={busy!==null} onClick={()=>void act("review_change_order",{changeOrderId:row.id,reviewAction:"reject"})}>Reject</Button></div>:null}</div>):<p className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">No subcontract change orders.</p>}
      </div></details>

      <details className="rounded-lg border border-[var(--bos-border-light)] bg-white p-3"><summary className="cursor-pointer text-xs font-black text-[var(--bos-text-strong-on-light)]">Payment Applications ({data.paymentApplications.length})</summary><div className="mt-3 space-y-2">{data.paymentApplications.length?data.paymentApplications.map((row)=><div key={row.id} className="rounded-lg border border-[var(--bos-border-light)] px-3 py-2"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black">{row.request_number} · {money(row.amount_requested)}</p><p className="mt-1 text-[11px] font-semibold text-[var(--bos-text-medium-on-light)]">Through {row.period_through} · Retainage {money(row.retainage_amount)} · Net {money(row.net_requested)}</p><p className="mt-1 text-xs">{row.description}</p></div><Badge tone={row.status==="converted"?"success":row.status==="rejected"?"danger":"warning"}>{label(row.status)}</Badge></div>{row.status==="submitted"?<div className="mt-2 flex gap-2"><Button type="button" size="sm" disabled={busy!==null} onClick={()=>void act("review_payment_application",{applicationId:row.id,reviewAction:"approve"})}>Approve to AP Draft</Button><Button type="button" size="sm" variant="outline" disabled={busy!==null} onClick={()=>void act("review_payment_application",{applicationId:row.id,reviewAction:"reject"})}>Reject</Button></div>:null}{row.bill?<div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--color-neutral-50)] px-2 py-1.5 text-[11px] font-semibold"><span>AP {row.bill.bill_number} · {label(row.bill.status)} · Paid {money(row.bill.amount_paid)} · Due {money(row.bill.balance_due)}</span><Link href={`/invoices/accounts-payable/${row.bill.id}`} className="font-black text-[var(--orion-blue)]">Open AP Bill</Link></div>:null}</div>):<p className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">No payment applications submitted.</p>}</div></details>

      <details className="rounded-lg border border-[var(--bos-border-light)] bg-white p-3" open={data.assignment.contract_status==="closed"}><summary className="cursor-pointer text-xs font-black text-[var(--bos-text-strong-on-light)]">Closeout Requirements ({data.requiredCloseoutOpen} open)</summary><div className="mt-3 space-y-2">{data.closeoutRequirements.map((row)=><div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--bos-border-light)] px-3 py-2"><div><p className="text-xs font-black">{label(row.requirement_type)}</p><p className="text-[11px] font-semibold text-[var(--bos-text-medium-on-light)]">{row.required?"Required":"Not required"} · {label(row.status)}</p></div>{row.required&&!["verified","waived"].includes(row.status)?<div className="flex gap-1"><Button type="button" size="sm" disabled={busy!==null} onClick={()=>void act("update_closeout",{requirementId:row.id,status:"verified"})}>Verify</Button><Button type="button" size="sm" variant="outline" disabled={busy!==null} onClick={()=>void act("update_closeout",{requirementId:row.id,status:"waived"})}>Waive</Button></div>:<Badge tone={row.status==="verified"?"success":"neutral"}>{label(row.status)}</Badge>}</div>)}
        {data.retainage.held>0?<div className="rounded-lg border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black">Final Retainage · {money(data.retainage.held)}</p><p className="mt-1 text-[11px] font-semibold text-[var(--bos-text-medium-on-light)]">Held outside current payable until closeout evidence and progress AP are resolved.</p></div>{data.retainage.resolved?<Badge tone="success">Resolved</Badge>:data.retainage.release?<Badge tone="warning">Final AP open</Badge>:<Badge tone="info">Held</Badge>}</div>{data.retainage.release?.bill?<div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold"><span>AP {data.retainage.release.bill.bill_number} · {label(data.retainage.release.bill.status)} · Due {money(data.retainage.release.bill.balance_due)}</span><Link href={`/invoices/accounts-payable/${data.retainage.release.bill.id}`} className="font-black text-[var(--orion-blue)]">Open Retainage Bill</Link></div>:data.retainageReleaseReady?<Button type="button" size="sm" className="mt-2" disabled={busy!==null} onClick={()=>void act("release_retainage")}>Release Retainage to AP Draft</Button>:null}</div>:null}
        <Button type="button" className="w-full" disabled={!data.closeoutReady||busy!==null||data.assignment.contract_status==="closed"} onClick={()=>void act("close_assignment")}>{data.assignment.contract_status==="closed"?"Subcontract Closed":"Complete Subcontract Closeout"}</Button>{!data.closeoutReady?<p className="text-[11px] font-semibold text-[var(--bos-text-medium-on-light)]">All required closeout items, open payment applications, progress AP, and any retained final balance must be resolved first.</p>:null}</div></details>
    </>:null}
  </div>;
}

function Metric({label,value,detail}:{label:string;value:string;detail:string}){return <div className="rounded-lg border border-[var(--bos-border-light)] bg-white px-3 py-2"><p className="text-[10px] font-black uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 text-sm font-black text-[var(--bos-text-strong-on-light)]">{value}</p><p className="mt-1 text-[11px] font-semibold text-[var(--bos-text-medium-on-light)]">{detail}</p></div>;}
