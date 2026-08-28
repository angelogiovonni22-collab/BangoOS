import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeInvoicePaymentCollection } from "@/lib/compliance/deposit-payment-service";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import type { Database } from "@/types/database.types";

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

export type AccountsReceivableInvoice = {
  id: string;
  invoiceNumber: string;
  title: string;
  customerId: string | null;
  customerName: string;
  projectId: string | null;
  projectName: string;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  daysOutstanding: number;
  agingBucket: AgingBucket;
};

export type AccountsReceivableSummary = {
  totalReceivable: number;
  overdueReceivable: number;
  currentReceivable: number;
  collectedThisMonth: number;
  overdueCount: number;
  openInvoiceCount: number;
  aging: Record<AgingBucket, number>;
};

type AccountsReceivableData = { invoices: AccountsReceivableInvoice[]; summary: AccountsReceivableSummary };
type CustomerSource = Pick<Database["public"]["Tables"]["customers"]["Row"], "id" | "first_name" | "last_name" | "company_name" | "customer_type">;
function displayCustomer(customer: CustomerSource | undefined) { if (!customer) return "Not linked"; const company=customer.company_name?.trim()||""; const person=[customer.first_name?.trim(),customer.last_name?.trim()].filter(Boolean).join(" "); return customer.customer_type?.toLowerCase()==="commercial"&&company?company:person||company||"Unnamed customer"; }
function startOfDay(value: Date){return new Date(value.getFullYear(),value.getMonth(),value.getDate());}
function parseDateOnly(value:string){const [year,month,day]=value.split("-").map(Number);return new Date(year,month-1,day);}
function dayDiff(from:Date,to:Date){return Math.max(0,Math.floor((startOfDay(to).getTime()-startOfDay(from).getTime())/86_400_000));}
export function resolveAgingBucket(dueDate:string|null,now=new Date()):AgingBucket{if(!dueDate)return"current";const due=parseDateOnly(dueDate),today=startOfDay(now);if(due>=today)return"current";const days=dayDiff(due,today);if(days<=30)return"1-30";if(days<=60)return"31-60";if(days<=90)return"61-90";return"90+";}

export async function loadAccountsReceivable(supabase:SupabaseClient<Database>,companyId:string,now=new Date()):Promise<{data:AccountsReceivableData|null;error:string|null}>{
 const monthStart=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
 const [invoiceResult,customerResult,projectResult,paymentResult]=await Promise.all([
  supabase.from("invoices").select("id, invoice_number, title, customer_id, project_id, status, issue_date, due_date, total_amount, amount_paid").eq("company_id",companyId).is("archived_at",null).order("due_date",{ascending:true}),
  supabase.from("customers").select("id, first_name, last_name, company_name, customer_type").eq("company_id",companyId),
  supabase.from("projects").select("id, name").eq("company_id",companyId),
  supabase.from("invoice_payment_history").select("amount, payment_date, status").eq("company_id",companyId).eq("status","recorded").gte("payment_date",monthStart),
 ]);
 const error=invoiceResult.error||customerResult.error||projectResult.error||paymentResult.error;if(error)return{data:null,error:error.message};
 const customers=new Map((customerResult.data??[]).map(row=>[row.id,row]));const projects=new Map((projectResult.data??[]).map(row=>[row.id,row]));
 const invoices:AccountsReceivableInvoice[]=(invoiceResult.data??[]).filter(row=>!["draft","paid","void"].includes(row.status)).map(row=>{const balanceDue=Math.max(Number(row.total_amount||0)-Number(row.amount_paid||0),0);const bucket=resolveAgingBucket(row.due_date,now);const issued=row.issue_date?parseDateOnly(row.issue_date):startOfDay(now);return{id:row.id,invoiceNumber:row.invoice_number||"Unassigned",title:row.title,customerId:row.customer_id,customerName:displayCustomer(row.customer_id?customers.get(row.customer_id):undefined),projectId:row.project_id,projectName:row.project_id?projects.get(row.project_id)?.name||"Not linked":"Not linked",status:bucket==="current"?row.status:"overdue",issueDate:row.issue_date,dueDate:row.due_date,totalAmount:Number(row.total_amount||0),amountPaid:Number(row.amount_paid||0),balanceDue,daysOutstanding:dayDiff(issued,now),agingBucket:bucket};}).filter(row=>row.balanceDue>0);
 const aging:AccountsReceivableSummary["aging"]={current:0,"1-30":0,"31-60":0,"61-90":0,"90+":0};for(const invoice of invoices)aging[invoice.agingBucket]+=invoice.balanceDue;const totalReceivable=invoices.reduce((sum,row)=>sum+row.balanceDue,0),currentReceivable=aging.current,collectedThisMonth=(paymentResult.data??[]).reduce((sum,row)=>sum+Number(row.amount||0),0);
 return{data:{invoices,summary:{totalReceivable,overdueReceivable:totalReceivable-currentReceivable,currentReceivable,collectedThisMonth,overdueCount:invoices.filter(row=>row.agingBucket!=="current").length,openInvoiceCount:invoices.length,aging}},error:null};
}

export async function recordCustomerPayment(params:{supabase:SupabaseClient<Database>;companyId:string;userId:string;invoiceId:string;amount:number;paymentDate:string;method:string;referenceNumber?:string;notes?:string;}){
 if(!Number.isFinite(params.amount)||params.amount<=0)return{error:"Payment amount must be greater than zero."};if(!/^\d{4}-\d{2}-\d{2}$/.test(params.paymentDate))return{error:"A valid payment date is required."};
 const invoiceResult=await params.supabase.from("invoices").select("id, invoice_number, total_amount, amount_paid, status").eq("company_id",params.companyId).eq("id",params.invoiceId).maybeSingle();if(invoiceResult.error||!invoiceResult.data)return{error:invoiceResult.error?.message||"Invoice not found."};if(["draft","void","paid"].includes(invoiceResult.data.status))return{error:"Payments can only be recorded against an open issued invoice."};
 const total=Number(invoiceResult.data.total_amount||0),alreadyPaid=Number(invoiceResult.data.amount_paid||0),balance=Math.max(total-alreadyPaid,0);if(params.amount>balance+0.005)return{error:"Payment cannot exceed the invoice balance."};
 try{await authorizeInvoicePaymentCollection(params.supabase,{companyId:params.companyId,invoiceId:params.invoiceId,actorProfileId:params.userId,requestedAmount:params.amount,source:"accounts_receivable_manual_receipt"});}catch(error){return{error:error instanceof Error?error.message:"Payment compliance review is required."};}
 const nextPaid=Math.min(total,alreadyPaid+params.amount),isPaid=nextPaid>=total-0.005;
 const paymentResult=await params.supabase.from("invoice_payment_history").insert({company_id:params.companyId,invoice_id:params.invoiceId,payment_date:params.paymentDate,amount:params.amount,method:params.method.trim()||"manual",reference_number:params.referenceNumber?.trim()||null,status:"recorded",notes:params.notes?.trim()||null,created_by:params.userId}).select("id").single();if(paymentResult.error)return{error:paymentResult.error.message};
 const updateResult=await params.supabase.from("invoices").update({amount_paid:nextPaid,status:isPaid?"paid":"partially_paid",paid_date:isPaid?params.paymentDate:null,updated_by:params.userId}).eq("company_id",params.companyId).eq("id",params.invoiceId).eq("amount_paid",alreadyPaid).select("id").maybeSingle();if(updateResult.error||!updateResult.data){await params.supabase.from("invoice_payment_history").delete().eq("company_id",params.companyId).eq("id",paymentResult.data.id);return{error:updateResult.error?.message||"Invoice balance changed while recording the payment. Refresh and try again."};}
 const orion=createSupabaseOrionEventPublisher(params.supabase);await orion.publishEvent({company_id:params.companyId,actor_profile_id:params.userId,event_type:"payment.received",aggregate_type:"payment",aggregate_id:paymentResult.data.id,source_module:"payments",payload:{invoice_id:params.invoiceId,invoice_number:invoiceResult.data.invoice_number,amount:params.amount,payment_date:params.paymentDate,method:params.method,resulting_balance:Math.max(total-nextPaid,0),deep_link:`/invoices/${params.invoiceId}`},metadata:{workflow_name:"accounts_receivable",event_category:"finance",event_severity:"success",deep_link:`/invoices/${params.invoiceId}`}});
 if(isPaid)await orion.publishEvent({company_id:params.companyId,actor_profile_id:params.userId,event_type:"invoice.paid",aggregate_type:"invoice",aggregate_id:params.invoiceId,source_module:"invoices",payload:{invoice_id:params.invoiceId,amount_paid:nextPaid,paid_date:params.paymentDate,deep_link:`/invoices/${params.invoiceId}`},metadata:{workflow_name:"accounts_receivable",event_category:"finance",event_severity:"success",deep_link:`/invoices/${params.invoiceId}`}});
 return{error:null};
}
