import { Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";
import type { ReactNode } from "react";
import { ESTIMATE_STATUS_OPTIONS } from "@/lib/estimates/constants";
import type { EstimateFormErrors, EstimateFormValues } from "@/lib/estimates/types";

type Option = { value: string; label: string };

export function EstimateInformationSection({
  values,
  errors,
  preparedByOptions,
  onFieldChange,
}: {
  values: EstimateFormValues;
  errors: EstimateFormErrors;
  preparedByOptions: Option[];
  onFieldChange: <K extends keyof EstimateFormValues>(field: K, value: EstimateFormValues[K]) => void;
}) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle>Estimate Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <Field label="Estimate Name" htmlFor="estimate-title" error={errors.title} required>
          <Input id="estimate-title" value={values.title} onChange={(event) => onFieldChange("title", event.target.value)} />
        </Field>

        <Field label="Estimate Number" htmlFor="estimate-number">
          <Input id="estimate-number" value={values.estimateNumber} onChange={(event) => onFieldChange("estimateNumber", event.target.value)} placeholder="EST-2026-0001" />
        </Field>

        <Field label="Estimate Date" htmlFor="estimate-date" error={errors.issueDate} required>
          <Input id="estimate-date" type="date" value={values.issueDate} onChange={(event) => onFieldChange("issueDate", event.target.value)} />
        </Field>

        <Field label="Expiration Date" htmlFor="expiration-date" error={errors.expirationDate}>
          <Input id="expiration-date" type="date" value={values.expirationDate} onChange={(event) => onFieldChange("expirationDate", event.target.value)} />
        </Field>

        <Field label="Prepared By" htmlFor="prepared-by">
          <Select id="prepared-by" value={values.preparedBy} onChange={(event) => onFieldChange("preparedBy", event.target.value)}>
            <option value="">Unassigned</option>
            {preparedByOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="estimate-status" error={errors.status}>
          <Select id="estimate-status" value={values.status} onChange={(event) => onFieldChange("status", event.target.value as EstimateFormValues["status"])}>
            {ESTIMATE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Scope Summary" htmlFor="estimate-description" className="md:col-span-2">
          <textarea
            id="estimate-description"
            value={values.description}
            onChange={(event) => onFieldChange("description", event.target.value)}
            rows={4}
            className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
          />
        </Field>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
  error,
  required,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className={["space-y-2", className || ""].join(" ")}>
      <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">
        {label} {required ? <span className="text-[var(--color-danger-700)]">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-[var(--color-danger-700)]">{error}</span> : null}
    </label>
  );
}
