import { Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";
import { formatUsd } from "@/lib/estimates/calculations";
import type { EstimateFormValues, EstimateTotals } from "@/lib/estimates/types";

export function EstimateTotalsSection({
  totals,
  values,
  localeTag,
  onFieldChange,
}: {
  totals: EstimateTotals;
  values: EstimateFormValues;
  localeTag: string;
  onFieldChange: <K extends keyof EstimateFormValues>(field: K, value: EstimateFormValues[K]) => void;
}) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader><CardTitle>Estimate Totals</CardTitle></CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Discount Type</span>
            <Select id="estimate-discount-type" value={values.discountType} onChange={(event) => onFieldChange("discountType", event.target.value as EstimateFormValues["discountType"])}>
              <option value="none">None</option><option value="percentage">Percentage</option><option value="fixed">Fixed</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Discount Value</span>
            <Input id="estimate-discount-value" type="number" min={0} step="0.01" value={values.discountValue} onChange={(event) => onFieldChange("discountValue", event.target.value)} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Tax %</span>
            <Input id="estimate-tax-rate" type="number" min={0} step="0.01" value={values.taxRatePercent} onChange={(event) => onFieldChange("taxRatePercent", event.target.value)} />
          </label>
          <label className="space-y-2 text-sm md:col-span-3">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Additional Fee</span>
            <Input id="estimate-additional-fee" type="number" min={0} step="0.01" value={values.additionalFee} onChange={(event) => onFieldChange("additionalFee", event.target.value)} />
          </label>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
          <SummaryRow label="Direct Cost Subtotal" value={formatUsd(totals.directCostSubtotal, localeTag)} />
          <SummaryRow label="Line-item Markup" value={formatUsd(totals.markupTotal, localeTag)} />
          <SummaryRow label="Estimate Subtotal" value={formatUsd(totals.estimateSubtotal, localeTag)} />
          <SummaryRow label="Discount" value={`-${formatUsd(totals.discountTotal, localeTag)}`} />
          <SummaryRow label="Tax" value={formatUsd(totals.taxTotal, localeTag)} />
          <SummaryRow label="Additional Fee" value={formatUsd(totals.additionalFee, localeTag)} />
          <SummaryRow label="Grand Total" value={formatUsd(totals.grandTotal, localeTag)} emphasized />
        </div>
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
