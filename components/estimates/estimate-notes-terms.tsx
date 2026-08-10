import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { EstimateFormValues } from "@/lib/estimates/types";

export function EstimateNotesTermsSection({ values, onFieldChange }: { values: EstimateFormValues; onFieldChange: <K extends keyof EstimateFormValues>(field: K, value: EstimateFormValues[K]) => void; }) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader><CardTitle>Notes and Terms</CardTitle></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <TextareaField id="estimate-internal-notes" label="Internal Notes" value={values.internalNotes} onChange={(value) => onFieldChange("internalNotes", value)} helper="Only visible internally." tone="internal" />
        <TextareaField id="estimate-customer-notes" label="Customer Notes" value={values.customerNotes} onChange={(value) => onFieldChange("customerNotes", value)} helper="Visible to customer-facing outputs." />
        <TextareaField id="estimate-scope-inclusions" label="Scope Inclusions" value={values.scopeInclusions} onChange={(value) => onFieldChange("scopeInclusions", value)} />
        <TextareaField id="estimate-scope-exclusions" label="Scope Exclusions" value={values.scopeExclusions} onChange={(value) => onFieldChange("scopeExclusions", value)} />
        <TextareaField id="estimate-terms" label="Terms and Conditions" value={values.terms} onChange={(value) => onFieldChange("terms", value)} className="md:col-span-2" />
        <TextareaField id="estimate-payment-terms" label="Payment Terms" value={values.paymentTerms} onChange={(value) => onFieldChange("paymentTerms", value)} className="md:col-span-2" />
      </CardContent>
    </Card>
  );
}

function TextareaField({ id, label, value, onChange, helper, className, tone }: { id: string; label: string; value: string; onChange: (value: string) => void; helper?: string; className?: string; tone?: "internal"; }) {
  return (
    <label htmlFor={id} className={["space-y-2", className || ""].join(" ")}>
      <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{label}</span>
      <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={4} className={["w-full rounded-[var(--radius-lg)] border px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]", tone === "internal" ? "border-[var(--color-warning-300)] bg-[var(--color-warning-50)]" : "border-[var(--color-border-strong)] bg-[var(--color-surface-card)]"].join(" ")} />
      {helper ? <span className="text-xs text-[var(--color-text-muted)]">{helper}</span> : null}
    </label>
  );
}
