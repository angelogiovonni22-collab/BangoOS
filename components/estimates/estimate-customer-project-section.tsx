import { Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";
import type { EstimateFormErrors, EstimateFormValues } from "@/lib/estimates/types";

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

export function EstimateCustomerProjectSection({
  values,
  errors,
  customers,
  projects,
  onFieldChange,
}: {
  values: EstimateFormValues;
  errors: EstimateFormErrors;
  customers: CustomerSummary[];
  projects: ProjectSummary[];
  onFieldChange: <K extends keyof EstimateFormValues>(field: K, value: EstimateFormValues[K]) => void;
}) {
  const selectedCustomer = customers.find((customer) => customer.id === values.customerId) || null;

  function handleProjectChange(projectId: string) {
    const project = projects.find((item) => item.id === projectId) || null;

    onFieldChange("projectId", projectId);

    if (project?.customerId && !values.customerId) {
      onFieldChange("customerId", project.customerId);
    }
  }

  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle>Customer and Project Linking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <label htmlFor="estimate-customer" className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">
              Customer <span className="text-[var(--color-danger-700)]">*</span>
            </span>
            <Select id="estimate-customer" value={values.customerId} onChange={(event) => onFieldChange("customerId", event.target.value)}>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.label}</option>
              ))}
            </Select>
            {errors.customerId ? <span className="text-xs text-[var(--color-danger-700)]">{errors.customerId}</span> : null}
          </label>

          <label htmlFor="estimate-project" className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Project (Optional)</span>
            <Select id="estimate-project" value={values.projectId} onChange={(event) => handleProjectChange(event.target.value)}>
              <option value="">No linked project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.label}</option>
              ))}
            </Select>
          </label>
        </div>

        {selectedCustomer ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Customer Details</h3>
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
