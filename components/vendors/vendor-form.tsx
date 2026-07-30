import { Input, Select } from "@/components/ui";
import type { VendorFormInput } from "@/lib/vendors";

type VendorFormProps = {
  value: VendorFormInput;
  onChange: <K extends keyof VendorFormInput>(key: K, nextValue: VendorFormInput[K]) => void;
  disabled?: boolean;
};

export function VendorForm({ value, onChange, disabled = false }: VendorFormProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Vendor Profile</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Vendor code" required>
            <Input value={value.vendor_code} onChange={(event) => onChange("vendor_code", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Status" required>
            <Select value={value.status} onChange={(event) => onChange("status", event.target.value as VendorFormInput["status"])} disabled={disabled}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="probation">Probation</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Legal company name" required>
            <Input value={value.company_name} onChange={(event) => onChange("company_name", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Display name" required>
            <Input value={value.display_name} onChange={(event) => onChange("display_name", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Preferred vendor" className="md:col-span-2">
            <label className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={value.preferred_vendor}
                onChange={(event) => onChange("preferred_vendor", event.target.checked)}
                disabled={disabled}
              />
              Mark this vendor as preferred
            </label>
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Business</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Website">
            <Input value={value.website} onChange={(event) => onChange("website", event.target.value)} disabled={disabled} placeholder="https://vendor.example" />
          </Field>
          <Field label="Tax ID">
            <Input value={value.tax_id} onChange={(event) => onChange("tax_id", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Account number">
            <Input value={value.account_number} onChange={(event) => onChange("account_number", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Payment terms">
            <Select value={value.payment_terms} onChange={(event) => onChange("payment_terms", event.target.value)} disabled={disabled}>
              <option value="due_on_receipt">Due on receipt</option>
              <option value="net_7">Net 7</option>
              <option value="net_15">Net 15</option>
              <option value="net_30">Net 30</option>
              <option value="net_45">Net 45</option>
              <option value="net_60">Net 60</option>
            </Select>
          </Field>
          <Field label="Credit limit">
            <Input type="number" min="0" step="0.01" value={value.credit_limit} onChange={(event) => onChange("credit_limit", event.target.value)} disabled={disabled} />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Addresses</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Billing address" className="md:col-span-2">
            <Input value={value.billing_address} onChange={(event) => onChange("billing_address", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Shipping address" className="md:col-span-2">
            <Input value={value.shipping_address} onChange={(event) => onChange("shipping_address", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="City">
            <Input value={value.city} onChange={(event) => onChange("city", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="State">
            <Input value={value.state} onChange={(event) => onChange("state", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Postal code">
            <Input value={value.postal_code} onChange={(event) => onChange("postal_code", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Country">
            <Input value={value.country} onChange={(event) => onChange("country", event.target.value)} disabled={disabled} />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Primary Contact</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="First name">
            <Input value={value.first_name} onChange={(event) => onChange("first_name", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Last name">
            <Input value={value.last_name} onChange={(event) => onChange("last_name", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Title">
            <Input value={value.title} onChange={(event) => onChange("title", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Email">
            <Input type="email" value={value.email} onChange={(event) => onChange("email", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Phone">
            <Input value={value.phone} onChange={(event) => onChange("phone", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Mobile">
            <Input value={value.mobile} onChange={(event) => onChange("mobile", event.target.value)} disabled={disabled} />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Performance</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Quality rating (0-5)">
            <Input type="number" min="0" max="5" step="0.1" value={value.quality_rating} onChange={(event) => onChange("quality_rating", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Delivery rating (0-5)">
            <Input type="number" min="0" max="5" step="0.1" value={value.delivery_rating} onChange={(event) => onChange("delivery_rating", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <textarea
              rows={5}
              value={value.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              disabled={disabled}
              className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-semibold text-[var(--color-text-primary)]">
        {label}
        {required ? <span className="ml-1 text-[var(--color-danger-700)]">*</span> : null}
      </label>
      {children}
    </div>
  );
}
