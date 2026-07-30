"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EquipmentFilters, EquipmentTable } from "@/components/equipment";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonLoader, SummaryCard } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  type CriticalityLevel,
  type CurrentLocationType,
  type EquipmentCostCodeOption,
  type EquipmentListItem,
  type EquipmentSortKey,
  type EquipmentStatus,
  type EquipmentType,
  type EquipmentVendorOption,
  type MaintenanceStatus,
  type OwnershipType,
  type ReplacementPriority,
  equipmentRowToListItem,
} from "@/lib/equipment";
import { formatPercent, formatUsdCurrency } from "@/lib/equipment/validation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const PAGE_SIZE = 10;

export function EquipmentListClient() {
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [items, setItems] = useState<EquipmentListItem[]>([]);
  const [vendorOptions, setVendorOptions] = useState<EquipmentVendorOption[]>([]);
  const [costCodeOptions, setCostCodeOptions] = useState<EquipmentCostCodeOption[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<EquipmentStatus | "all">("all");
  const [equipmentType, setEquipmentType] = useState<EquipmentType | "all">("all");
  const [category, setCategory] = useState("");
  const [ownershipType, setOwnershipType] = useState<OwnershipType | "all">("all");
  const [vendorId, setVendorId] = useState("");
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | "all">("all");
  const [locationType, setLocationType] = useState<CurrentLocationType | "all">("all");
  const [defaultCostCodeId, setDefaultCostCodeId] = useState("");
  const [criticalityLevel, setCriticalityLevel] = useState<CriticalityLevel | "all">("all");
  const [replacementPriority, setReplacementPriority] = useState<ReplacementPriority | "all">("all");
  const [sortBy, setSortBy] = useState<EquipmentSortKey>("equipment_number_asc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      if (!supabase) {
        if (active) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
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

        const [{ data: vendorData }, { data: costCodeData }] = await Promise.all([
          supabase.from("vendors").select("id, display_name, company_name, first_name, last_name").eq("company_id", workspace.context.companyId).order("display_name", { ascending: true }),
          supabase.from("cost_codes").select("id, code, name").eq("company_id", workspace.context.companyId).order("code", { ascending: true }),
        ]);

        if (!active) {
          return;
        }

        const mappedVendors = (vendorData ?? []).map((row) => ({
          id: row.id,
          displayName: row.display_name || row.company_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.id,
        }));
        const vendorMap = mappedVendors.reduce<Record<string, string>>((acc, row) => {
          acc[row.id] = row.displayName;
          return acc;
        }, {});

        const mappedCostCodes = (costCodeData ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name }));
        const costCodeMap = mappedCostCodes.reduce<Record<string, string>>((acc, row) => {
          acc[row.id] = `${row.code} ${row.name}`;
          return acc;
        }, {});

        setVendorOptions(mappedVendors);
        setCostCodeOptions(mappedCostCodes);

        let request = supabase
          .from("equipment")
          .select(
            "id, equipment_number, name, equipment_type, manufacturer, model, ownership_type, current_location_type, current_location_name, effective_internal_hourly_cost, hourly_billable_rate, maintenance_status, status, next_service_date, purchase_price, current_value, default_cost_code_id, criticality_level, replacement_priority, vendor_id, updated_at",
            { count: "exact" },
          )
          .eq("company_id", workspace.context.companyId);

        if (query.trim()) {
          const sanitizedQuery = query.trim().replace(/,/g, " ");
          request = request.or(
            `equipment_number.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%,manufacturer.ilike.%${sanitizedQuery}%,model.ilike.%${sanitizedQuery}%,serial_number.ilike.%${sanitizedQuery}%,asset_tag.ilike.%${sanitizedQuery}%`,
          );
        }

        if (status !== "all") {
          request = request.eq("status", status);
        }

        if (equipmentType !== "all") {
          request = request.eq("equipment_type", equipmentType);
        }

        if (category.trim()) {
          request = request.ilike("category", `%${category.trim()}%`);
        }

        if (ownershipType !== "all") {
          request = request.eq("ownership_type", ownershipType);
        }

        if (vendorId) {
          request = request.eq("vendor_id", vendorId);
        }

        if (maintenanceStatus !== "all") {
          request = request.eq("maintenance_status", maintenanceStatus);
        }

        if (locationType !== "all") {
          request = request.eq("current_location_type", locationType);
        }

        if (defaultCostCodeId) {
          request = request.eq("default_cost_code_id", defaultCostCodeId);
        }

        if (criticalityLevel !== "all") {
          request = request.eq("criticality_level", criticalityLevel);
        }

        if (replacementPriority !== "all") {
          request = request.eq("replacement_priority", replacementPriority);
        }

        switch (sortBy) {
          case "name_asc":
            request = request.order("name", { ascending: true }).order("equipment_number", { ascending: true });
            break;
          case "equipment_type_asc":
            request = request.order("equipment_type", { ascending: true, nullsFirst: false }).order("name", { ascending: true });
            break;
          case "manufacturer_asc":
            request = request.order("manufacturer", { ascending: true, nullsFirst: false }).order("name", { ascending: true });
            break;
          case "purchase_price_desc":
            request = request.order("purchase_price", { ascending: false });
            break;
          case "current_value_desc":
            request = request.order("current_value", { ascending: false });
            break;
          case "effective_internal_hourly_cost_desc":
            request = request.order("effective_internal_hourly_cost", { ascending: false });
            break;
          case "hourly_billable_rate_desc":
            request = request.order("hourly_billable_rate", { ascending: false });
            break;
          case "maintenance_status_asc":
            request = request.order("maintenance_status", { ascending: true }).order("equipment_number", { ascending: true });
            break;
          case "next_service_date_asc":
            request = request.order("next_service_date", { ascending: true, nullsFirst: false }).order("equipment_number", { ascending: true });
            break;
          case "updated_at_desc":
            request = request.order("updated_at", { ascending: false });
            break;
          case "equipment_number_asc":
          default:
            request = request.order("equipment_number", { ascending: true });
            break;
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, count, error } = await request.range(from, to);

        if (error) {
          if (active) {
            setErrorMessage(error.message);
            setIsLoading(false);
          }
          return;
        }

        if (!active) {
          return;
        }

        const mapped = (data ?? []).map((row) => equipmentRowToListItem(row, {
          defaultCostCodeLabel: row.default_cost_code_id ? costCodeMap[row.default_cost_code_id] || null : null,
          vendorName: row.vendor_id ? vendorMap[row.vendor_id] || null : null,
        }));

        setItems(mapped);
        setTotal(count || 0);
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
  }, [category, criticalityLevel, defaultCostCodeId, equipmentType, locationType, ownershipType, page, query, replacementPriority, sortBy, status, supabase, vendorId, maintenanceStatus]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (query.trim()) count += 1;
    if (status !== "all") count += 1;
    if (equipmentType !== "all") count += 1;
    if (category.trim()) count += 1;
    if (ownershipType !== "all") count += 1;
    if (vendorId) count += 1;
    if (maintenanceStatus !== "all") count += 1;
    if (locationType !== "all") count += 1;
    if (defaultCostCodeId) count += 1;
    if (criticalityLevel !== "all") count += 1;
    if (replacementPriority !== "all") count += 1;
    return count;
  }, [category, criticalityLevel, defaultCostCodeId, equipmentType, locationType, maintenanceStatus, ownershipType, query, replacementPriority, status, vendorId]);

  const summary = useMemo(() => {
    const activeCount = items.filter((item) => item.status === "active").length;
    const maintenanceDue = items.filter((item) => item.maintenanceStatus === "due_soon" || item.maintenanceStatus === "overdue").length;
    const avg = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, current) => sum + current, 0) / values.length);

    return {
      activeCount,
      maintenanceDue,
      avgHourlyCost: avg(items.map((item) => item.effectiveInternalHourlyCost)),
      avgBillableRate: avg(items.map((item) => item.hourlyBillableRate)),
    };
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipment"
        title="Equipment Directory"
        description={`Track company-owned, rented, and leased assets for ${companyName || "your company"}.`}
        primaryAction={
          <Link href="/equipment/new">
            <Button size="lg"><Plus size={16} /> New Equipment</Button>
          </Link>
        }
      />

      {isLoading ? <SkeletonLoader className="h-40 w-full" /> : null}
      {!isLoading && errorMessage ? <ErrorState title="Unable to load equipment" description={errorMessage} /> : null}
      {!isLoading && !errorMessage && items.length === 0 ? (
        <EmptyState
          title="No equipment yet"
          description="Create your first equipment record to track ownership, maintenance, and pricing."
          action={<Link href="/equipment/new"><Button size="lg"><Plus size={16} /> Add Equipment</Button></Link>}
        />
      ) : null}

      {!isLoading && !errorMessage && items.length > 0 ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={<span>A</span>} label="Active Equipment" value={String(summary.activeCount)} context="Available in directory" tone="brand" />
            <SummaryCard icon={<span>M</span>} label="Maintenance Due" value={String(summary.maintenanceDue)} context="Due soon or overdue" tone="warning" />
            <SummaryCard icon={<span>H</span>} label="Avg Internal Cost" value={formatUsdCurrency(summary.avgHourlyCost)} context="Per hour" tone="info" />
            <SummaryCard icon={<span>B</span>} label="Avg Billable Rate" value={formatUsdCurrency(summary.avgBillableRate)} context={`Markup ${formatPercent(summary.avgBillableRate > 0 ? ((summary.avgBillableRate - summary.avgHourlyCost) / summary.avgBillableRate) * 100 : 0)}`} tone="success" />
          </section>

          <EquipmentFilters
            query={query}
            status={status}
            equipmentType={equipmentType}
            category={category}
            ownershipType={ownershipType}
            vendorId={vendorId}
            maintenanceStatus={maintenanceStatus}
            locationType={locationType}
            defaultCostCodeId={defaultCostCodeId}
            criticalityLevel={criticalityLevel}
            replacementPriority={replacementPriority}
            sortBy={sortBy}
            vendorOptions={vendorOptions}
            costCodeOptions={costCodeOptions}
            onQueryChange={(value) => { setQuery(value); setPage(1); }}
            onStatusChange={(value) => { setStatus(value); setPage(1); }}
            onEquipmentTypeChange={(value) => { setEquipmentType(value); setPage(1); }}
            onCategoryChange={(value) => { setCategory(value); setPage(1); }}
            onOwnershipTypeChange={(value) => { setOwnershipType(value); setPage(1); }}
            onVendorChange={(value) => { setVendorId(value); setPage(1); }}
            onMaintenanceStatusChange={(value) => { setMaintenanceStatus(value); setPage(1); }}
            onLocationTypeChange={(value) => { setLocationType(value); setPage(1); }}
            onDefaultCostCodeChange={(value) => { setDefaultCostCodeId(value); setPage(1); }}
            onCriticalityLevelChange={(value) => { setCriticalityLevel(value); setPage(1); }}
            onReplacementPriorityChange={(value) => { setReplacementPriority(value); setPage(1); }}
            onSortByChange={(value) => { setSortBy(value); setPage(1); }}
            activeFilters={activeFilters}
          />

          <EquipmentTable items={items} total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      ) : null}
    </div>
  );
}
