import type { SupabaseClient } from "@supabase/supabase-js";

export type BankingAccount = { id:string; name:string; mask:string|null; accountType:string; currentBalance:number|null; availableBalance:number|null; status:string; balanceAsOf:string|null };
export type BankingTransaction = { id:string; bankAccountId:string; transactionDate:string; amount:number; direction:"credit"|"debit"; merchantName:string|null; description:string; reconciliationStatus:string };
export type ReconciliationSuggestion = { transactionId:string; sourceType:"invoice_payment"|"vendor_bill_payment"|"project_receipt"; sourceId:string; amount:number; confidence:number; reason:string };
export type CashFlowDay = { date:string; inflow:number; outflow:number; net:number; projectedBalance:number };
export type BankingWorkspace = { accounts:BankingAccount[]; transactions:BankingTransaction[]; unmatchedCount:number; matchedCount:number; cashBalance:number; forecast:CashFlowDay[] };

export type ProviderBankTransaction = {
  providerTransactionId:string;
  transactionDate:string;
  postedAt?:string|null;
  amount:number;
  direction:"credit"|"debit";
  merchantName?:string|null;
  description:string;
  category?:string|null;
  pending?:boolean;
  rawMetadata?:Record<string, unknown>;
};

type MatchCandidate = { id:string; date:string; amount:number; label:string; sourceType:ReconciliationSuggestion["sourceType"] };

function dateDiffDays(a:string,b:string){ return Math.abs(Math.round((new Date(`${a}T00:00:00Z`).getTime()-new Date(`${b}T00:00:00Z`).getTime())/86_400_000)); }
export function scoreReconciliationCandidate(transaction:{transactionDate:string;amount:number;description:string},candidate:{date:string;amount:number;label:string}){
  const amountDelta=Math.abs(transaction.amount-candidate.amount);
  if(amountDelta>Math.max(1,transaction.amount*0.02)) return 0;
  const days=dateDiffDays(transaction.transactionDate,candidate.date);
  if(days>7) return 0;
  const amountScore=amountDelta<=0.01?0.72:0.55;
  const dateScore=Math.max(0,0.22-days*0.03);
  const txText=transaction.description.toLowerCase(); const label=candidate.label.toLowerCase();
  const textScore=label && (txText.includes(label)||label.includes(txText))?0.06:0;
  return Math.min(0.99,Number((amountScore+dateScore+textScore).toFixed(4)));
}

export async function ingestBankTransactions(params:{supabase:SupabaseClient;companyId:string;bankAccountId:string;provider:string;transactions:ProviderBankTransaction[]}){
  if(!params.transactions.length) return { inserted:0, error:null as string|null };
  const rows=params.transactions.map(tx=>({company_id:params.companyId,bank_account_id:params.bankAccountId,provider:params.provider,provider_transaction_id:tx.providerTransactionId,transaction_date:tx.transactionDate,posted_at:tx.postedAt??null,amount:Math.abs(tx.amount),direction:tx.direction,merchant_name:tx.merchantName??null,description:tx.description,category:tx.category??null,pending:Boolean(tx.pending),raw_metadata:tx.rawMetadata??{}}));
  const result=await params.supabase.from("bank_transactions").upsert(rows,{onConflict:"company_id,provider,provider_transaction_id",ignoreDuplicates:false}).select("id");
  return { inserted:result.data?.length??0,error:result.error?.message??null };
}

export async function suggestReconciliationMatches(supabase:SupabaseClient,companyId:string){
  const [txResult,invoicePayments,vendorPayments,receipts]=await Promise.all([
    supabase.from("bank_transactions").select("id, transaction_date, amount, direction, description").eq("company_id",companyId).in("reconciliation_status",["unmatched","suggested"]).eq("pending",false).order("transaction_date",{ascending:false}).limit(250),
    supabase.from("invoice_payment_history").select("id, payment_date, amount, reference_number").eq("company_id",companyId).eq("status","recorded"),
    supabase.from("vendor_bill_payments").select("id, payment_date, amount, reference_number").eq("company_id",companyId),
    supabase.from("project_receipts").select("id, purchased_at, total_amount, vendor_name, status").eq("company_id",companyId).neq("status","duplicate"),
  ]);
  const error=txResult.error||invoicePayments.error||vendorPayments.error||receipts.error; if(error) return {count:0,error:error.message};
  const credits:MatchCandidate[]=(invoicePayments.data??[]).map(row=>({id:row.id,date:row.payment_date,amount:Number(row.amount||0),label:row.reference_number||"",sourceType:"invoice_payment"}));
  const debits:MatchCandidate[]=[...(vendorPayments.data??[]).map(row=>({id:row.id,date:row.payment_date,amount:Number(row.amount||0),label:row.reference_number||"",sourceType:"vendor_bill_payment" as const})),...(receipts.data??[]).filter(row=>row.purchased_at).map(row=>({id:row.id,date:row.purchased_at as string,amount:Number(row.total_amount||0),label:row.vendor_name||"",sourceType:"project_receipt" as const}))];
  const suggestions: Array<{company_id:string;bank_transaction_id:string;source_type:string;source_id:string;matched_amount:number;match_status:string;confidence:number;match_reason:string}> = [];
  for(const tx of txResult.data??[]){ const pool=tx.direction==="credit"?credits:debits; let best:{candidate:MatchCandidate;score:number}|null=null; for(const candidate of pool){const score=scoreReconciliationCandidate({transactionDate:tx.transaction_date,amount:Number(tx.amount||0),description:tx.description},{date:candidate.date,amount:candidate.amount,label:candidate.label});if(score>=0.7&&(!best||score>best.score)) best={candidate,score};} if(best) suggestions.push({company_id:companyId,bank_transaction_id:tx.id,source_type:best.candidate.sourceType,source_id:best.candidate.id,matched_amount:best.candidate.amount,match_status:"suggested",confidence:best.score,match_reason:"Amount/date heuristic; confirmation required."}); }
  if(!suggestions.length) return {count:0,error:null};
  const insert=await supabase.from("bank_reconciliation_matches").upsert(suggestions,{onConflict:"bank_transaction_id,source_type,source_id",ignoreDuplicates:true}).select("id");
  return {count:insert.data?.length??0,error:insert.error?.message??null};
}

export async function confirmReconciliationMatch(supabase:SupabaseClient,companyId:string,matchId:string,userId:string){
  const result=await supabase.from("bank_reconciliation_matches").update({match_status:"confirmed",matched_by:userId,matched_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("company_id",companyId).eq("id",matchId).eq("match_status","suggested").select("id").maybeSingle();
  return {error:result.error?.message??(!result.data?"Reconciliation match is no longer available.":null)};
}

export async function loadBankingWorkspace(supabase:SupabaseClient,companyId:string,days=60):Promise<{data:BankingWorkspace|null;error:string|null}>{
  const today=new Date(); const start=today.toISOString().slice(0,10); const end=new Date(today.getTime()+(days-1)*86_400_000).toISOString().slice(0,10);
  const [accountsResult,transactionsResult,invoicesResult,billsResult,adjustmentsResult]=await Promise.all([
    supabase.from("bank_accounts").select("id,name,mask,account_type,current_balance,available_balance,status,balance_as_of,include_in_cash_forecast").eq("company_id",companyId).order("name"),
    supabase.from("bank_transactions").select("id,bank_account_id,transaction_date,amount,direction,merchant_name,description,reconciliation_status").eq("company_id",companyId).order("transaction_date",{ascending:false}).limit(200),
    supabase.from("invoices").select("due_date,total_amount,amount_paid,status").eq("company_id",companyId).is("archived_at",null).gte("due_date",start).lte("due_date",end),
    supabase.from("vendor_bills").select("due_date,balance_due,status").eq("company_id",companyId).gte("due_date",start).lte("due_date",end),
    supabase.from("cash_flow_forecast_adjustments").select("forecast_date,direction,amount,confidence,status").eq("company_id",companyId).eq("status","active").gte("forecast_date",start).lte("forecast_date",end),
  ]);
  const error=accountsResult.error||transactionsResult.error||invoicesResult.error||billsResult.error||adjustmentsResult.error; if(error) return {data:null,error:error.message};
  const accounts:BankingAccount[]=(accountsResult.data??[]).map(row=>({id:row.id,name:row.name,mask:row.mask,accountType:row.account_type,currentBalance:row.current_balance==null?null:Number(row.current_balance),availableBalance:row.available_balance==null?null:Number(row.available_balance),status:row.status,balanceAsOf:row.balance_as_of}));
  const transactions:BankingTransaction[]=(transactionsResult.data??[]).map(row=>({id:row.id,bankAccountId:row.bank_account_id,transactionDate:row.transaction_date,amount:Number(row.amount||0),direction:row.direction as "credit"|"debit",merchantName:row.merchant_name,description:row.description,reconciliationStatus:row.reconciliation_status}));
  let projectedBalance=(accountsResult.data??[]).filter(row=>row.include_in_cash_forecast&&row.status==="active").reduce((sum,row)=>sum+Number(row.current_balance||0),0); const cashBalance=projectedBalance;
  const flows=new Map<string,{inflow:number;outflow:number}>(); const add=(date:string|undefined|null,key:"inflow"|"outflow",amount:number)=>{if(!date||date<start||date>end||amount<=0)return;const item=flows.get(date)??{inflow:0,outflow:0};item[key]+=amount;flows.set(date,item);};
  for(const row of invoicesResult.data??[]){if(!["paid","void","draft"].includes(row.status))add(row.due_date,"inflow",Math.max(Number(row.total_amount||0)-Number(row.amount_paid||0),0));}
  for(const row of billsResult.data??[]){if(!["paid","void"].includes(row.status))add(row.due_date,"outflow",Math.max(Number(row.balance_due||0),0));}
  for(const row of adjustmentsResult.data??[]){add(row.forecast_date,row.direction as "inflow"|"outflow",Number(row.amount||0)*Number(row.confidence??1));}
  const forecast:CashFlowDay[]=[]; for(let i=0;i<days;i++){const date=new Date(today.getFullYear(),today.getMonth(),today.getDate()+i).toISOString().slice(0,10);const flow=flows.get(date)??{inflow:0,outflow:0};const net=flow.inflow-flow.outflow;projectedBalance+=net;forecast.push({date,inflow:flow.inflow,outflow:flow.outflow,net,projectedBalance});}
  return {data:{accounts,transactions,unmatchedCount:transactions.filter(row=>row.reconciliationStatus!=="matched"&&row.reconciliationStatus!=="excluded").length,matchedCount:transactions.filter(row=>row.reconciliationStatus==="matched").length,cashBalance,forecast},error:null};
}
