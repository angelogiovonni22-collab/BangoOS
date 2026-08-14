import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, FormField, Input, Select } from "@/components/ui";
import { ConversionPreview } from "./conversion-preview";
import {
  UNIT_CATEGORIES,
  UNIT_MEASUREMENT_SYSTEMS,
  UNIT_TYPES,
  type UnitFormValues,
  type UnitOfMeasureRow,
} from "@/lib/units-of-measure";

type UnitFormProps = {
  value: UnitFormValues;
  baseUnitOptions: UnitOfMeasureRow[];
  onChange: <K extends keyof UnitFormValues>(key: K, nextValue: UnitFormValues[K]) => void;
  disabled?: boolean;
};

export function UnitForm({ value, baseUnitOptions, onChange, disabled = false }: UnitFormProps) {
  const [exampleQuantity, setExampleQuantity] = useState("5");

  const selectedBaseUnit = useMemo(
    () => baseUnitOptions.find((unit) => unit.id === value.base_unit_id) || null,
    [baseUnitOptions, value.base_unit_id],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Unit Definition Guidance</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Company units are scoped to your company and can reference either system units or your company units in the same category.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">1. Basic Information</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Code" required>
            <Input
              value={value.code}
              onChange={(event) => onChange("code", event.target.value.toUpperCase())}
              disabled={disabled}
              maxLength={25}
              required
            />
          </Field>

          <Field label="Name" required>
            <Input value={value.name} onChange={(event) => onChange("name", event.target.value)} disabled={disabled} required />
          </Field>

          <Field label="Plural Name">
            <Input value={value.plural_name} onChange={(event) => onChange("plural_name", event.target.value)} disabled={disabled} />
          </Field>

          <Field label="Symbol">
            <Input value={value.symbol} onChange={(event) => onChange("symbol", event.target.value)} disabled={disabled} maxLength={25} />
          </Field>

          <Field label="Description" className="md:col-span-2">
            <textarea
              rows={3}
              value={value.description}
              onChange={(event) => onChange("description", event.target.value)}
              disabled={disabled}
              className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">2. Classification</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <Field label="Category" required>
            <Select value={value.category} onChange={(event) => onChange("category", event.target.value as UnitFormValues["category"])} disabled={disabled}>
              {UNIT_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </Field>

          <Field label="Measurement System" required>
            <Select
              value={value.measurement_system}
              onChange={(event) => onChange("measurement_system", event.target.value as UnitFormValues["measurement_system"])}
              disabled={disabled}
            >
              {UNIT_MEASUREMENT_SYSTEMS.map((system) => (
                <option key={system} value={system}>{system}</option>
              ))}
            </Select>
          </Field>

          <Field label="Unit Type" required>
            <Select value={value.unit_type} onChange={(event) => onChange("unit_type", event.target.value as UnitFormValues["unit_type"])} disabled={disabled}>
              {UNIT_TYPES.map((unitType) => (
                <option key={unitType} value={unitType}>{unitType}</option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">3. Quantity Behavior</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Decimal Precision" required>
            <Input
              type="number"
              min="0"
              max="8"
              step="1"
              value={value.decimal_precision}
              onChange={(event) => onChange("decimal_precision", event.target.value)}
              disabled={disabled}
              required
            />
          </Field>

          <Field label="Allow Fractional Quantity">
            <label className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={value.allow_fractional_quantity}
                onChange={(event) => onChange("allow_fractional_quantity", event.target.checked)}
                disabled={disabled}
              />
              Fractional quantities allowed
            </label>
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">4. Conversion</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Base Unit">
            <Select value={value.base_unit_id} onChange={(event) => onChange("base_unit_id", event.target.value)} disabled={disabled}>
              <option value="">No base unit</option>
              {baseUnitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} - {unit.name} ({unit.is_system ? "System" : "Company"})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Conversion Factor">
            <Input
              type="number"
              min="0"
              step="0.00000001"
              value={value.conversion_factor}
              onChange={(event) => onChange("conversion_factor", event.target.value)}
              disabled={disabled}
              placeholder="Example: 12"
            />
          </Field>
        </div>

        <div className="mt-4">
          <ConversionPreview
            code={value.code}
            decimalPrecision={value.decimal_precision}
            baseUnitId={value.base_unit_id}
            conversionFactor={value.conversion_factor}
            baseUnit={selectedBaseUnit}
            exampleQuantity={exampleQuantity}
            onExampleQuantityChange={setExampleQuantity}
          />
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">5. Status and Ordering</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Active">
            <label className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]">
              <input type="checkbox" checked={value.is_active} onChange={(event) => onChange("is_active", event.target.checked)} disabled={disabled} />
              Unit is active
            </label>
          </Field>

          <Field label="Sort Order" required>
            <Input type="number" min="0" step="1" value={value.sort_order} onChange={(event) => onChange("sort_order", event.target.value)} disabled={disabled} required />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">6. Notes</h2>
        <div className="mt-5">
          <Field label="Notes">
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
  return <FormField label={label} required={required} className={className}>{children}</FormField>;
}
