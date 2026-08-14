"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, PageHeader, PartialDataNotice, SectionLoadingState, StatusBadge, SummaryCard } from "@/components/ui";
import { equipmentRowToListItem, formatPercent, formatUsdCurrency, type EquipmentListItem } from "@/lib/equipment";
import { calculateEquipmentSummary } from "@/lib/equipment/validation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type EquipmentTabKey =
  | "overview"
  | "assignments"
  | "maintenance"
  | "inspections"
  | "photos"
  | "documents"
  | "costs"
  | "history"
  | "utilization"
  | "notes";

const TABS: Array<{ key: EquipmentTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "assignments", label: "Assignments" },
  { key: "maintenance", label: "Maintenance" },
  { key: "inspections", label: "Inspections" },
  { key: "photos", label: "Photos" },
  { key: "documents", label: "Documents" },
  { key: "costs", label: "Costs" },
  { key: "history", label: "History" },
  { key: "utilization", label: "Utilization" },
  { key: "notes", label: "Notes" },
];

export function EquipmentDetailClient() {
  const params = useParams<{ id?: string | string[] }>();
  const equipmentId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);

  const [equipment, setEquipment] = useState<EquipmentListItem | null>(null);
  const [defaultCostCodeLabel, setDefaultCostCodeLabel] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EquipmentTabKey>("overview");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      if (!supabase) {
        if (active) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }
        return;
      }

      if (!equipmentId) {
        if (active) {
          setErrorMessage("Unable to read equipment id.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(supabase);

        if (!workspace.context) {
          if (active) {
            setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
            setIsLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("equipment")
          .select("*")
          .eq("id", equipmentId)
          .eq("company_id", workspace.context.companyId)
          .maybeSingle();

        if (!active) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setIsLoading(false);
          return;
        }

        if (!data) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        const row = data;
        const nextEquipment = equipmentRowToListItem(row);
        setEquipment(nextEquipment);

        const [costCodeResponse, vendorResponse, projectResponse, employeeResponse] = await Promise.all([
          row.default_cost_code_id
            ? supabase.from("cost_codes").select("code, name").eq("company_id", workspace.context.companyId).eq("id", row.default_cost_code_id).maybeSingle<{ code: string; name: string }>()
            : Promise.resolve({ data: null }),
          row.vendor_id
            ? supabase
                .from("vendors")
                .select("display_name, company_name, first_name, last_name")
                .eq("company_id", workspace.context.companyId)
                .eq("id", row.vendor_id)
                .maybeSingle<{ display_name: string | null; company_name: string | null; first_name: string | null; last_name: string | null }>()
            : Promise.resolve({ data: null }),
          row.assigned_job_id
            ? supabase.from("projects").select("name").eq("company_id", workspace.context.companyId).eq("id", row.assigned_job_id).maybeSingle<{ name: string }>()
            : Promise.resolve({ data: null }),
          row.assigned_employee_id
            ? supabase.from("profiles").select("first_name, last_name").eq("company_id", workspace.context.companyId).eq("id", row.assigned_employee_id).maybeSingle<{ first_name: string | null; last_name: string | null }>()
            : Promise.resolve({ data: null }),
        ]);

        if (!active) {
          return;
        }

        setDefaultCostCodeLabel(costCodeResponse.data ? `${costCodeResponse.data.code} ${costCodeResponse.data.name}` : null);
        setVendorName(
          vendorResponse.data
            ? vendorResponse.data.display_name || vendorResponse.data.company_name || [vendorResponse.data.first_name, vendorResponse.data.last_name].filter(Boolean).join(" ") || null
            : null,
        );
        setProjectName(projectResponse.data?.name || null);
        setEmployeeName(employeeResponse.data ? [employeeResponse.data.first_name, employeeResponse.data.last_name].filter(Boolean).join(" ") || null : null);
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load equipment.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [equipmentId, supabase]);

  if (isLoading) {
    return <SectionLoadingState rows={6} />;
  }

  if (errorMessage) {
    return <ErrorState title="Unable to load equipment" description={errorMessage} />;
  }

  if (notFound || !equipment) {
    return <EmptyState title="Equipment not found" description="This equipment record could not be located in your company workspace." action={<Link href="/equipment"><Badge tone="brand">Back to equipment</Badge></Link>} />;
  }

  const calculations = calculateEquipmentSummary({
    equipment_number: equipment.equipmentNumber,
    name: equipment.name,
    description: "",
    status: equipment.status,
    equipment_type: equipment.equipmentType || "",
    category: equipment.category || "",
    subcategory: "",
    manufacturer: equipment.manufacturer || "",
    model: equipment.model || "",
    model_year: equipment.modelYear !== null ? String(equipment.modelYear) : "",
    serial_number: equipment.serialNumber || "",
    vin: "",
    license_plate: "",
    asset_tag: "",
    barcode: "",
    qr_code: equipment.qrCode || "",
    ownership_type: equipment.ownershipType,
    vendor_id: equipment.vendorId || "",
    owner_name: "",
    lease_start_date: "",
    lease_end_date: "",
    rental_start_date: "",
    rental_end_date: "",
    rental_agreement_number: "",
    current_location_type: equipment.currentLocationType || "",
    current_location_name: equipment.currentLocationName || "",
    assigned_job_id: equipment.assignedJobId || "",
    assigned_employee_id: equipment.assignedEmployeeId || "",
    assigned_crew_id: equipment.assignedCrewId || "",
    assigned_at: equipment.assignedAt || "",
    expected_return_date: equipment.expectedReturnDate || "",
    purchase_date: equipment.purchaseDate || "",
    purchase_price: String(equipment.purchasePrice),
    current_value: String(equipment.currentValue),
    salvage_value: "0",
    financed_amount: "0",
    monthly_payment: "0",
    lease_monthly_cost: "0",
    rental_daily_cost: "0",
    rental_weekly_cost: "0",
    rental_monthly_cost: "0",
    depreciation_method: "",
    useful_life_years: "",
    depreciation_start_date: "",
    warranty_expiration_date: equipment.warrantyExpirationDate || "",
    hourly_internal_cost: String(equipment.effectiveInternalHourlyCost),
    hourly_billable_rate: String(equipment.hourlyBillableRate),
    daily_internal_cost: "0",
    daily_billable_rate: "0",
    fuel_type: equipment.fuelType || "",
    estimated_fuel_cost_per_hour: "0",
    maintenance_cost_per_hour: "0",
    insurance_cost_per_hour: "0",
    other_operating_cost_per_hour: "0",
    meter_type: equipment.meterType || "",
    current_meter_reading: String(equipment.currentMeterReading),
    meter_unit: "",
    last_meter_updated_at: "",
    lifetime_hours: String(equipment.lifetimeHours),
    lifetime_miles: String(equipment.lifetimeMiles),
    maintenance_status: equipment.maintenanceStatus,
    last_service_date: equipment.lastServiceDate || "",
    next_service_date: equipment.nextServiceDate || "",
    last_service_meter: "",
    next_service_meter: "",
    service_interval_days: "",
    service_interval_meter: "",
    maintenance_notes: equipment.maintenanceNotes || "",
    registration_expiration_date: equipment.registrationExpirationDate || "",
    inspection_expiration_date: equipment.inspectionExpirationDate || "",
    insurance_expiration_date: equipment.insuranceExpirationDate || "",
    certification_expiration_date: equipment.certificationExpirationDate || "",
    requires_operator_certification: false,
    required_certification_type: "",
    safety_notes: "",
    default_cost_code_id: equipment.defaultCostCodeId || "",
    default_unit_of_measure: "",
    default_quantity: "1",
    taxable: false,
    criticality_level: equipment.criticalityLevel,
    utilization_target_percent: equipment.utilizationTargetPercent !== null ? String(equipment.utilizationTargetPercent) : "",
    replacement_priority: equipment.replacementPriority,
    replacement_score: "",
    condition_score: equipment.conditionScore !== null ? String(equipment.conditionScore) : "",
    reliability_score: "",
    ai_notes: "",
    notes: equipment.notes || "",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={`${equipment.equipmentNumber} · ${equipment.name}`}
        description="Monitor assignments, maintenance context, and operating performance from a single equipment workspace."
        secondaryActions={(
          <Link
            href="/equipment"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 text-sm font-semibold text-[var(--color-text-secondary)]"
          >
            Back to Equipment
          </Link>
        )}
        primaryAction={(
          <Link href={`/equipment/${equipment.id}/edit`} className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
            Edit Equipment
          </Link>
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={equipment.status} />
        <Badge tone="neutral">{equipment.ownershipType.replace(/_/g, " ")}</Badge>
        <Badge tone="info">{equipment.equipmentType?.replace(/_/g, " ") || "Unclassified"}</Badge>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard icon={<span>T</span>} label="Total Cost / Hour" value={formatUsdCurrency(calculations.effectiveInternalHourlyCost)} context="Live" tone="brand" />
        <SummaryCard icon={<span>M</span>} label="Margin %" value={formatPercent(calculations.hourlyMarginPercentage)} context={formatUsdCurrency(calculations.hourlyGrossMargin)} tone="success" />
        <SummaryCard icon={<span>W</span>} label="Warranty" value={calculations.warrantyStatus.replace(/_/g, " ")} context={equipment.warrantyExpirationDate || "Unavailable"} tone="info" />
        <SummaryCard icon={<span>I</span>} label="Inspection" value={calculations.inspectionStatus.replace(/_/g, " ")} context={equipment.inspectionExpirationDate || "Unavailable"} tone="warning" />
        <SummaryCard icon={<span>U</span>} label="Utilization Target" value={equipment.utilizationTargetPercent !== null ? `${equipment.utilizationTargetPercent}%` : "Unavailable"} context="Phase 1" tone="neutral" />
        <SummaryCard icon={<span>C</span>} label="Condition" value={equipment.conditionScore !== null ? `${equipment.conditionScore}/100` : "Unavailable"} context="Phase 1" tone="warning" />
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Equipment profile tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]",
              activeTab === tab.key
                ? "border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white"
                : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <PartialDataNotice message="Assignment, maintenance, inspection, photo, document, and utilization timelines are partially available in Phase 1 because dedicated history tables are not yet present." />

      {activeTab === "overview" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <InfoRow label="Photo" value="Not configured" />
              <InfoRow label="Equipment number" value={equipment.equipmentNumber} />
              <InfoRow label="Category" value={equipment.category || equipment.equipmentType?.replace(/_/g, " ") || "Uncategorized"} />
              <InfoRow label="Status" value={equipment.status.replace(/_/g, " ")} />
              <InfoRow label="Current project" value={projectName || "Unassigned"} />
              <InfoRow label="Assigned employee" value={employeeName || "Unassigned"} />
              <InfoRow label="Location" value={equipment.currentLocationName || equipment.currentLocationType?.replace(/_/g, " ") || "Unavailable"} />
              <InfoRow label="Purchase cost" value={formatUsdCurrency(equipment.purchasePrice)} />
              <InfoRow label="Replacement value" value={formatUsdCurrency(equipment.currentValue)} />
              <InfoRow label="Warranty" value={equipment.warrantyExpirationDate || "Unavailable"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Operations Data</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <InfoRow label="Current condition" value={equipment.conditionScore !== null ? `${equipment.conditionScore}/100` : "Unavailable"} />
              <InfoRow label="Operating hours" value={`${equipment.lifetimeHours.toFixed(1)} h`} />
              <InfoRow label="Mileage" value={`${equipment.lifetimeMiles.toFixed(1)} mi`} />
              <InfoRow label="Fuel type" value={equipment.fuelType || "Unavailable"} />
              <InfoRow label="Last inspection" value={equipment.inspectionExpirationDate || "Unavailable"} />
              <InfoRow label="Next maintenance" value={equipment.nextServiceDate || "Unavailable"} />
              <InfoRow label="Next inspection" value={equipment.inspectionExpirationDate || "Unavailable"} />
              <InfoRow label="Vendor" value={vendorName || "Unavailable"} />
              <InfoRow label="Default cost code" value={defaultCostCodeLabel || "Unavailable"} />
              <InfoRow label="QR code status" value={equipment.qrCode ? "Assigned" : "Missing"} />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeTab === "assignments" ? (
        <Card>
          <CardHeader><CardTitle>Assignments</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Current project" value={projectName || "Unassigned"} />
            <InfoRow label="Assigned employee" value={employeeName || "Unassigned"} />
            <InfoRow label="Assigned at" value={equipment.assignedAt ? new Date(equipment.assignedAt).toLocaleString() : "Unavailable"} />
            <InfoRow label="Expected return" value={equipment.expectedReturnDate || "Unavailable"} />
            <PartialDataNotice message="Past project assignments and reason-based assignment history require a dedicated assignment-history table that is not present in Phase 1." />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "maintenance" ? (
        <Card>
          <CardHeader><CardTitle>Maintenance</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Maintenance status" value={equipment.maintenanceStatus.replace(/_/g, " ")} />
            <InfoRow label="Last service" value={equipment.lastServiceDate || "Unavailable"} />
            <InfoRow label="Next service" value={equipment.nextServiceDate || "Unavailable"} />
            <InfoRow label="Service notes" value={equipment.maintenanceNotes || "Unavailable"} />
            <PartialDataNotice message="Preventive maintenance line items (oil, hydraulics, tires, electrical, engine, transmission), provider records, cost rollups, and downtime history require maintenance-log tables not yet present." />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "inspections" ? (
        <Card>
          <CardHeader><CardTitle>Inspections</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Inspection expiration" value={equipment.inspectionExpirationDate || "Unavailable"} />
            <InfoRow label="Registration expiration" value={equipment.registrationExpirationDate || "Unavailable"} />
            <InfoRow label="Insurance expiration" value={equipment.insuranceExpirationDate || "Unavailable"} />
            <InfoRow label="Certification expiration" value={equipment.certificationExpirationDate || "Unavailable"} />
            <PartialDataNotice message="Daily/weekly/monthly/annual, DOT/OSHA inspection records, failures, corrective actions, and inspector/photo logs require dedicated inspection tables not yet present." />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "photos" ? (
        <Card>
          <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
          <CardContent>
            <PartialDataNotice message="Equipment-specific photo timeline is not available in Phase 1 because there is no direct equipment-photo relationship table." />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "documents" ? (
        <Card>
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          <CardContent>
            <PartialDataNotice message="Manuals, receipts, warranty files, insurance, registration, service records, and inspection documents require an equipment-document relationship table not yet present." />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "costs" ? (
        <Card>
          <CardHeader><CardTitle>Costs</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Purchase cost" value={formatUsdCurrency(equipment.purchasePrice)} />
            <InfoRow label="Current value" value={formatUsdCurrency(equipment.currentValue)} />
            <InfoRow label="Effective internal hourly cost" value={formatUsdCurrency(equipment.effectiveInternalHourlyCost)} />
            <InfoRow label="Hourly billable rate" value={formatUsdCurrency(equipment.hourlyBillableRate)} />
            <InfoRow label="Margin" value={formatPercent(calculations.hourlyMarginPercentage)} />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "history" ? (
        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Created" value={new Date(equipment.createdAt).toLocaleString()} />
            <InfoRow label="Last updated" value={new Date(equipment.updatedAt).toLocaleString()} />
            <PartialDataNotice message="Operational event history (assignment changes, maintenance events, inspection events) requires dedicated equipment-event tables not yet present." />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "utilization" ? (
        <Card>
          <CardHeader><CardTitle>Utilization</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Hours used" value={`${equipment.lifetimeHours.toFixed(1)} h`} />
            <InfoRow label="Mileage" value={`${equipment.lifetimeMiles.toFixed(1)} mi`} />
            <InfoRow label="Utilization target" value={equipment.utilizationTargetPercent !== null ? `${equipment.utilizationTargetPercent}%` : "Unavailable"} />
            <PartialDataNotice message="Days active, idle time, projects served counts, and revenue-generated metrics require time-series utilization logs and equipment-to-project assignment history not yet present." />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "notes" ? (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Asset notes" value={equipment.notes || "No notes"} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--color-text-primary)]">{value?.trim() || "-"}</p>
    </div>
  );
}
