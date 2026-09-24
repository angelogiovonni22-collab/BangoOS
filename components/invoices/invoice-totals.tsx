import { Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";
import { formatUsd } from "@/lib/invoices/calculations";
import type { InvoiceFormValues, InvoiceTotals } from "@/lib/invoices/types";

export function InvoiceTotalsSection({
  totals,
  values,
  localeTag,
  onFieldChange,
  showPaymentSummary = false,
  amountPaid = 0,
  paymentSummary,
}: {
  totals: InvoiceTotals;
  values: InvoiceFormValues;
  localeTag: string;
  onFieldChange: <K extends keyof InvoiceFormValues>(field: K, value: InvoiceFormValues[K]) => void;
  showPaymentSummary?: boolean;
  amountPaid?: number;
  paymentSummary?: { count: number; latestAmount: number | null; latestDate: string | null; latestMethod: string | null };
}) {
  const balanceDue = Math.max(totals.grandTotal - amountPaid, 0);
  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle>Totals</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Discount Type</span>
            <Select value={values.discountType} onChange={(event) => onFieldChange("discountType", event.target.value as InvoiceFormValues["discountType"])}>
              <option value="none">None</option>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </Select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Discount Value</span>
            <Input type="number" min={0} step="0.01" value={values.discountValue} onChange={(event) => onFieldChange("discountValue", event.target.value)} />
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Tax %</span>
            <Input type="number" min={0} step="0.01" value={values.taxRatePercent} onChange={(event) => onFieldChange("taxRatePercent", event.target.value)} />
          </label>

          <label className="space-y-2 text-sm md:col-span-3">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Additional Fee</span>
            <Input type="number" min={0} step="0.01" value={values.additionalFee} onChange={(event) => onFieldChange("additionalFee", event.target.value)} />
          </label>
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
          <SummaryRow label="Subtotal" value={formatUsd(totals.subtotal, localeTag)} />
          <SummaryRow label="Discount" value={`-${formatUsd(totals.discountTotal, localeTag)}`} />
          <SummaryRow label="Taxable Subtotal" value={formatUsd(totals.taxableSubtotal, localeTag)} />
          <SummaryRow label="Tax" value={formatUsd(totals.taxTotal, localeTag)} />
          <SummaryRow label="Additional Fee" value={formatUsd(totals.additionalFee, localeTag)} />
          <SummaryRow label="Grand Total" value={formatUsd(totals.grandTotal, localeTag)} emphasized />
          {showPaymentSummary ? <SummaryRow label="Paid to Date" value={formatUsd(amountPaid, localeTag)} /> : null}
          {showPaymentSummary ? <SummaryRow label="Balance Due" value={formatUsd(balanceDue, localeTag)} emphasized /> : null}
        </div>
        {showPaymentSummary ? (
          <div className="lg:col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">Payment Summary</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {paymentSummary?.count ? `${paymentSummary.count} payment${paymentSummary.count === 1 ? "" : "s"} recorded on this invoice.` : "No payments recorded yet."}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Remaining Balance</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{formatUsd(balanceDue, localeTag)}</p>
              </div>
            </div>
            {paymentSummary?.latestAmount !== null && paymentSummary?.latestAmount !== undefined ? (
              <div className="mt-4 grid gap-3 border-t border-[var(--color-border-subtle)] pt-4 sm:grid-cols-3">
                <PaymentDetail label="Latest Payment" value={formatUsd(paymentSummary.latestAmount, localeTag)} />
                <PaymentDetail label="Payment Date" value={paymentSummary.latestDate || "Not set"} />
                <PaymentDetail label="Method" value={paymentSummary.latestMethod || "Manual"} />
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={["flex items-center justify-between py-1.5", emphasized ? "border-t border-[var(--color-border-subtle)] mt-2 pt-3" : ""].join(" ")}>
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className={["text-sm", emphasized ? "font-bold text-[var(--color-text-primary)]" : "font-semibold text-[var(--color-text-primary)]"].join(" ")}>{value}</span>
    </div>
  );
}


function PaymentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
