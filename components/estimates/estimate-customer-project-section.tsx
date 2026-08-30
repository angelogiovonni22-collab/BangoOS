import { Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";
import type { EstimateFormErrors, EstimateFormValues } from "@/lib/estimates/types";
import type { EstimateProspectErrors, EstimateProspectValues } from "@/lib/estimates/prospect-service";

type CustomerSummary = {
  id: string;
  label: string;
  email: string | null;
  phone: string | null;
  billingAddress: string;
  customerType: string | null;
  state: string | null;
};

type ProjectSummary = {
  id: string;
  label: string;
  customerId: string | null;
};

const prospectControlClassName =
  "h-11 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-default)] px-3 text-sm text-[var(--color-text-primary)] shadow-sm outline-none transition-colors placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-500)]/20 disabled:cursor-not-allowed disabled:opacity-60";

export function EstimateCustomerProjectSection({
  values,
  errors,
  prospect,
  prospectErrors,
  customers,
  projects,
  onFieldChange,
  onProspectChange,
}: {
  values: EstimateFormValues;
  errors: EstimateFormErrors;
  prospect: EstimateProspectValues;
  prospectErrors: EstimateProspectErrors;
  customers: CustomerSummary[];
  projects: ProjectSummary[];
  onFieldChange: <K extends keyof EstimateFormValues>(field: K, value: EstimateFormValues[K]) => void;
  onProspectChange: <K extends keyof EstimateProspectValues>(field: K, value: EstimateProspectValues[K]) => void;
}) {
  const selectedCustomer = customers.find((customer) => customer.id === values.customerId) || null;
  const isNewProspect = !values.customerId;

  function handleProjectChange(projectId: string) {
    const project = projects.find((item) => item.id === projectId) || null;
    onFieldChange("projectId", projectId);
    if (project?.customerId && !values.customerId) onFieldChange("customerId", project.customerId);
  }

  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle>Customer / Prospect and Project</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
          For a new lead, enter their information here. B.O.S. will keep them as a prospect until they accept the estimate, then automatically create or match the Customer and create the Project.
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label htmlFor="estimate-customer" className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Customer Source</span>
            <Select
              id="estimate-customer"
              value={values.customerId}
              onChange={(event) => {
                onFieldChange("customerId", event.target.value);
                if (!event.target.value) onFieldChange("projectId", "");
              }}
            >
              <option value="">New prospective customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}
            </Select>
            {errors.customerId ? <span className="text-xs text-[var(--color-danger-700)]">{errors.customerId}</span> : null}
          </label>

          <label htmlFor="estimate-project" className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Existing Project (Optional)</span>
            <Select id="estimate-project" value={values.projectId} onChange={(event) => handleProjectChange(event.target.value)} disabled={isNewProspect}>
              <option value="">No linked project</option>
              {projects.filter((project) => !values.customerId || project.customerId === values.customerId).map((project) => (
                <option key={project.id} value={project.id}>{project.label}</option>
              ))}
            </Select>
          </label>
        </div>

        {selectedCustomer ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Existing Customer Details</h3>
            <div className="mt-3 grid gap-3 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
              <DetailRow label="Name" value={selectedCustomer.label} />
              <DetailRow label="Email" value={selectedCustomer.email || "Not provided"} />
              <DetailRow label="Phone" value={selectedCustomer.phone || "Not provided"} />
              <DetailRow label="Billing Address" value={selectedCustomer.billingAddress || "Not provided"} />
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border-default)] p-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Prospective Customer Details</h3>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">These details travel with the estimate and become the Customer + Project information only after acceptance.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ProspectSelect label="Customer Type" fieldName="customer-type" value={prospect.customerType} onChange={(value) => onProspectChange("customerType", value as EstimateProspectValues["customerType"])}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </ProspectSelect>
              <ProspectInput label="Company Name (Optional)" fieldName="company-name" value={prospect.companyName} onChange={(value) => onProspectChange("companyName", value)} />
              <ProspectInput label="First Name" fieldName="first-name" value={prospect.firstName} error={prospectErrors.firstName} required onChange={(value) => onProspectChange("firstName", value)} />
              <ProspectInput label="Last Name" fieldName="last-name" value={prospect.lastName} error={prospectErrors.lastName} required onChange={(value) => onProspectChange("lastName", value)} />
              <ProspectInput label="Email" fieldName="email" type="email" value={prospect.email} error={prospectErrors.email} required onChange={(value) => onProspectChange("email", value)} />
              <ProspectInput label="Phone" fieldName="phone" type="tel" value={prospect.phone} error={prospectErrors.phone} required onChange={(value) => onProspectChange("phone", value)} />
              <div className="md:col-span-2"><ProspectInput label="Address" fieldName="address-line-1" value={prospect.addressLine1} error={prospectErrors.addressLine1} required onChange={(value) => onProspectChange("addressLine1", value)} /></div>
              <div className="md:col-span-2"><ProspectInput label="Address Line 2 (Optional)" fieldName="address-line-2" value={prospect.addressLine2} onChange={(value) => onProspectChange("addressLine2", value)} /></div>
              <ProspectInput label="City" fieldName="city" value={prospect.city} error={prospectErrors.city} required onChange={(value) => onProspectChange("city", value)} />
              <ProspectInput label="State" fieldName="state" value={prospect.state} error={prospectErrors.state} required onChange={(value) => onProspectChange("state", value)} />
              <ProspectInput label="ZIP / Postal Code" fieldName="postal-code" value={prospect.postalCode} error={prospectErrors.postalCode} required onChange={(value) => onProspectChange("postalCode", value)} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProspectInput({ label, fieldName, value, error, required = false, type = "text", onChange }: { label: string; fieldName: string; value: string; error?: string; required?: boolean; type?: string; onChange: (value: string) => void }) {
  const id = `estimate-prospect-${fieldName}`;
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{label}{required ? <span className="text-[var(--color-danger-700)]"> *</span> : null}</span>
      <input
        id={id}
        name={`bos-new-prospect-${fieldName}`}
        type={type}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        aria-invalid={Boolean(error)}
        className={prospectControlClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="text-xs text-[var(--color-danger-700)]">{error}</span> : null}
    </label>
  );
}

function ProspectSelect({ label, fieldName, value, onChange, children }: { label: string; fieldName: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  const id = `estimate-prospect-${fieldName}`;
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{label}</span>
      <select
        id={id}
        name={`bos-new-prospect-${fieldName}`}
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        className={`${prospectControlClassName} appearance-auto pr-9`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{label}</p><p className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</p></div>;
}
