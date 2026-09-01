"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, PageHeader, getButtonClassName } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";

type BillRow = { id: string; vendor_id: string; project_id: string | null; bill_number: string; vendor_invoice_number: string | null; bill_date: string; due_date: string | null; status: string; subtotal_amount: number; tax_amount: number; retainage_amount: number; total_amount: number; amount_paid: number; balance_due: number; memo: string | null; approved_at: string | null; approved_by: string | null };
type LineRow = { id: string; description: string; quantity: number; unit_cost: number; line_amount: number; category: string };
type PaymentRow = { id: string; payment_date: string; amount: number; payment_method: string | null; reference_number: string | null; notes: string | null; created_at: string };
type VendorRow = { id: string; display_name: string | null; company_name: string | null };
type ProjectRow = { id: string; name: string | null; project_number: string | null };

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  insert: (values: Record<string, unknown>) => QueryBuilder;
  update: (values: Record<string, unknown>) => QueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
  then: PromiseLike<{ data: unknown; error: { message?: string } | null }>["then"];
};
type LooseClient = { from: (table: string) => QueryBuilder };

const AP_WRITE_ROLES = new Set(["owner", "administrator", "operations_manager", "office_manager", "accountant"]);

export default function VendorBillDetailPage() {
  const params = useParams<{ billId?: string | string[] }>();
  const billId = Array.isArray(params.billId) ? params.billId[0] : params.billId;
  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [bill, setBill] = useState<BillRow | null>(null);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [vendorName, setVendorName] = useState("Vendor");
  const [projectName, setProjectName] = useState("Company overhead");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("check");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !billId) { setErrorMessage("Unable to resolve vendor bill."); setIsLoading(false); return; }
    setIsLoading(true);
    setErrorMessage(null);
    const resolved = await resolveWorkspaceContext(supabase);
    if (!resolved.context) { setErrorMessage(resolved.errorMessage || "Unable to load workspace."); setIsLoading(false); return; }
    const db = supabase as unknown as LooseClient;
    const billResult = await db.from("vendor_bills").select("id,vendor_id,project_id,bill_number,vendor_invoice_number,bill_date,due_date,status,subtotal_amount,tax_amount,retainage_amount,total_amount,amount_paid,balance_due,memo,approved_at,approved_by").eq("company_id", resolved.context.companyId).eq("id", billId).maybeSingle();
    if (billResult.error || !billResult.data) { setErrorMessage(billResult.error?.message || "Vendor bill not found."); setIsLoading(false); return; }
    const loadedBill = billResult.data as BillRow;
    const [lineResult, paymentResult, vendorResult, projectResult] = await Promise.all([
      db.from("vendor_bill_line_items").select("id,description,quantity,unit_cost,line_amount,category").eq("company_id", resolved.context.companyId).eq("vendor_bill_id", billId),
      db.from("vendor_bill_payments").select("id,payment_date,amount,payment_method,reference_number,notes,created_at").eq("company_id", resolved.context.companyId).eq("vendor_bill_id", billId).order("payment_date", { ascending: false }),
      db.from("vendors").select("id,display_name,company_name").eq("company_id", resolved.context.companyId).eq("id", loadedBill.vendor_id).maybeSingle(),
      loadedBill.project_id ? db.from("projects").select("id,name,project_number").eq("company_id", resolved.context.companyId).eq("id", loadedBill.project_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (lineResult.error || paymentResult.error) { setErrorMessage(lineResult.error?.message || paymentResult.error?.message || "Unable to load bill activity."); setIsLoading(false); return; }
    const vendor = vendorResult.data as VendorRow | null;
    const project = projectResult.data as ProjectRow | null;
    setWorkspace(resolved.context);
    setBill(loadedBill);
    setLines((Array.isArray(lineResult.data) ? lineResult.data : []) as LineRow[]);
    setPayments((Array.isArray(paymentResult.data) ? paymentResult.data : []) as PaymentRow[]);
    setVendorName(vendor?.display_name || vendor?.company_name || "Vendor");
    setProjectName(project?.name || project?.project_number || (loadedBill.project_id ? "Project" : "Company overhead"));
    setPaymentAmount(loadedBill.balance_due > 0 ? String(loadedBill.balance_due) : "");
    setIsLoading(false);
  }, [billId, supabase]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const canManage = Boolean(workspace && AP_WRITE_ROLES.has((workspace.role || "").toLowerCase()));

  const approve = async () => {
    if (!supabase || !workspace || !bill || !canManage || !["draft", "submitted", "disputed"].includes(bill.status)) return;
    setIsSaving(true); setErrorMessage(null);
    const db = supabase as unknown as LooseClient;
    const result = await db.from("vendor_bills").update({ status: "approved", approved_at: new Date().toISOString(), approved_by: workspace.userId, updated_by: workspace.userId }).eq("company_id", workspace.companyId).eq("id", bill.id);
    if (result.error) setErrorMessage(result.error.message || "Unable to approve vendor bill.");
    setIsSaving(false); await load();
  };

  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !workspace || !bill || !canManage) return;
    const amount = Number(paymentAmount);
    if (!["approved", "partially_paid"].includes(bill.status)) { setErrorMessage("Approve the bill before recording payment."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setErrorMessage("Enter a positive payment amount."); return; }
    if (amount > bill.balance_due + 0.0001) { setErrorMessage(`Payment cannot exceed the remaining balance of ${currency2(bill.balance_due)}.`); return; }
    setIsSaving(true); setErrorMessage(null);
    const db = supabase as unknown as LooseClient;
    const result = await db.from("vendor_bill_payments").insert({ company_id: workspace.companyId, vendor_bill_id: bill.id, payment_date: paymentDate, amount, payment_method: paymentMethod || null, reference_number: referenceNumber.trim() || null, notes: paymentNotes.trim() || null, created_by: workspace.userId }).select("id").maybeSingle();
    if (result.error) { setErrorMessage(result.error.message || "Unable to record payment."); setIsSaving(false); return; }
    setReferenceNumber(""); setPaymentNotes(""); setIsSaving(false); await load();
  };

  if (isLoading) return <div className="container-content py-10 text-sm text-[var(--bos-text-secondary)]">Loading vendor bill…</div>;

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader compact eyebrow="FINANCE · ACCOUNTS PAYABLE" title={bill ? `${bill.bill_number} · ${vendorName}` : "Vendor Bill"} description={`${projectName}${bill?.vendor_invoice_number ? ` · Vendor invoice ${bill.vendor_invoice_number}` : ""}`} primaryAction={<Link href="/invoices/accounts-payable" className={getButtonClassName({ size: "md" })}>Back to AP</Link>} />
      {errorMessage ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{errorMessage}</div> : null}
      {bill ? <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Status" value={bill.status.replaceAll("_", " ")} detail={bill.approved_at ? `Approved ${new Date(bill.approved_at).toLocaleDateString()}` : "Approval pending"} /><Metric label="Bill Total" value={currency2(bill.total_amount)} detail={`Bill date ${bill.bill_date}`} /><Metric label="Paid" value={currency2(bill.amount_paid)} detail={`${payments.length} payment${payments.length === 1 ? "" : "s"}`} /><Metric label="Balance Due" value={currency2(bill.balance_due)} detail={bill.due_date ? `Due ${bill.due_date}` : "No due date"} danger={bill.balance_due > 0 && Boolean(bill.due_date && bill.due_date < new Date().toISOString().slice(0,10))} /></section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Bill Cost Lines</h2>{canManage && ["draft","submitted","disputed"].includes(bill.status) ? <Button size="sm" disabled={isSaving} onClick={() => void approve()}>{isSaving ? "Saving…" : "Approve Bill"}</Button> : null}</div><div className="mt-4 space-y-2">{lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-[var(--bos-bg-control)] p-3"><div><p className="font-semibold">{line.description}</p><p className="text-xs capitalize text-[var(--bos-text-muted)]">{line.category.replaceAll("_", " ")} · {line.quantity} × {currency2(line.unit_cost)}</p></div><p className="font-bold">{currency2(line.line_amount)}</p></div>)}</div></div>

          <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><h2 className="text-lg font-semibold">Payment Control</h2><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">Payments are rolled into the bill by the database trigger; overpayment is blocked at the database boundary.</p>{canManage && bill.balance_due > 0 ? <form onSubmit={recordPayment} className="mt-4 space-y-3"><input className="bos-input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required /><input className="bos-input" type="number" min="0.01" max={bill.balance_due} step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Payment amount" required /><select className="bos-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="check">Check</option><option value="ach">ACH</option><option value="wire">Wire</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option></select><input className="bos-input" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Check / ACH reference" /><textarea className="bos-input min-h-20" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Payment notes" /><Button type="submit" size="md" disabled={isSaving || !["approved","partially_paid"].includes(bill.status)}>{bill.status === "draft" || bill.status === "submitted" || bill.status === "disputed" ? "Approve Before Payment" : isSaving ? "Recording…" : "Record Payment"}</Button></form> : bill.balance_due <= 0 ? <p className="mt-4 text-sm font-semibold text-emerald-400">Paid in full.</p> : null}</div>
        </section>

        <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><h2 className="text-lg font-semibold">Payment History</h2>{payments.length === 0 ? <p className="mt-3 text-sm text-[var(--bos-text-secondary)]">No payments recorded.</p> : <div className="mt-3 divide-y divide-[var(--bos-border-subtle)]">{payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{payment.payment_date} · {(payment.payment_method || "payment").toUpperCase()}</p><p className="text-xs text-[var(--bos-text-muted)]">{payment.reference_number || payment.notes || "No reference"}</p></div><p className="font-bold">{currency2(payment.amount)}</p></div>)}</div>}</section>
      </> : null}
    </div>
  );
}

function Metric({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) { return <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bos-text-muted)]">{label}</p><p className={`mt-2 text-xl font-bold capitalize ${danger ? "text-red-400" : ""}`}>{value}</p><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">{detail}</p></div>; }
function currency2(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0); }
