"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, SkeletonLoader, StatusBadge, SummaryCard } from "@/components/ui";
import { equipmentRowToListItem, formatPercent, formatUsdCurrency, type EquipmentListItem } from "@/lib/equipment";
import { calculateEquipmentSummary } from "@/lib/equipment/validation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function EquipmentDetailClient() {
  const params = useParams<{ id?: string | string[] }>();
  const equipmentId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);

  const [equipment, setEquipment] = useState<EquipmentListItem | null>(null);
  const [defaultCostCodeLabel, setDefaultCostCodeLabel] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        setEquipment(equipmentRowToListItem(row));

        if (row.default_cost_code_id) {
          const { data: costCodeData } = await supabase.from("cost_codes").select("code, name").eq("company_id", workspace.context.companyId).eq("id", row.default_cost_code_id).maybeSingle<{ code: string; name: string }>();
          if (active) {
            setDefaultCostCodeLabel(costCodeData ? `${costCodeData.code} ${costCodeData.name}` : null);
          }
        } else {
          setDefaultCostCodeLabel(null);
        }

        if (row.vendor_id) {
          const { data: vendorData } = await supabase
            .from("vendors")
            .select("display_name, company_name, first_name, last_name")
            .eq("company_id", workspace.context.companyId)
            .eq("id", row.vendor_id)
            .maybeSingle<{ display_name: string | null; company_name: string | null; first_name: string | null; last_name: string | null }>();

          if (active) {
            setVendorName(vendorData ? vendorData.display_name || vendorData.company_name || [vendorData.first_name, vendorData.last_name].filter(Boolean).join(" ") : null);
          }
        } else {
          setVendorName(null);
        }
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
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-8 w-80" />
        <SkeletonLoader className="h-24 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
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
    category: "",
    subcategory: "",
    manufacturer: equipment.manufacturer || "",
    model: equipment.model || "",
    model_year: "",
    serial_number: "",
    vin: "",
    license_plate: "",
    asset_tag: "",
    barcode: "",
    qr_code: "",
    ownership_type: equipment.ownershipType,
    vendor_id: "",
    owner_name: "",
    lease_start_date: "",
    lease_end_date: "",
    rental_start_date: "",
    rental_end_date: "",
    rental_agreement_number: "",
    current_location_type: equipment.currentLocationType || "",
    current_location_name: equipment.currentLocationName || "",
    assigned_job_id: "",
    assigned_employee_id: "",
    assigned_crew_id: "",
    assigned_at: "",
    expected_return_date: "",
    purchase_date: "",
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
    warranty_expiration_date: "",
    hourly_internal_cost: String(equipment.effectiveInternalHourlyCost),
    hourly_billable_rate: String(equipment.hourlyBillableRate),
    daily_internal_cost: "0",
    daily_billable_rate: "0",
    fuel_type: "",
    estimated_fuel_cost_per_hour: "0",
    maintenance_cost_per_hour: "0",
    insurance_cost_per_hour: "0",
    other_operating_cost_per_hour: "0",
    meter_type: "",
    current_meter_reading: "0",
    meter_unit: "",
    last_meter_updated_at: "",
    lifetime_hours: "0",
    lifetime_miles: "0",
    maintenance_status: equipment.maintenanceStatus,
    last_service_date: "",
    next_service_date: equipment.nextServiceDate || "",
    last_service_meter: "0",
    next_service_meter: "0",
    service_interval_days: "",
    service_interval_meter: "",
    maintenance_notes: "",
    registration_expiration_date: "",
    inspection_expiration_date: "",
    insurance_expiration_date: "",
    certification_expiration_date: "",
    requires_operator_certification: false,
    required_certification_type: "",
    safety_notes: "",
    default_cost_code_id: equipment.defaultCostCodeId || "",
    default_unit_of_measure: "",
    default_quantity: "1",
    taxable: false,
    criticality_level: equipment.criticalityLevel,
    utilization_target_percent: "",
    replacement_priority: equipment.replacementPriority,
    replacement_score: "",
    condition_score: "",
    reliability_score: "",
    ai_notes: "",
    notes: "",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        <Link href="/equipment" className="text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">Equipment</Link>
        <span>/</span>
        <span>{equipment.equipmentNumber}</span>
      </div>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-medium)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{equipment.equipmentNumber}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{equipment.name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={equipment.status} />
              <Badge tone="neutral">{equipment.ownershipType.replace(/_/g, " ")}</Badge>
            </div>
          </div>

          <Link href={`/equipment/${equipment.id}/edit`} className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">Edit Equipment</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<span>C</span>} label="Effective Hourly Cost" value={formatUsdCurrency(calculations.effectiveInternalHourlyCost)} context={`Margin ${formatPercent(calculations.hourlyMarginPercentage)}`} tone="brand" />
        <SummaryCard icon={<span>B</span>} label="Billable Rate" value={formatUsdCurrency(calculations.hourlyMarginPercentage >= 0 ? Number(equipment.hourlyBillableRate) : Number(equipment.hourlyBillableRate))} context={`Gross margin ${formatUsdCurrency(calculations.hourlyGrossMargin)}`} tone="info" />
        <SummaryCard icon={<span>P</span>} label="Purchase Price" value={formatUsdCurrency(equipment.purchasePrice)} context={`Current value ${formatUsdCurrency(equipment.currentValue)}`} tone="warning" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Equipment number" value={equipment.equipmentNumber} />
            <InfoRow label="Name" value={equipment.name} />
            <InfoRow label="Equipment type" value={equipment.equipmentType} />
            <InfoRow label="Manufacturer" value={equipment.manufacturer} />
            <InfoRow label="Model" value={equipment.model} />
            <InfoRow label="Ownership" value={equipment.ownershipType} />
            <InfoRow label="Current location" value={equipment.currentLocationType} />
            <InfoRow label="Location name" value={equipment.currentLocationName} />
            <InfoRow label="Vendor" value={vendorName} />
            <InfoRow label="Default cost code" value={defaultCostCodeLabel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Financial</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Purchase price" value={formatUsdCurrency(equipment.purchasePrice)} />
            <InfoRow label="Current value" value={formatUsdCurrency(equipment.currentValue)} />
            <InfoRow label="Effective internal cost" value={formatUsdCurrency(calculations.effectiveInternalHourlyCost)} />
            <InfoRow label="Billable hourly rate" value={formatUsdCurrency(equipment.hourlyBillableRate)} />
            <InfoRow label="Gross margin per hour" value={formatUsdCurrency(calculations.hourlyGrossMargin)} />
            <InfoRow label="Margin percentage" value={formatPercent(calculations.hourlyMarginPercentage)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Maintenance</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Maintenance status" value={equipment.maintenanceStatus} />
            <InfoRow label="Next service date" value={equipment.nextServiceDate} />
            <InfoRow label="Updated" value={new Date(equipment.updatedAt).toLocaleString()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lifecycle</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Criticality" value={equipment.criticalityLevel} />
            <InfoRow label="Replacement priority" value={equipment.replacementPriority} />
            <InfoRow label="Estimated current value" value={formatUsdCurrency(calculations.estimatedCurrentBookValue)} />
          </CardContent>
        </Card>
      </section>
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
