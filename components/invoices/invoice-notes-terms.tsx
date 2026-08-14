import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { InvoiceFormValues } from "@/lib/invoices/types";

export function InvoiceNotesTermsSection({
  values,
  onFieldChange,
}: {
  values: InvoiceFormValues;
  onFieldChange: <K extends keyof InvoiceFormValues>(field: K, value: InvoiceFormValues[K]) => void;
}) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle>Notes and Payment Terms</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <TextareaField label="Invoice Notes" value={values.notes} onChange={(value) => onFieldChange("notes", value)} helper="Visible on internal and print views." />
        <TextareaField label="Payment Terms" value={values.paymentTerms} onChange={(value) => onFieldChange("paymentTerms", value)} helper="Displayed to the customer on invoice print views." />
      </CardContent>
    </Card>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
      />
      {helper ? <span className="text-xs text-[var(--color-text-muted)]">{helper}</span> : null}
    </label>
  );
}
