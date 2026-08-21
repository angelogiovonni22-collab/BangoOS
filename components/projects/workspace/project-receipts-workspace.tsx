"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, CircleAlert, FileImage, LoaderCircle, Plus, ReceiptText, RotateCcw, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

type ReceiptItem = {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  category: string;
  cost_code_id?: string | null;
  extraction_confidence?: number | null;
  confidence?: number | null;
};

type ProjectReceipt = {
  id: string;
  vendor_name: string | null;
  receipt_number: string | null;
  purchased_at: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  payment_method: string | null;
  status: "processing" | "needs_review" | "approved" | "rejected" | "failed";
  extraction_confidence: number | null;
  duplicate_of: string | null;
  created_at: string;
  previewUrl: string | null;
  items: ReceiptItem[];
};

type ReceiptFinancials = {
  revisedContractValue: number;
  revisedBudget: number;
  actualCost: number;
  approvedReceiptSpend: number;
  remainingContractDollars: number;
};

type ReceiptPayload = {
  receipts: ProjectReceipt[];
  financials: ReceiptFinancials;
  createdReceiptId?: string;
  error?: string;
};

type ReceiptDraft = {
  id: string;
  vendorName: string;
  receiptNumber: string;
  purchasedAt: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paymentMethod: string;
  items: ReceiptItem[];
  duplicateOf: string | null;
  previewUrl: string | null;
  confidence: number | null;
};

type Props = {
  projectId: string;
  onApprovedSpendChange?: (amount: number) => void;
};

const CATEGORIES = ["materials", "tools", "equipment", "safety", "consumables", "other"] as const;
const inputClass = "h-10 w-full rounded-[9px] border border-[var(--bos-border-light)] bg-white px-3 text-sm font-medium text-[var(--bos-text-strong-on-light)] outline-none transition focus:border-[var(--color-primary-400)] focus:ring-2 focus:ring-[var(--color-primary-100)]";

export function ProjectReceiptsWorkspace({ projectId, onApprovedSpendChange }: Props) {
  const [payload, setPayload] = useState<ReceiptPayload | null>(null);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateConfirmation, setDuplicateConfirmation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applyPayload = useCallback((next: ReceiptPayload) => {
    setPayload(next);
    onApprovedSpendChange?.(Number(next.financials?.approvedReceiptSpend || 0));
  }, [onApprovedSpendChange]);

  const loadReceipts = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/receipts`, { cache: "no-store" });
      const data = await response.json() as ReceiptPayload;
      if (!response.ok) throw new Error(data.error || "Unable to load receipts.");
      applyPayload(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load receipts.");
    } finally {
      setIsLoading(false);
    }
  }, [applyPayload, projectId]);

  useEffect(() => { void loadReceipts(); }, [loadReceipts]);

  const approvedReceipts = useMemo(() => payload?.receipts.filter((receipt) => receipt.status === "approved") ?? [], [payload]);
  const pendingReceipts = useMemo(() => payload?.receipts.filter((receipt) => receipt.status === "needs_review") ?? [], [payload]);

  const uploadReceipt = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setDraft(null);
    setDuplicateConfirmation(false);
    setIsUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/projects/${projectId}/receipts`, { method: "POST", body: form });
      const data = await response.json() as ReceiptPayload;
      if (!response.ok) throw new Error(data.error || "Unable to read receipt.");
      applyPayload(data);
      const created = data.receipts.find((receipt) => receipt.id === data.createdReceiptId)
        || data.receipts.find((receipt) => receipt.status === "needs_review");
      if (created) setDraft(toDraft(created));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload receipt.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const patchItem = (index: number, patch: Partial<ReceiptItem>) => setDraft((current) => current ? {
    ...current,
    items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  } : current);

  const actOnReceipt = async (action: "approve" | "reject") => {
    if (!draft) return;
    const total = parseMoney(draft.totalAmount);
    if (action === "approve" && total === null) {
      setError("Enter the receipt total before adding it to project costs.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/receipts`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          receiptId: draft.id,
          vendorName: draft.vendorName,
          receiptNumber: draft.receiptNumber,
          purchasedAt: draft.purchasedAt || null,
          subtotal: parseMoney(draft.subtotal),
          taxAmount: parseMoney(draft.taxAmount),
          totalAmount: total,
          paymentMethod: draft.paymentMethod,
          items: draft.items,
          confirmDuplicate: duplicateConfirmation,
        }),
      });
      const data = await response.json() as ReceiptPayload;
      if (!response.ok) throw new Error(data.error || "Unable to update receipt.");
      applyPayload(data);
      setDraft(null);
      setDuplicateConfirmation(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update receipt.");
    } finally {
      setIsSaving(false);
    }
  };

  // financials.actualCost is already receipt-aware through the canonical financial-reporting service.
  const liveActualCost = Number(payload?.financials.actualCost || 0);
  const remainingBudget = Math.max(Number(payload?.financials.revisedBudget || 0) - liveActualCost, 0);
  const remainingContract = Math.max(Number(payload?.financials.revisedContractValue || 0) - liveActualCost, 0);

  return (
    <Card as="section" variant="elevated" className="overflow-hidden rounded-[16px] border border-[var(--bos-border-light)]">
      <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(135deg,var(--color-surface-subtle),var(--bos-bg-workspace-card))]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-section-title"><ReceiptText size={20} aria-hidden="true" />Receipts & Real-Time Job Costing</CardTitle>
            <p className="mt-1 text-sm text-[var(--bos-text-medium-on-light)]">Photograph a receipt. B.O.S. reads it, organizes the purchase, checks duplicates, and updates job costs after approval.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void loadReceipts()} disabled={isLoading || isUploading || isSaving}><RotateCcw size={16} aria-hidden="true" />Refresh</Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading || isSaving}>{isUploading ? <LoaderCircle className="animate-spin" size={16} /> : <Camera size={16} />}{isUploading ? "Reading receipt…" : "Add Receipt"}</Button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => void uploadReceipt(event.target.files?.[0] || null)} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4">
        {error ? <div className="flex items-start gap-2 rounded-[12px] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2.5 text-sm text-[var(--color-danger-800)]"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Contract Value" value={money(payload?.financials.revisedContractValue || 0)} context="Customer contract stays unchanged" />
          <Metric label="Approved Receipt Spend" value={money(payload?.financials.approvedReceiptSpend || 0)} context={`${approvedReceipts.length} approved receipt${approvedReceipts.length === 1 ? "" : "s"}`} />
          <Metric label="Actual Cost" value={money(liveActualCost)} context="All tracked actual job costs" />
          <Metric label="Remaining Cost Budget" value={money(remainingBudget)} context="Budget less actual cost" />
          <Metric label="Remaining Contract Dollars" value={money(remainingContract)} context="Contract less actual cost" />
        </div>

        {isLoading ? <div className="flex min-h-24 items-center justify-center text-sm text-[var(--bos-text-medium-on-light)]"><LoaderCircle className="mr-2 animate-spin" size={18} />Loading project receipts…</div> : null}

        {draft ? (
          <section className="rounded-[14px] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]/35 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-base font-bold text-[var(--bos-text-strong-on-light)]">Review Receipt Before Posting Cost</h3><p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">B.O.S. prefilled what it could read. Correct anything necessary, then approve it.</p></div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--bos-text-medium-on-light)]">{draft.confidence === null ? "Manual review" : `${Math.round(draft.confidence * 100)}% read confidence`}</span>
            </div>

            {draft.duplicateOf ? <div className="mb-4 rounded-[10px] border border-[var(--color-warning-300)] bg-[var(--color-warning-50)] p-3"><p className="text-sm font-bold text-[var(--color-warning-900)]">Possible duplicate detected</p><p className="mt-1 text-xs text-[var(--color-warning-800)]">Another receipt has the same vendor, date, and total. B.O.S. will not post this cost unless you confirm it is a separate purchase.</p><label className="mt-2 flex items-center gap-2 text-xs font-semibold text-[var(--color-warning-900)]"><input type="checkbox" checked={duplicateConfirmation} onChange={(event) => setDuplicateConfirmation(event.target.checked)} />I verified this is a separate purchase.</label></div> : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Vendor"><input className={inputClass} value={draft.vendorName} onChange={(e) => setDraft({ ...draft, vendorName: e.target.value })} placeholder="Lowe's" /></Field>
              <Field label="Purchase date"><input className={inputClass} type="date" value={draft.purchasedAt} onChange={(e) => setDraft({ ...draft, purchasedAt: e.target.value })} /></Field>
              <Field label="Receipt #"><input className={inputClass} value={draft.receiptNumber} onChange={(e) => setDraft({ ...draft, receiptNumber: e.target.value })} placeholder="Optional" /></Field>
              <Field label="Payment method"><input className={inputClass} value={draft.paymentMethod} onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })} placeholder="Card / cash / account" /></Field>
              <Field label="Subtotal"><input className={inputClass} type="number" min="0" step="0.01" value={draft.subtotal} onChange={(e) => setDraft({ ...draft, subtotal: e.target.value })} /></Field>
              <Field label="Tax"><input className={inputClass} type="number" min="0" step="0.01" value={draft.taxAmount} onChange={(e) => setDraft({ ...draft, taxAmount: e.target.value })} /></Field>
              <Field label="Receipt total"><input className={inputClass} type="number" min="0" step="0.01" value={draft.totalAmount} onChange={(e) => setDraft({ ...draft, totalAmount: e.target.value })} placeholder="Required" /></Field>
              <Field label="Preview">{draft.previewUrl ? <a className="flex h-10 items-center justify-center rounded-[9px] border border-[var(--bos-border-light)] bg-white text-sm font-semibold text-[var(--color-primary-700)] hover:underline" href={draft.previewUrl} target="_blank" rel="noreferrer">Open receipt image</a> : <div className="flex h-10 items-center text-sm text-[var(--bos-text-medium-on-light)]">Preview unavailable</div>}</Field>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">Purchased Items</h4><Button variant="secondary" size="sm" onClick={() => setDraft({ ...draft, items: [...draft.items, { description: "", quantity: 1, unit_price: null, line_total: 0, category: "materials" }] })}><Plus size={14} />Add item</Button></div>
              <div className="space-y-2">
                {draft.items.length === 0 ? <p className="rounded-[10px] border border-dashed border-[var(--bos-border-light)] bg-white/70 px-3 py-3 text-xs text-[var(--bos-text-medium-on-light)]">No line items were confidently read. You can add them manually or approve the receipt total only.</p> : null}
                {draft.items.map((item, index) => <div key={`${draft.id}-${index}`} className="grid gap-2 rounded-[10px] border border-[var(--bos-border-light)] bg-white p-2.5 md:grid-cols-[minmax(180px,1.6fr)_90px_120px_120px_150px_40px]">
                  <input aria-label={`Item ${index + 1} description`} className={inputClass} value={item.description} onChange={(e) => patchItem(index, { description: e.target.value })} placeholder="2x4 lumber" />
                  <input aria-label={`Item ${index + 1} quantity`} className={inputClass} type="number" min="0.001" step="0.001" value={item.quantity} onChange={(e) => patchItem(index, { quantity: Number(e.target.value) || 1 })} />
                  <input aria-label={`Item ${index + 1} unit price`} className={inputClass} type="number" min="0" step="0.01" value={item.unit_price ?? ""} onChange={(e) => patchItem(index, { unit_price: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Unit $" />
                  <input aria-label={`Item ${index + 1} line total`} className={inputClass} type="number" min="0" step="0.01" value={item.line_total} onChange={(e) => patchItem(index, { line_total: Number(e.target.value) || 0 })} placeholder="Total $" />
                  <select aria-label={`Item ${index + 1} category`} className={inputClass} value={item.category} onChange={(e) => patchItem(index, { category: e.target.value })}>{CATEGORIES.map((category) => <option key={category} value={category}>{title(category)}</option>)}</select>
                  <button type="button" aria-label={`Remove item ${index + 1}`} className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={15} /></button>
                </div>)}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => setDraft(null)} disabled={isSaving}>Cancel</Button><Button variant="secondary" onClick={() => void actOnReceipt("reject")} disabled={isSaving}>Reject receipt</Button><Button onClick={() => void actOnReceipt("approve")} disabled={isSaving || Boolean(draft.duplicateOf && !duplicateConfirmation)}>{isSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}{isSaving ? "Posting cost…" : "Approve & Add to Job Cost"}</Button></div>
          </section>
        ) : null}

        {!draft && pendingReceipts.length > 0 ? <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">Needs Review</h3><span className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{pendingReceipts.length} pending</span></div><div className="grid gap-2 lg:grid-cols-2">{pendingReceipts.map((receipt) => <button key={receipt.id} type="button" onClick={() => { setError(null); setDuplicateConfirmation(false); setDraft(toDraft(receipt)); }} className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-3 text-left"><div className="min-w-0"><p className="truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{receipt.vendor_name || "Receipt needs details"}</p><p className="mt-0.5 text-xs text-[var(--bos-text-medium-on-light)]">{receipt.purchased_at || date(receipt.created_at)} · {money(Number(receipt.total_amount || 0))}</p></div><span className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-[var(--color-warning-800)]">Review</span></button>)}</div></div> : null}

        <div>
          <div className="mb-2"><h3 className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">Approved Project Receipts</h3><p className="text-xs text-[var(--bos-text-medium-on-light)]">Only approved receipts affect live project costs.</p></div>
          {approvedReceipts.length === 0 ? <div className="flex min-h-24 flex-col items-center justify-center rounded-[12px] border border-dashed border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-4 text-center"><FileImage size={22} className="mb-2 text-[var(--bos-text-medium-on-light)]" /><p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">No approved receipts yet</p><p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">Use Add Receipt while you are on the job to capture a material purchase.</p></div> : <div className="overflow-x-auto rounded-[12px] border border-[var(--bos-border-light)]"><table className="min-w-full border-collapse text-sm"><thead><tr className="border-b border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] text-left text-xs uppercase tracking-[0.07em] text-[var(--bos-text-medium-on-light)]"><th className="px-3 py-2.5">Vendor</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Receipt</th><th className="px-3 py-2.5">Items</th><th className="px-3 py-2.5 text-right">Total</th></tr></thead><tbody>{approvedReceipts.map((receipt) => <tr key={receipt.id} className="border-b border-[var(--bos-border-light)] last:border-0"><td className="px-3 py-2.5 font-semibold text-[var(--bos-text-strong-on-light)]">{receipt.previewUrl ? <a href={receipt.previewUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">{receipt.vendor_name || "Unknown vendor"}</a> : receipt.vendor_name || "Unknown vendor"}</td><td className="px-3 py-2.5 text-[var(--bos-text-medium-on-light)]">{receipt.purchased_at || "—"}</td><td className="px-3 py-2.5 text-[var(--bos-text-medium-on-light)]">{receipt.receipt_number || "—"}</td><td className="px-3 py-2.5 text-[var(--bos-text-medium-on-light)]">{receipt.items.length}</td><td className="px-3 py-2.5 text-right font-bold text-[var(--bos-text-strong-on-light)]">{money(Number(receipt.total_amount || 0))}</td></tr>)}</tbody></table></div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[var(--bos-text-medium-on-light)]">{label}</span>{children}</label>; }
function Metric({ label, value, context }: { label: string; value: string; context: string }) { return <article className="rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3"><p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 text-xl font-bold text-[var(--bos-text-strong-on-light)]">{value}</p><p className="mt-0.5 text-[11px] text-[var(--bos-text-medium-on-light)]">{context}</p></article>; }
function toDraft(receipt: ProjectReceipt): ReceiptDraft { return { id: receipt.id, vendorName: receipt.vendor_name || "", receiptNumber: receipt.receipt_number || "", purchasedAt: receipt.purchased_at || "", subtotal: inputMoney(receipt.subtotal), taxAmount: inputMoney(receipt.tax_amount), totalAmount: inputMoney(receipt.total_amount), paymentMethod: receipt.payment_method || "", items: receipt.items.map((item) => ({ ...item })), duplicateOf: receipt.duplicate_of, previewUrl: receipt.previewUrl, confidence: receipt.extraction_confidence }; }
function inputMoney(value: number | null) { return value === null || !Number.isFinite(Number(value)) ? "" : Number(value).toFixed(2); }
function parseMoney(value: string): number | null { if (!value.trim()) return null; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? Math.round((parsed + Number.EPSILON) * 100) / 100 : null; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0); }
function date(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Unknown date" : parsed.toLocaleDateString("en-US"); }
function title(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
