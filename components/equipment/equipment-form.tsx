import { Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";
import {
  calculateEquipmentSummary,
  formatPercent,
  formatUsdCurrency,
  type EquipmentCostCodeOption,
  type EquipmentFormInput,
  type EquipmentVendorOption,
} from "@/lib/equipment";

type EquipmentFormProps = {
  value: EquipmentFormInput;
  vendorOptions: EquipmentVendorOption[];
  costCodeOptions: EquipmentCostCodeOption[];
  onChange: <K extends keyof EquipmentFormInput>(key: K, nextValue: EquipmentFormInput[K]) => void;
  disabled?: boolean;
};

export function EquipmentForm({ value, vendorOptions, costCodeOptions, onChange, disabled = false }: EquipmentFormProps) {
  const summary = calculateEquipmentSummary(value);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Live Calculation Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat label="Purchase Price" value={formatUsdCurrency(Number(value.purchase_price || 0))} />
            <SummaryStat label="Estimated Current Value" value={formatUsdCurrency(summary.estimatedCurrentBookValue)} />
            <SummaryStat label="Base Internal Hourly Cost" value={formatUsdCurrency(Number(value.hourly_internal_cost || 0))} />
            <SummaryStat label="Operating Cost / Hour" value={formatUsdCurrency(summary.totalOperatingCostPerHour)} />
            <SummaryStat label="Effective Hourly Cost" value={formatUsdCurrency(summary.effectiveInternalHourlyCost)} />
            <SummaryStat label="Billable Hourly Rate" value={formatUsdCurrency(Number(value.hourly_billable_rate || 0))} />
            <SummaryStat label="Gross Margin / Hour" value={formatUsdCurrency(summary.hourlyGrossMargin)} />
            <SummaryStat label="Margin %" value={formatPercent(summary.hourlyMarginPercentage)} />
            <SummaryStat label="Maintenance Status" value={summary.maintenanceDueStatus.replace(/_/g, " ")} />
            <SummaryStat label="Compliance Warning" value={[summary.warrantyStatus, summary.registrationStatus, summary.inspectionStatus, summary.insuranceStatus, summary.certificationStatus].filter((item) => item === "overdue" || item === "due_soon").join(", ") || "None"} />
          </div>
        </CardContent>
      </Card>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">1. Basic Information</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Equipment Number" required>
            <Input value={value.equipment_number} onChange={(event) => onChange("equipment_number", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Status" required>
            <Select value={value.status} onChange={(event) => onChange("status", event.target.value as EquipmentFormInput["status"])} disabled={disabled}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_service">Out of service</option>
              <option value="retired">Retired</option>
              <option value="sold">Sold</option>
              <option value="lost">Lost</option>
              <option value="stolen">Stolen</option>
            </Select>
          </Field>
          <Field label="Name" required className="md:col-span-2">
            <Input value={value.name} onChange={(event) => onChange("name", event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <textarea rows={4} value={value.description} onChange={(event) => onChange("description", event.target.value)} disabled={disabled} className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]" />
          </Field>
          <Field label="Equipment Type">
            <Select value={value.equipment_type} onChange={(event) => onChange("equipment_type", event.target.value as EquipmentFormInput["equipment_type"])} disabled={disabled}>
              <option value="">Not set</option>
              <option value="heavy_equipment">Heavy equipment</option>
              <option value="vehicle">Vehicle</option>
              <option value="trailer">Trailer</option>
              <option value="power_tool">Power tool</option>
              <option value="hand_tool">Hand tool</option>
              <option value="safety_equipment">Safety equipment</option>
              <option value="office_equipment">Office equipment</option>
              <option value="technology">Technology</option>
              <option value="rented_equipment">Rented equipment</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Category"><Input value={value.category} onChange={(event) => onChange("category", event.target.value)} disabled={disabled} /></Field>
          <Field label="Subcategory"><Input value={value.subcategory} onChange={(event) => onChange("subcategory", event.target.value)} disabled={disabled} /></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">2. Identification</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Manufacturer"><Input value={value.manufacturer} onChange={(event) => onChange("manufacturer", event.target.value)} disabled={disabled} /></Field>
          <Field label="Model"><Input value={value.model} onChange={(event) => onChange("model", event.target.value)} disabled={disabled} /></Field>
          <Field label="Model Year"><Input type="number" min="1900" max={String(new Date().getFullYear() + 1)} step="1" value={value.model_year} onChange={(event) => onChange("model_year", event.target.value)} disabled={disabled} /></Field>
          <Field label="Serial Number"><Input value={value.serial_number} onChange={(event) => onChange("serial_number", event.target.value)} disabled={disabled} /></Field>
          <Field label="VIN"><Input value={value.vin} onChange={(event) => onChange("vin", event.target.value)} disabled={disabled} /></Field>
          <Field label="License Plate"><Input value={value.license_plate} onChange={(event) => onChange("license_plate", event.target.value)} disabled={disabled} /></Field>
          <Field label="Asset Tag"><Input value={value.asset_tag} onChange={(event) => onChange("asset_tag", event.target.value)} disabled={disabled} /></Field>
          <Field label="Barcode"><Input value={value.barcode} onChange={(event) => onChange("barcode", event.target.value)} disabled={disabled} /></Field>
          <Field label="QR Code"><Input value={value.qr_code} onChange={(event) => onChange("qr_code", event.target.value)} disabled={disabled} /></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">3. Ownership</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Ownership Type" required>
            <Select value={value.ownership_type} onChange={(event) => onChange("ownership_type", event.target.value as EquipmentFormInput["ownership_type"])} disabled={disabled}>
              <option value="owned">Owned</option>
              <option value="financed">Financed</option>
              <option value="leased">Leased</option>
              <option value="rented">Rented</option>
              <option value="subcontractor_provided">Subcontractor provided</option>
              <option value="employee_owned">Employee owned</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Vendor"><Select value={value.vendor_id} onChange={(event) => onChange("vendor_id", event.target.value)} disabled={disabled}><option value="">None</option>{vendorOptions.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.displayName}</option>)}</Select></Field>
          <Field label="Owner Name"><Input value={value.owner_name} onChange={(event) => onChange("owner_name", event.target.value)} disabled={disabled} /></Field>
          <ConditionalDateField label="Lease Start Date" show={value.ownership_type === "leased"} value={value.lease_start_date} onChange={(next) => onChange("lease_start_date", next)} disabled={disabled} />
          <ConditionalDateField label="Lease End Date" show={value.ownership_type === "leased"} value={value.lease_end_date} onChange={(next) => onChange("lease_end_date", next)} disabled={disabled} />
          <ConditionalDateField label="Rental Start Date" show={value.ownership_type === "rented"} value={value.rental_start_date} onChange={(next) => onChange("rental_start_date", next)} disabled={disabled} />
          <ConditionalDateField label="Rental End Date" show={value.ownership_type === "rented"} value={value.rental_end_date} onChange={(next) => onChange("rental_end_date", next)} disabled={disabled} />
          <ConditionalField label="Rental Agreement Number" show={value.ownership_type === "rented"}>
            <Input value={value.rental_agreement_number} onChange={(event) => onChange("rental_agreement_number", event.target.value)} disabled={disabled} />
          </ConditionalField>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">4. Location and Assignment</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Current Location Type"><Select value={value.current_location_type} onChange={(event) => onChange("current_location_type", event.target.value as EquipmentFormInput["current_location_type"])} disabled={disabled}><option value="">Not set</option><option value="warehouse">Warehouse</option><option value="jobsite">Jobsite</option><option value="vehicle">Vehicle</option><option value="employee">Employee</option><option value="rental_provider">Rental provider</option><option value="repair_shop">Repair shop</option><option value="office">Office</option><option value="unknown">Unknown</option><option value="other">Other</option></Select></Field>
          <Field label="Current Location Name"><Input value={value.current_location_name} onChange={(event) => onChange("current_location_name", event.target.value)} disabled={disabled} /></Field>
          <Field label="Assigned Job ID"><Input value={value.assigned_job_id} onChange={(event) => onChange("assigned_job_id", event.target.value)} disabled={disabled} placeholder="UUID" /></Field>
          <Field label="Assigned Employee ID"><Input value={value.assigned_employee_id} onChange={(event) => onChange("assigned_employee_id", event.target.value)} disabled={disabled} placeholder="UUID" /></Field>
          <Field label="Assigned Crew ID"><Input value={value.assigned_crew_id} onChange={(event) => onChange("assigned_crew_id", event.target.value)} disabled={disabled} placeholder="UUID" /></Field>
          <Field label="Assigned At"><Input type="datetime-local" value={value.assigned_at} onChange={(event) => onChange("assigned_at", event.target.value)} disabled={disabled} /></Field>
          <Field label="Expected Return Date"><Input type="date" value={value.expected_return_date} onChange={(event) => onChange("expected_return_date", event.target.value)} disabled={disabled} /></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">5. Purchase and Financial Information</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Purchase Date"><Input type="date" value={value.purchase_date} onChange={(event) => onChange("purchase_date", event.target.value)} disabled={disabled} /></Field>
          <MoneyField label="Purchase Price" value={value.purchase_price} onChange={(next) => onChange("purchase_price", next)} disabled={disabled} required />
          <MoneyField label="Current Value" value={value.current_value} onChange={(next) => onChange("current_value", next)} disabled={disabled} />
          <MoneyField label="Salvage Value" value={value.salvage_value} onChange={(next) => onChange("salvage_value", next)} disabled={disabled} />
          <MoneyField label="Financed Amount" value={value.financed_amount} onChange={(next) => onChange("financed_amount", next)} disabled={disabled} />
          <MoneyField label="Monthly Payment" value={value.monthly_payment} onChange={(next) => onChange("monthly_payment", next)} disabled={disabled} />
          <MoneyField label="Lease Monthly Cost" value={value.lease_monthly_cost} onChange={(next) => onChange("lease_monthly_cost", next)} disabled={disabled} />
          <MoneyField label="Rental Daily Cost" value={value.rental_daily_cost} onChange={(next) => onChange("rental_daily_cost", next)} disabled={disabled} />
          <MoneyField label="Rental Weekly Cost" value={value.rental_weekly_cost} onChange={(next) => onChange("rental_weekly_cost", next)} disabled={disabled} />
          <MoneyField label="Rental Monthly Cost" value={value.rental_monthly_cost} onChange={(next) => onChange("rental_monthly_cost", next)} disabled={disabled} />
          <Field label="Depreciation Method"><Select value={value.depreciation_method} onChange={(event) => onChange("depreciation_method", event.target.value as EquipmentFormInput["depreciation_method"])} disabled={disabled}><option value="">Not set</option><option value="straight_line">Straight line</option><option value="declining_balance">Declining balance</option><option value="units_of_production">Units of production</option><option value="none">None</option><option value="other">Other</option></Select></Field>
          <Field label="Useful Life (Years)"><Input type="number" min="0" step="0.01" value={value.useful_life_years} onChange={(event) => onChange("useful_life_years", event.target.value)} disabled={disabled} /></Field>
          <Field label="Depreciation Start Date"><Input type="date" value={value.depreciation_start_date} onChange={(event) => onChange("depreciation_start_date", event.target.value)} disabled={disabled} /></Field>
          <Field label="Warranty Expiration Date"><Input type="date" value={value.warranty_expiration_date} onChange={(event) => onChange("warranty_expiration_date", event.target.value)} disabled={disabled} /></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">6. Operating Costs</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <MoneyField label="Base Internal Hourly Cost" value={value.hourly_internal_cost} onChange={(next) => onChange("hourly_internal_cost", next)} disabled={disabled} required />
          <MoneyField label="Hourly Billable Rate" value={value.hourly_billable_rate} onChange={(next) => onChange("hourly_billable_rate", next)} disabled={disabled} required />
          <MoneyField label="Daily Internal Cost" value={value.daily_internal_cost} onChange={(next) => onChange("daily_internal_cost", next)} disabled={disabled} />
          <MoneyField label="Daily Billable Rate" value={value.daily_billable_rate} onChange={(next) => onChange("daily_billable_rate", next)} disabled={disabled} />
          <Field label="Fuel Type"><Input value={value.fuel_type} onChange={(event) => onChange("fuel_type", event.target.value)} disabled={disabled} /></Field>
          <MoneyField label="Estimated Fuel Cost / Hour" value={value.estimated_fuel_cost_per_hour} onChange={(next) => onChange("estimated_fuel_cost_per_hour", next)} disabled={disabled} />
          <MoneyField label="Maintenance Cost / Hour" value={value.maintenance_cost_per_hour} onChange={(next) => onChange("maintenance_cost_per_hour", next)} disabled={disabled} />
          <MoneyField label="Insurance Cost / Hour" value={value.insurance_cost_per_hour} onChange={(next) => onChange("insurance_cost_per_hour", next)} disabled={disabled} />
          <MoneyField label="Other Operating Cost / Hour" value={value.other_operating_cost_per_hour} onChange={(next) => onChange("other_operating_cost_per_hour", next)} disabled={disabled} />
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">7. Meter and Usage</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Meter Type"><Select value={value.meter_type} onChange={(event) => onChange("meter_type", event.target.value as EquipmentFormInput["meter_type"])} disabled={disabled}><option value="">Not set</option><option value="hours">Hours</option><option value="mileage">Mileage</option><option value="cycles">Cycles</option><option value="none">None</option><option value="other">Other</option></Select></Field>
          <Field label="Current Meter Reading"><Input type="number" min="0" step="0.001" value={value.current_meter_reading} onChange={(event) => onChange("current_meter_reading", event.target.value)} disabled={disabled} /></Field>
          <Field label="Meter Unit"><Select value={value.meter_unit} onChange={(event) => onChange("meter_unit", event.target.value)} disabled={disabled}><option value="">Not set</option><option value="hours">Hours</option><option value="miles">Miles</option><option value="kilometers">Kilometers</option><option value="cycles">Cycles</option></Select></Field>
          <Field label="Last Meter Updated At"><Input type="datetime-local" value={value.last_meter_updated_at} onChange={(event) => onChange("last_meter_updated_at", event.target.value)} disabled={disabled} /></Field>
          <Field label="Lifetime Hours"><Input type="number" min="0" step="0.001" value={value.lifetime_hours} onChange={(event) => onChange("lifetime_hours", event.target.value)} disabled={disabled} /></Field>
          <Field label="Lifetime Miles"><Input type="number" min="0" step="0.001" value={value.lifetime_miles} onChange={(event) => onChange("lifetime_miles", event.target.value)} disabled={disabled} /></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">8. Maintenance</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Maintenance Status"><Select value={value.maintenance_status} onChange={(event) => onChange("maintenance_status", event.target.value as EquipmentFormInput["maintenance_status"])} disabled={disabled}><option value="current">Current</option><option value="due_soon">Due soon</option><option value="overdue">Overdue</option><option value="in_service">In service</option><option value="unavailable">Unavailable</option><option value="not_required">Not required</option></Select></Field>
          <Field label="Last Service Date"><Input type="date" value={value.last_service_date} onChange={(event) => onChange("last_service_date", event.target.value)} disabled={disabled} /></Field>
          <Field label="Next Service Date"><Input type="date" value={value.next_service_date} onChange={(event) => onChange("next_service_date", event.target.value)} disabled={disabled} /></Field>
          <Field label="Last Service Meter"><Input type="number" min="0" step="0.001" value={value.last_service_meter} onChange={(event) => onChange("last_service_meter", event.target.value)} disabled={disabled} /></Field>
          <Field label="Next Service Meter"><Input type="number" min="0" step="0.001" value={value.next_service_meter} onChange={(event) => onChange("next_service_meter", event.target.value)} disabled={disabled} /></Field>
          <Field label="Service Interval Days"><Input type="number" min="0" step="1" value={value.service_interval_days} onChange={(event) => onChange("service_interval_days", event.target.value)} disabled={disabled} /></Field>
          <Field label="Service Interval Meter"><Input type="number" min="0" step="0.001" value={value.service_interval_meter} onChange={(event) => onChange("service_interval_meter", event.target.value)} disabled={disabled} /></Field>
          <Field label="Maintenance Notes" className="md:col-span-2 lg:col-span-3"><textarea rows={4} value={value.maintenance_notes} onChange={(event) => onChange("maintenance_notes", event.target.value)} disabled={disabled} className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]" /></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">9. Compliance and Safety</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Registration Expiration Date"><Input type="date" value={value.registration_expiration_date} onChange={(event) => onChange("registration_expiration_date", event.target.value)} disabled={disabled} /></Field>
          <Field label="Inspection Expiration Date"><Input type="date" value={value.inspection_expiration_date} onChange={(event) => onChange("inspection_expiration_date", event.target.value)} disabled={disabled} /></Field>
          <Field label="Insurance Expiration Date"><Input type="date" value={value.insurance_expiration_date} onChange={(event) => onChange("insurance_expiration_date", event.target.value)} disabled={disabled} /></Field>
          <Field label="Certification Expiration Date"><Input type="date" value={value.certification_expiration_date} onChange={(event) => onChange("certification_expiration_date", event.target.value)} disabled={disabled} /></Field>
          <Field label="Requires Operator Certification" className="md:col-span-2"><label className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"><input type="checkbox" checked={value.requires_operator_certification} onChange={(event) => onChange("requires_operator_certification", event.target.checked)} disabled={disabled} /> Required for operation</label></Field>
          <ConditionalField label="Required Certification Type" show={value.requires_operator_certification}><Input value={value.required_certification_type} onChange={(event) => onChange("required_certification_type", event.target.value)} disabled={disabled} /></ConditionalField>
          <Field label="Safety Notes" className="md:col-span-2 lg:col-span-3"><textarea rows={4} value={value.safety_notes} onChange={(event) => onChange("safety_notes", event.target.value)} disabled={disabled} className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]" /></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">10. Estimating Defaults</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Default Cost Code"><Select value={value.default_cost_code_id} onChange={(event) => onChange("default_cost_code_id", event.target.value)} disabled={disabled}><option value="">None</option>{costCodeOptions.map((option) => <option key={option.id} value={option.id}>{option.code} - {option.name}</option>)}</Select></Field>
          <Field label="Default Unit of Measure"><Input value={value.default_unit_of_measure} onChange={(event) => onChange("default_unit_of_measure", event.target.value)} disabled={disabled} /></Field>
          <Field label="Default Quantity"><Input type="number" min="0" step="0.0001" value={value.default_quantity} onChange={(event) => onChange("default_quantity", event.target.value)} disabled={disabled} /></Field>
          <Field label="Taxable"><label className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"><input type="checkbox" checked={value.taxable} onChange={(event) => onChange("taxable", event.target.checked)} disabled={disabled} /> Subject to tax in estimates</label></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">11. Intelligence Foundation</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Criticality Level"><Select value={value.criticality_level} onChange={(event) => onChange("criticality_level", event.target.value as EquipmentFormInput["criticality_level"])} disabled={disabled}><option value="low">Low</option><option value="standard">Standard</option><option value="high">High</option><option value="mission_critical">Mission critical</option></Select></Field>
          <Field label="Utilization Target %"><Input type="number" min="0" max="100" step="0.0001" value={value.utilization_target_percent} onChange={(event) => onChange("utilization_target_percent", event.target.value)} disabled={disabled} /></Field>
          <Field label="Replacement Priority"><Select value={value.replacement_priority} onChange={(event) => onChange("replacement_priority", event.target.value as EquipmentFormInput["replacement_priority"])} disabled={disabled}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select></Field>
          <Field label="Replacement Score"><Input type="number" min="0" max="100" step="0.0001" value={value.replacement_score} onChange={(event) => onChange("replacement_score", event.target.value)} disabled={disabled} /></Field>
          <Field label="Condition Score"><Input type="number" min="0" max="100" step="0.0001" value={value.condition_score} onChange={(event) => onChange("condition_score", event.target.value)} disabled={disabled} /></Field>
          <Field label="Reliability Score"><Input type="number" min="0" max="100" step="0.0001" value={value.reliability_score} onChange={(event) => onChange("reliability_score", event.target.value)} disabled={disabled} /></Field>
          <Field label="AI Notes" className="md:col-span-2 lg:col-span-3"><textarea rows={4} value={value.ai_notes} onChange={(event) => onChange("ai_notes", event.target.value)} disabled={disabled} className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]" /></Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">12. Notes</h2>
        <div className="mt-5 grid gap-5">
          <Field label="Notes"><textarea rows={5} value={value.notes} onChange={(event) => onChange("notes", event.target.value)} disabled={disabled} className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]" /></Field>
        </div>
      </section>
    </div>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode; }) {
  return <div className={className}><label className="mb-2 block text-sm font-semibold text-[var(--color-text-primary)]">{label}{required ? <span className="ml-1 text-[var(--color-danger-700)]">*</span> : null}</label>{children}</div>;
}

function ConditionalField({ label, show, children }: { label: string; show: boolean; children: React.ReactNode; }) {
  if (!show) {
    return null;
  }

  return <Field label={label}>{children}</Field>;
}

function ConditionalDateField({ label, show, value, onChange, disabled }: { label: string; show: boolean; value: string; onChange: (value: string) => void; disabled?: boolean; }) {
  if (!show) {
    return null;
  }

  return <Field label={label}><Input type="date" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} /></Field>;
}

function MoneyField({ label, value, onChange, disabled, required }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean; }) {
  return <Field label={label} required={required}><Input type="number" min="0" step="0.0001" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required} /></Field>;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3"><p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p></div>;
}
