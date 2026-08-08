import { Card, CardContent, CardHeader, CardTitle, FormField, Input, Select } from "@/components/ui";
import type { ReactNode } from "react";
import { INVOICE_STATUS_OPTIONS } from "@/lib/invoices/constants";
import type { InvoiceFormErrors, InvoiceFormValues } from "@/lib/invoices/types";

type Option = { value: string; label: string };

export function InvoiceInformationSection({
  values,
  errors,
  preparedByOptions,
  onFieldChange,
}: {
  values: InvoiceFormValues;
  errors: InvoiceFormErrors;
  preparedByOptions: Option[];
  onFieldChange: <K extends keyof InvoiceFormValues>(field: K, value: InvoiceFormValues[K]) => void;
}) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle>Invoice Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <Field label="Invoice Title" htmlFor="invoice-title" error={errors.title} required>
          <Input id="invoice-title" value={values.title} onChange={(event) => onFieldChange("title", event.target.value)} />
        </Field>

        <Field label="Invoice Number" htmlFor="invoice-number">
          <Input id="invoice-number" value={values.invoiceNumber} onChange={(event) => onFieldChange("invoiceNumber", event.target.value)} placeholder="INV-2026-0001" />
        </Field>

        <Field label="Issue Date" htmlFor="invoice-issue-date" error={errors.issueDate} required>
          <Input id="invoice-issue-date" type="date" value={values.issueDate} onChange={(event) => onFieldChange("issueDate", event.target.value)} />
        </Field>

        <Field label="Due Date" htmlFor="invoice-due-date" error={errors.dueDate} required>
          <Input id="invoice-due-date" type="date" value={values.dueDate} onChange={(event) => onFieldChange("dueDate", event.target.value)} />
        </Field>

        <Field label="Prepared By" htmlFor="invoice-prepared-by">
          <Select id="invoice-prepared-by" value={values.preparedBy} onChange={(event) => onFieldChange("preparedBy", event.target.value)}>
            <option value="">Unassigned</option>
            {preparedByOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="invoice-status" error={errors.status}>
          <Select id="invoice-status" value={values.status} onChange={(event) => onFieldChange("status", event.target.value as InvoiceFormValues["status"])}>
            {INVOICE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
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
    <FormField
      label={label}
      htmlFor={htmlFor}
      required={required}
      className={className}
      error={error}
      labelClassName="tracking-[0.01em]"
    >
      {children}
    </FormField>
  );
}
