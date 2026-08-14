import { FormField, Input, Select, Textarea } from "@/components/ui";
import type { MaterialFormInput, VendorOption } from "@/lib/materials";

type MaterialFormProps = {
  value: MaterialFormInput;
  vendorOptions: VendorOption[];
  onChange: <K extends keyof MaterialFormInput>(key: K, nextValue: MaterialFormInput[K]) => void;
  disabled?: boolean;
};

export function MaterialForm({ value, vendorOptions, onChange, disabled = false }: MaterialFormProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Material Profile</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Material code" required>
            <Input value={value.material_code} onChange={(event) => onChange("material_code", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Status" required>
            <Select value={value.status} onChange={(event) => onChange("status", event.target.value as MaterialFormInput["status"])} disabled={disabled}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discontinued">Discontinued</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Name" required className="md:col-span-2">
            <Input value={value.name} onChange={(event) => onChange("name", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <Textarea
              rows={4}
              value={value.description}
              onChange={(event) => onChange("description", event.target.value)}
              disabled={disabled}
            />
          </Field>
          <Field label="Category">
            <Input value={value.category} onChange={(event) => onChange("category", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Trade">
            <Input value={value.trade} onChange={(event) => onChange("trade", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Unit of measure" required>
            <Input value={value.unit_of_measure} onChange={(event) => onChange("unit_of_measure", event.target.value)} disabled={disabled} required />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Pricing</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Standard cost" required>
            <Input type="number" min="0" step="0.0001" value={value.standard_cost} onChange={(event) => onChange("standard_cost", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Average cost" required>
            <Input type="number" min="0" step="0.0001" value={value.average_cost} onChange={(event) => onChange("average_cost", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Last purchase cost" required>
            <Input type="number" min="0" step="0.0001" value={value.last_purchase_cost} onChange={(event) => onChange("last_purchase_cost", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Markup percent" required>
            <Input type="number" min="0" step="0.0001" value={value.markup_percent} onChange={(event) => onChange("markup_percent", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Suggested sell price" required>
            <Input type="number" min="0" step="0.0001" value={value.suggested_sell_price} onChange={(event) => onChange("suggested_sell_price", event.target.value)} disabled={disabled} required />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Vendor</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Preferred vendor">
            <Select value={value.preferred_vendor_id} onChange={(event) => onChange("preferred_vendor_id", event.target.value)} disabled={disabled}>
              <option value="">None</option>
              {vendorOptions.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.displayName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Lead time (days)">
            <Input type="number" min="0" step="1" value={value.lead_time_days} onChange={(event) => onChange("lead_time_days", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Manufacturer">
            <Input value={value.manufacturer} onChange={(event) => onChange("manufacturer", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Manufacturer part number">
            <Input value={value.manufacturer_part_number} onChange={(event) => onChange("manufacturer_part_number", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Vendor part number">
            <Input value={value.vendor_part_number} onChange={(event) => onChange("vendor_part_number", event.target.value)} disabled={disabled} />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Inventory</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Track inventory" className="md:col-span-2 lg:col-span-3">
            <label className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={value.track_inventory}
                onChange={(event) => onChange("track_inventory", event.target.checked)}
                disabled={disabled}
              />
              Enable stock tracking for this material
            </label>
          </Field>
          <Field label="Current stock" required>
            <Input type="number" min="0" step="0.001" value={value.current_stock} onChange={(event) => onChange("current_stock", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Reorder point" required>
            <Input type="number" min="0" step="0.001" value={value.reorder_point} onChange={(event) => onChange("reorder_point", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Reorder quantity" required>
            <Input type="number" min="0" step="0.001" value={value.reorder_quantity} onChange={(event) => onChange("reorder_quantity", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Warehouse location">
            <Input value={value.warehouse_location} onChange={(event) => onChange("warehouse_location", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Bin location">
            <Input value={value.bin_location} onChange={(event) => onChange("bin_location", event.target.value)} disabled={disabled} />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Physical</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Weight">
            <Input type="number" min="0" step="0.0001" value={value.weight} onChange={(event) => onChange("weight", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Width">
            <Input type="number" min="0" step="0.0001" value={value.width} onChange={(event) => onChange("width", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Height">
            <Input type="number" min="0" step="0.0001" value={value.height} onChange={(event) => onChange("height", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Length">
            <Input type="number" min="0" step="0.0001" value={value.length} onChange={(event) => onChange("length", event.target.value)} disabled={disabled} />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Analytics</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Last purchase date">
            <Input type="date" value={value.last_purchase_date} onChange={(event) => onChange("last_purchase_date", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea
              rows={5}
              value={value.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              disabled={disabled}
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
  return <FormField label={label} required={required} className={className}>{children}</FormField>;
}
