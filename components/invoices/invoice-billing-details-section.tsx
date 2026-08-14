import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { InvoiceFormValues } from "@/lib/invoices/types";

export function InvoiceBillingDetailsSection({
  values,
  onFieldChange,
}: {
  values: InvoiceFormValues;
  onFieldChange: <K extends keyof InvoiceFormValues>(field: K, value: InvoiceFormValues[K]) => void;
}) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle>Billing Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <label className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Invoice Description</span>
          <textarea
            value={values.description}
            onChange={(event) => onFieldChange("description", event.target.value)}
            rows={4}
            className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            placeholder="Add billing details, project context, or scope notes shown on the invoice."
          />
        </label>
      </CardContent>
    </Card>
  );
}
