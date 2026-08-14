import { Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";
import type { InvoiceFormErrors, InvoiceFormValues } from "@/lib/invoices/types";

type CustomerSummary = {
  id: string;
  label: string;
  email: string | null;
  phone: string | null;
  billingAddress: string;
};

type ProjectSummary = {
  id: string;
  label: string;
  customerId: string | null;
};

type EstimateSummary = {
  id: string;
  label: string;
  customerId: string | null;
  projectId: string | null;
};

export function InvoiceCustomerProjectSection({
  values,
  errors,
  customers,
  projects,
  estimates,
  onFieldChange,
}: {
  values: InvoiceFormValues;
  errors: InvoiceFormErrors;
  customers: CustomerSummary[];
  projects: ProjectSummary[];
  estimates: EstimateSummary[];
  onFieldChange: <K extends keyof InvoiceFormValues>(field: K, value: InvoiceFormValues[K]) => void;
}) {
  const selectedCustomer = customers.find((customer) => customer.id === values.customerId) || null;

  function handleProjectChange(projectId: string) {
    const project = projects.find((item) => item.id === projectId) || null;

    onFieldChange("projectId", projectId);

    if (project?.customerId && !values.customerId) {
      onFieldChange("customerId", project.customerId);
    }
  }

  function handleEstimateChange(estimateId: string) {
    const estimate = estimates.find((item) => item.id === estimateId) || null;
    onFieldChange("estimateId", estimateId);

    if (estimate?.customerId) {
      onFieldChange("customerId", estimate.customerId);
    }

    if (estimate?.projectId) {
      onFieldChange("projectId", estimate.projectId);
    }
  }

  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle>Customer and Project</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 md:grid-cols-3">
          <label htmlFor="invoice-customer" className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">
              Customer <span className="text-[var(--color-danger-700)]">*</span>
            </span>
            <Select id="invoice-customer" value={values.customerId} onChange={(event) => onFieldChange("customerId", event.target.value)}>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.label}</option>
              ))}
            </Select>
            {errors.customerId ? <span className="text-xs text-[var(--color-danger-700)]">{errors.customerId}</span> : null}
          </label>

          <label htmlFor="invoice-project" className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Project (Optional)</span>
            <Select id="invoice-project" value={values.projectId} onChange={(event) => handleProjectChange(event.target.value)}>
              <option value="">No linked project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.label}</option>
              ))}
            </Select>
          </label>

          <label htmlFor="invoice-estimate" className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Source Estimate (Optional)</span>
            <Select id="invoice-estimate" value={values.estimateId} onChange={(event) => handleEstimateChange(event.target.value)}>
              <option value="">No source estimate</option>
              {estimates.map((estimate) => (
                <option key={estimate.id} value={estimate.id}>{estimate.label}</option>
              ))}
            </Select>
          </label>
        </div>

        {selectedCustomer ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Customer Billing Details</h3>
            <div className="mt-3 grid gap-3 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
              <DetailRow label="Name" value={selectedCustomer.label} />
              <DetailRow label="Email" value={selectedCustomer.email || "Not provided"} />
              <DetailRow label="Phone" value={selectedCustomer.phone || "Not provided"} />
              <DetailRow label="Billing Address" value={selectedCustomer.billingAddress || "Not provided"} />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
