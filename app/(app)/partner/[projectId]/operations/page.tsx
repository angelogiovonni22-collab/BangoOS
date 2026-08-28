/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type Job={assignment_id:string;project_id:string;project_name:string;trade_name:string;contract_status:string;assignment_status:string;scope_of_work:string|null;start_date:string|null;target_completion_date:string|null};
type ChangeOrder={id:string;change_order_number:string;title:string;description:string|null;amount_delta:number;schedule_impact_days:number;status:string};
type PaymentApplication={id:string;request_number:string;period_through:string;description:string;amount_requested:number;retainage_amount:number;net_requested:number;status:string;vendor_bill_id:string|null;review_notes:string|null};
type CloseoutRequirement={id:string;requirement_type:string;required:boolean;status:string};
type Bill={id:string;bill_number:string;status:string;amount_paid:number;balance_due:number;due_date:string|null};
type Db={from:(table:string)=>any;rpc:(name:string,args?:Record<string,unknown>)=>Promise<{data:any;error:{message:string}|null}>};

type PageProps={params:Promise<{projectId:string}>;searchParams:Promise<{notice?:string;error?:string}>};

export default async function TradePartnerOperationsPage({params,searchParams}:PageProps){
  const {projectId}=await params;const query=await searchParams;
  const supabase=await createClient();if(!supabase)redirect("/login");
  const workspace=await resolveWorkspaceContext(supabase);if(!workspace.context)redirect("/login");
  if((workspace.context.role||"").toLowerCase()!=="subcontractor")redirect("/app-entry");
  const db=supabase as unknown as Db;
  const jobsResult=await db.rpc("get_my_trade_partner_jobs");
  const jobs=(jobsResult.data||[]) as Job[];const job=jobs.find((item)=>item.project_id===projectId);if(!job)redirect("/partner");
  await db.rpc("ensure_subcontractor_closeout_requirements",{p_assignment_id:job.assignment_id});
  const [changeResult,paymentResult,closeoutResult]=await Promise.all([
    db.from("subcontractor_change_orders").select("id,change_order_number,title,description,amount_delta,schedule_impact_days,status").eq("assignment_id",job.assignment_id).order("created_at",{ascending:false}),
    db.from("subcontractor_payment_applications").select("id,request_number,period_through,description,amount_requested,retainage_amount,net_requested,status,vendor_bill_id,review_notes").eq("assignment_id",job.assignment_id).order("created_at",{ascending:false}),
    db.from("subcontractor_closeout_requirements").select("id,requirement_type,required,status").eq("assignment_id",job.assignment_id).order("created_at",{ascending:true}),
  ]);
  const changeOrders=(changeResult.data||[]) as ChangeOrder[];const payments=(paymentResult.data||[]) as PaymentApplication[];const closeout=(closeoutResult.data||[]) as CloseoutRequirement[];
  const billIds=payments.map((item)=>item.vendor_bill_id).filter((value):value is string=>Boolean(value));let bills:Bill[]=[];
  if(billIds.length){const billResult=await db.from("vendor_bills").select("id,bill_number,status,amount_paid,balance_due,due_date").in("id",billIds);bills=(billResult.data||[]) as Bill[];}
  const billById=new Map(bills.map((bill)=>[bill.id,bill]));
  const approvedChanges=changeOrders.filter((row)=>row.status==="approved").reduce((sum,row)=>sum+Number(row.amount_delta||0),0);

  async function submitPayment(formData:FormData){
    "use server";
    const client=await createClient();if(!client)redirect("/login");
    const context=await resolveWorkspaceContext(client);if(!context.context||(context.context.role||"").toLowerCase()!=="subcontractor")redirect("/app-entry");
    const amount=Number(formData.get("amount")||0);const retainage=Number(formData.get("retainage")||0);const description=String(formData.get("description")||"").trim();const through=String(formData.get("periodThrough")||"").trim();
    const result=await (client as unknown as Db).rpc("submit_my_subcontractor_payment_application",{p_project_id:projectId,p_amount_requested:amount,p_retainage_amount:retainage,p_description:description,p_period_through:through||new Date().toISOString().slice(0,10)});
    if(result.error)redirect(`/partner/${projectId}/operations?error=${encodeURIComponent(result.error.message)}`);
    revalidatePath(`/partner/${projectId}/operations`);redirect(`/partner/${projectId}/operations?notice=${encodeURIComponent("Payment application submitted for review.")}`);
  }

  return <div className="container-content space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/partner/${projectId}`} className="text-sm font-semibold text-[#8ec3ff] hover:underline">← Project workspace</Link><Link href="/partner" className="text-sm font-semibold text-[var(--bos-text-secondary)] hover:underline">All projects</Link></div>
    <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8ec3ff]">Trade Partner Operations</p><h1 className="mt-2 text-2xl font-semibold">{job.project_name}</h1><p className="mt-2 text-sm text-[var(--bos-text-secondary)]">{job.trade_name} · {job.scope_of_work||"Scope not published"}</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Info label="Agreement" value={label(job.contract_status)}/><Info label="Assignment" value={label(job.assignment_status)}/><Info label="Approved changes" value={money(approvedChanges)}/></div></section>
    {query.notice?<div className="rounded-xl border border-emerald-300/40 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{query.notice}</div>:null}{query.error?<div className="rounded-xl border border-rose-300/40 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{query.error}</div>:null}

    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8ec3ff]">Billing</p><h2 className="mt-1 text-xl font-semibold">Submit Payment Application</h2><p className="mt-2 text-sm text-[var(--bos-text-secondary)]">Requests are reviewed by the project team before a draft AP bill is created. Submitting does not authorize payment.</p></div><form action={submitPayment} className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Amount requested"><input name="amount" type="number" min="0.01" step="0.01" required className="control"/></Field><Field label="Retainage"><input name="retainage" type="number" min="0" step="0.01" defaultValue="0" className="control"/></Field><Field label="Period through"><input name="periodThrough" type="date" defaultValue={new Date().toISOString().slice(0,10)} className="control"/></Field><Field label="Work completed / invoice description"><input name="description" maxLength={500} required className="control"/></Field><button type="submit" disabled={job.contract_status!=="signed"||job.assignment_status!=="active"} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">Submit Payment Application</button></form></section>

      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8ec3ff]">Commitment Changes</p><h2 className="mt-1 text-xl font-semibold">Subcontract Change Orders</h2><div className="mt-4 space-y-3">{changeOrders.length?changeOrders.map((row)=><article key={row.id} className="rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{row.change_order_number} · {row.title}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{money(row.amount_delta)} · {row.schedule_impact_days} schedule days</p></div><span className="rounded-full border border-[var(--bos-border-default)] px-2 py-1 text-xs font-semibold">{label(row.status)}</span></div>{row.description?<p className="mt-2 text-sm text-[var(--bos-text-secondary)]">{row.description}</p>:null}</article>):<p className="rounded-xl border border-dashed border-[var(--bos-border-subtle)] p-4 text-sm text-[var(--bos-text-secondary)]">No subcontract change orders.</p>}</div></section>
    </div>

    <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8ec3ff]">Payment Status</p><h2 className="mt-1 text-xl font-semibold">Applications & AP Status</h2></div><span className="text-xs text-[var(--bos-text-muted)]">{payments.length} requests</span></div><div className="mt-4 space-y-3">{payments.length?payments.map((row)=>{const bill=row.vendor_bill_id?billById.get(row.vendor_bill_id):null;return <article key={row.id} className="rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.request_number} · {money(row.amount_requested)}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">Retainage {money(row.retainage_amount)} · Net request {money(row.net_requested)} · Through {row.period_through}</p><p className="mt-2 text-sm">{row.description}</p></div><span className="rounded-full border border-[var(--bos-border-default)] px-2 py-1 text-xs font-semibold">{label(row.status)}</span></div>{bill?<div className="mt-3 grid gap-2 sm:grid-cols-4"><Info label="AP bill" value={bill.bill_number}/><Info label="AP status" value={label(bill.status)}/><Info label="Paid" value={money(bill.amount_paid)}/><Info label="Balance" value={money(bill.balance_due)}/></div>:null}{row.review_notes?<p className="mt-2 text-xs text-[var(--bos-text-secondary)]">Review note: {row.review_notes}</p>:null}</article>}):<p className="rounded-xl border border-dashed border-[var(--bos-border-subtle)] p-4 text-sm text-[var(--bos-text-secondary)]">No payment applications submitted.</p>}</div></section>

    <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8ec3ff]">Closeout</p><h2 className="mt-1 text-xl font-semibold">Required Handover Items</h2><p className="mt-2 text-sm text-[var(--bos-text-secondary)]">The project team verifies final invoice, lien waiver, warranty, punch, and other required closeout evidence before the subcontract can be closed.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{closeout.map((row)=><Info key={row.id} label={label(row.requirement_type)} value={`${row.required?"Required":"Not required"} · ${label(row.status)}`}/>)}</div></section>
    <style>{`.control{margin-top:.5rem;height:2.5rem;width:100%;border-radius:.5rem;border:1px solid var(--bos-border-default);background:var(--bos-bg-control);padding:0 .75rem;color:var(--bos-text-primary);font-size:.875rem}`}</style>
  </div>;
}

function Field({label:fieldLabel,children}:{label:string;children:React.ReactNode}){return <label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-muted)]">{fieldLabel}{children}</label>;}
function Info({label:infoLabel,value}:{label:string;value:string}){return <div className="rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-3"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--bos-text-muted)]">{infoLabel}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;}
function label(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());}
function money(value:number){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value||0));}
