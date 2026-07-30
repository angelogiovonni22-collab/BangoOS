import { Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";
import {
  calculateLaborRateSummary,
  formatPercent,
  formatUsdCurrency,
  type CostCodeOption,
  type LaborRateFormInput,
} from "@/lib/labor-rates";

type LaborRateFormProps = {
  value: LaborRateFormInput;
  costCodeOptions: CostCodeOption[];
  onChange: <K extends keyof LaborRateFormInput>(key: K, nextValue: LaborRateFormInput[K]) => void;
  disabled?: boolean;
};

export function LaborRateForm({ value, costCodeOptions, onChange, disabled = false }: LaborRateFormProps) {
  const summary = calculateLaborRateSummary(value);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Live Calculation Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat label="Base Rate" value={formatUsdCurrency(summary.baseRate, value.currency_code)} />
            <SummaryStat label="Total Burden" value={formatUsdCurrency(summary.totalBurdenHourly, value.currency_code)} />
            <SummaryStat label="True Cost" value={formatUsdCurrency(summary.trueHourlyCost, value.currency_code)} />
            <SummaryStat label="Overtime Rate" value={formatUsdCurrency(summary.overtimePayRate, value.currency_code)} />
            <SummaryStat label="Billable Rate" value={formatUsdCurrency(summary.billableHourlyRate, value.currency_code)} />
            <SummaryStat label="Gross Margin / Hour" value={formatUsdCurrency(summary.grossMarginPerHour, value.currency_code)} />
            <SummaryStat label="Burden %" value={formatPercent(summary.burdenPercentage)} />
          </div>
        </CardContent>
      </Card>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">1. Basic Information</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Code" required>
            <Input value={value.code} onChange={(event) => onChange("code", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Status" required>
            <Select value={value.status} onChange={(event) => onChange("status", event.target.value as LaborRateFormInput["status"])} disabled={disabled}>
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
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">2. Classification</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Trade">
            <Input value={value.trade} onChange={(event) => onChange("trade", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Position Title">
            <Input value={value.position_title} onChange={(event) => onChange("position_title", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Skill Level">
            <Select value={value.skill_level} onChange={(event) => onChange("skill_level", event.target.value as LaborRateFormInput["skill_level"])} disabled={disabled}>
              <option value="">Not set</option>
              <option value="apprentice">Apprentice</option>
              <option value="helper">Helper</option>
              <option value="journeyman">Journeyman</option>
              <option value="foreman">Foreman</option>
              <option value="superintendent">Superintendent</option>
              <option value="specialist">Specialist</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Employment Type">
            <Select value={value.employment_type} onChange={(event) => onChange("employment_type", event.target.value as LaborRateFormInput["employment_type"])} disabled={disabled}>
              <option value="">Not set</option>
              <option value="employee">Employee</option>
              <option value="temporary">Temporary</option>
              <option value="subcontracted_labor">Subcontracted labor</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Union Status">
            <Select value={value.union_status} onChange={(event) => onChange("union_status", event.target.value as LaborRateFormInput["union_status"])} disabled={disabled}>
              <option value="">Not set</option>
              <option value="union">Union</option>
              <option value="non_union">Non-union</option>
              <option value="prevailing_wage">Prevailing wage</option>
              <option value="not_applicable">Not applicable</option>
            </Select>
          </Field>
          <Field label="Worker Classification">
            <Select value={value.worker_classification} onChange={(event) => onChange("worker_classification", event.target.value as LaborRateFormInput["worker_classification"])} disabled={disabled}>
              <option value="">Not set</option>
              <option value="w2">W2</option>
              <option value="1099">1099</option>
              <option value="temporary">Temporary</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Default Cost Code">
            <Select value={value.default_cost_code_id} onChange={(event) => onChange("default_cost_code_id", event.target.value)} disabled={disabled}>
              <option value="">None</option>
              {costCodeOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.code} - {option.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Currency" required>
            <Input value={value.currency_code} onChange={(event) => onChange("currency_code", event.target.value.toUpperCase())} disabled={disabled} maxLength={3} required />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">3. Compensation</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Base Hourly Rate" required>
            <Input type="number" min="0" step="0.0001" value={value.base_hourly_rate} onChange={(event) => onChange("base_hourly_rate", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Overtime Multiplier" required>
            <Input type="number" min="1" step="0.0001" value={value.overtime_multiplier} onChange={(event) => onChange("overtime_multiplier", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Double-time Multiplier" required>
            <Input type="number" min="1" step="0.0001" value={value.double_time_multiplier} onChange={(event) => onChange("double_time_multiplier", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Weekend Multiplier" required>
            <Input type="number" min="0" step="0.0001" value={value.weekend_multiplier} onChange={(event) => onChange("weekend_multiplier", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Holiday Multiplier" required>
            <Input type="number" min="0" step="0.0001" value={value.holiday_multiplier} onChange={(event) => onChange("holiday_multiplier", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Shift Differential" required>
            <Input type="number" min="0" step="0.0001" value={value.shift_differential} onChange={(event) => onChange("shift_differential", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Bonus Hourly Allocation" required>
            <Input type="number" min="0" step="0.0001" value={value.bonus_hourly_allocation} onChange={(event) => onChange("bonus_hourly_allocation", event.target.value)} disabled={disabled} required />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">4. Employer Burden</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Payroll Tax / Hour"><MoneyInput value={value.payroll_tax_hourly} onChange={(next) => onChange("payroll_tax_hourly", next)} disabled={disabled} /></Field>
          <Field label="Workers Comp / Hour"><MoneyInput value={value.workers_comp_hourly} onChange={(next) => onChange("workers_comp_hourly", next)} disabled={disabled} /></Field>
          <Field label="Health Insurance / Hour"><MoneyInput value={value.health_insurance_hourly} onChange={(next) => onChange("health_insurance_hourly", next)} disabled={disabled} /></Field>
          <Field label="Retirement / Hour"><MoneyInput value={value.retirement_hourly} onChange={(next) => onChange("retirement_hourly", next)} disabled={disabled} /></Field>
          <Field label="Paid Time Off / Hour"><MoneyInput value={value.paid_time_off_hourly} onChange={(next) => onChange("paid_time_off_hourly", next)} disabled={disabled} /></Field>
          <Field label="Training / Hour"><MoneyInput value={value.training_hourly} onChange={(next) => onChange("training_hourly", next)} disabled={disabled} /></Field>
          <Field label="Vehicle Allowance / Hour"><MoneyInput value={value.vehicle_allowance_hourly} onChange={(next) => onChange("vehicle_allowance_hourly", next)} disabled={disabled} /></Field>
          <Field label="Phone Allowance / Hour"><MoneyInput value={value.phone_allowance_hourly} onChange={(next) => onChange("phone_allowance_hourly", next)} disabled={disabled} /></Field>
          <Field label="Tool Allowance / Hour"><MoneyInput value={value.tool_allowance_hourly} onChange={(next) => onChange("tool_allowance_hourly", next)} disabled={disabled} /></Field>
          <Field label="Uniform / Hour"><MoneyInput value={value.uniform_hourly} onChange={(next) => onChange("uniform_hourly", next)} disabled={disabled} /></Field>
          <Field label="Other Burden / Hour"><MoneyInput value={value.other_burden_hourly} onChange={(next) => onChange("other_burden_hourly", next)} disabled={disabled} /></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">5. Pricing</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Overhead Markup %" required>
            <Input type="number" min="0" step="0.0001" value={value.overhead_markup_percent} onChange={(event) => onChange("overhead_markup_percent", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Profit Markup %" required>
            <Input type="number" min="0" step="0.0001" value={value.profit_markup_percent} onChange={(event) => onChange("profit_markup_percent", event.target.value)} disabled={disabled} required />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">6. Productivity</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Production Rate">
            <Input type="number" min="0" step="0.0001" value={value.production_rate} onChange={(event) => onChange("production_rate", event.target.value)} disabled={disabled} />
          </Field>
          <Field label="Production Unit">
            <Input value={value.production_unit} onChange={(event) => onChange("production_unit", event.target.value)} disabled={disabled} placeholder="square feet, sheets, linear feet" />
          </Field>
          <Field label="Production Period">
            <Select value={value.production_period} onChange={(event) => onChange("production_period", event.target.value as LaborRateFormInput["production_period"])} disabled={disabled}>
              <option value="">Not set</option>
              <option value="hour">Hour</option>
              <option value="day">Day</option>
              <option value="shift">Shift</option>
            </Select>
          </Field>
          <Field label="Crew Size">
            <Input type="number" min="0.01" step="0.01" value={value.crew_size} onChange={(event) => onChange("crew_size", event.target.value)} disabled={disabled} />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">7. Notes</h2>
        <div className="mt-5 grid gap-5">
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

function MoneyInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <Input type="number" min="0" step="0.0001" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
      <p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
