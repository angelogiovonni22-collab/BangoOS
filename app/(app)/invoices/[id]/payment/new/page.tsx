"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, ErrorState, PageHeader, SkeletonLoader, getButtonClassName } from "@/components/ui";
import { recordCustomerPayment } from "@/lib/accounts-receivable/service";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function RecordCustomerPaymentPage() {
  const params = useParams<{ id?: string | string[] }>();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [invoice, setInvoice] = useState<{ invoice_number: string | null; title: string; total_amount: number; amount_paid: number; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("check");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!supabase || !invoiceId) {
        setError("Invoice not found.");
        setLoading(false);
        return;
      }
      const workspace = await resolveWorkspaceContext(supabase);
      if (!workspace.context) {
        setError(workspace.errorMessage || "Unable to resolve workspace.");
        setLoading(false);
        return;
      }
      const result = await supabase
        .from("invoices")
        .select("invoice_number, title, total_amount, amount_paid, status")
        .eq("company_id", workspace.context.companyId)
        .eq("id", invoiceId)
        .maybeSingle();
      if (result.error || !result.data) {
        setError(result.error?.message || "Invoice not found.");
        setLoading(false);
        return;
      }
      const balance = Math.max(Number(result.data.total_amount) - Number(result.data.amount_paid), 0);
      setCompanyId(workspace.context.companyId);
      setUserId(workspace.context.userId);
      setInvoice(result.data);
      setAmount(balance.toFixed(2));
      setLoading(false);
    };
    queueMicrotask(() => { void load(); });
  }, [supabase, invoiceId]);

  if (loading) return <SkeletonLoader className="h-80 w-full" />;
  if (error || !invoice || !invoiceId) return <ErrorState title="Unable to record payment" description={error || "Invoice not found."} />;

  const balance = Math.max(Number(invoice.total_amount) - Number(invoice.amount_paid), 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !invoiceId) return;
    setSaving(true);
    setError(null);
    const result = await recordCustomerPayment({
      supabase,
      companyId,
      userId,
      invoiceId,
      amount: Number(amount),
      paymentDate,
      method,
      referenceNumber,
      notes,
    });
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push(`/invoices/${invoiceId}`);
    router.refresh();
  }

  const inputClass = "mt-1 w-full rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] px-3 py-2.5 text-sm";

  return (
    <div className="container-content max-w-3xl space-y-6">
      <PageHeader
        compact
        eyebrow="ACCOUNTS RECEIVABLE"
        title="Record Customer Payment"
        description={`${invoice.invoice_number || "Invoice"} · ${invoice.title}`}
        secondaryActions={<Link href={`/invoices/${invoiceId}`} className={getButtonClassName({ variant: "secondary" })}>Cancel</Link>}
      />
      <Card variant="elevated">
        <CardHeader><CardTitle>Payment Details</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs uppercase text-[var(--bos-text-muted)]">Invoice Total</p><p className="font-bold">{usd.format(Number(invoice.total_amount))}</p></div>
            <div><p className="text-xs uppercase text-[var(--bos-text-muted)]">Paid</p><p className="font-bold">{usd.format(Number(invoice.amount_paid))}</p></div>
            <div><p className="text-xs uppercase text-[var(--bos-text-muted)]">Balance</p><p className="font-bold">{usd.format(balance)}</p></div>
          </div>
          <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-[var(--bos-text-secondary)]">
            Record only money that has already been received outside this screen. This workflow does not charge a card, debit a bank account, or initiate an ACH transfer.
          </div>
          {error && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</p>}
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <label className="text-sm font-semibold">Amount<input className={inputClass} type="number" min="0.01" max={balance} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <label className="text-sm font-semibold">Payment Date<input className={inputClass} type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
            <label className="text-sm font-semibold">Method<select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}><option value="check">Check</option><option value="ach">ACH / Bank Transfer</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
            <label className="text-sm font-semibold">Reference Number<input className={inputClass} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Check, ACH, or transaction ID" /></label>
            <label className="text-sm font-semibold sm:col-span-2">Notes<textarea className={inputClass} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional payment note" /></label>
            <div className="sm:col-span-2 flex justify-end"><Button type="submit" disabled={saving || balance <= 0}>{saving ? "Recording…" : "Record Payment"}</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
