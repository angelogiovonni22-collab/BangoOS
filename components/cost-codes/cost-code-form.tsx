import { Input, Select } from "@/components/ui";
import type { CostCodeFormInput, CostCodeParentOption } from "@/lib/cost-codes";

type CostCodeFormProps = {
  value: CostCodeFormInput;
  parentOptions: CostCodeParentOption[];
  onChange: <K extends keyof CostCodeFormInput>(key: K, nextValue: CostCodeFormInput[K]) => void;
  disabled?: boolean;
};

export function CostCodeForm({ value, parentOptions, onChange, disabled = false }: CostCodeFormProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Cost Code Profile</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Cost code" required>
            <Input value={value.code} onChange={(event) => onChange("code", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Status" required>
            <Select value={value.status} onChange={(event) => onChange("status", event.target.value as CostCodeFormInput["status"])} disabled={disabled}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Name" required className="md:col-span-2">
            <Input value={value.name} onChange={(event) => onChange("name", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <textarea
              rows={4}
              value={value.description}
              onChange={(event) => onChange("description", event.target.value)}
              disabled={disabled}
              className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Classification</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Division">
            <Input value={value.division} onChange={(event) => onChange("division", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Category">
            <Input value={value.category} onChange={(event) => onChange("category", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Trade">
            <Input value={value.trade} onChange={(event) => onChange("trade", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Parent cost code">
            <Select value={value.parent_cost_code_id} onChange={(event) => onChange("parent_cost_code_id", event.target.value)} disabled={disabled}>
              <option value="">No parent</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.code} - {option.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Defaults</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Default labor rate id">
            <Input value={value.default_labor_rate_id} onChange={(event) => onChange("default_labor_rate_id", event.target.value)} disabled={disabled} placeholder="UUID" />
          </Field>
          <Field label="Default material category id">
            <Input value={value.default_material_category_id} onChange={(event) => onChange("default_material_category_id", event.target.value)} disabled={disabled} placeholder="UUID" />
          </Field>
          <Field label="Default equipment category id">
            <Input value={value.default_equipment_category_id} onChange={(event) => onChange("default_equipment_category_id", event.target.value)} disabled={disabled} placeholder="UUID" />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Financial</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <Field label="Budget" required>
            <Input type="number" min="0" step="0.01" value={value.budget} onChange={(event) => onChange("budget", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Committed cost" required>
            <Input type="number" min="0" step="0.01" value={value.committed_cost} onChange={(event) => onChange("committed_cost", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Actual cost" required>
            <Input type="number" min="0" step="0.01" value={value.actual_cost} onChange={(event) => onChange("actual_cost", event.target.value)} disabled={disabled} required />
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
