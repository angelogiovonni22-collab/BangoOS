"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EquipmentFilters, EquipmentTable } from "@/components/equipment";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, PageHeader, PartialDataNotice, Select, SkeletonLoader, SummaryCard, getButtonClassName } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  buildEquipmentQueryPlan,
  buildFleetGridRows,
  buildFleetOrionRecommendations,
  buildFleetSummaryMetrics,
  EQUIPMENT_SAVED_VIEWS_STORAGE_KEY,
  equipmentRowToListItem,
  readSavedEquipmentViews,
  type CriticalityLevel,
  type CurrentLocationType,
  type EquipmentCostCodeOption,
  type EquipmentListItem,
  type EquipmentSortKey,
  type EquipmentStatus,
  type EquipmentType,
  type EquipmentVendorOption,
  type FleetGridRow,
  type MaintenanceStatus,
  type OwnershipType,
  type ReplacementPriority,
  writeSavedEquipmentViews,
} from "@/lib/equipment";
import { formatPercent, formatUsdCurrency } from "@/lib/equipment/validation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";

const PAGE_SIZE = 10;

type EquipmentSavedView = {
  id: string;
  name: string;
  query: string;
  status: EquipmentStatus | "all";
  equipmentType: EquipmentType | "all";
  category: string;
  assignedJobId: string;
  assignedEmployeeId: string;
  ownershipType: OwnershipType | "all";
  vendorId: string;
  maintenanceStatus: MaintenanceStatus | "all";
  locationType: CurrentLocationType | "all";
  defaultCostCodeId: string;
  criticalityLevel: CriticalityLevel | "all";
  replacementPriority: ReplacementPriority | "all";
  sortBy: EquipmentSortKey;
};

export function EquipmentListClient() {
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const [items, setItems] = useState<EquipmentListItem[]>([]);
  const [rows, setRows] = useState<FleetGridRow[]>([]);
  const [vendorOptions, setVendorOptions] = useState<EquipmentVendorOption[]>([]);
  const [costCodeOptions, setCostCodeOptions] = useState<EquipmentCostCodeOption[]>([]);
  const [projectNameById, setProjectNameById] = useState<Record<string, string>>({});
  const [employeeNameById, setEmployeeNameById] = useState<Record<string, string>>({});

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<EquipmentStatus | "all">("all");
  const [equipmentType, setEquipmentType] = useState<EquipmentType | "all">("all");
  const [category, setCategory] = useState("");
  const [assignedJobId, setAssignedJobId] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
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

  const [savedViews, setSavedViews] = useState<EquipmentSavedView[]>(() => {
    return readSavedEquipmentViews(typeof window === "undefined" ? null : window.localStorage, EQUIPMENT_SAVED_VIEWS_STORAGE_KEY) as EquipmentSavedView[];
  });
  const [savedViewId, setSavedViewId] = useState("");

  useEffect(() => {
    writeSavedEquipmentViews(typeof window === "undefined" ? null : window.localStorage, savedViews, EQUIPMENT_SAVED_VIEWS_STORAGE_KEY);
  }, [savedViews]);

  useEffect(() => {
    let active = true;

    const loadWorkspaceAndReferences = async () => {
      if (!supabase) {
        if (active) {
          setWorkspaceError("Unable to connect right now. Please try again shortly.");
        }
        return;
      }

      const workspaceResult = await resolveWorkspaceContext(supabase);

      if (!workspaceResult.context) {
        if (active) {
          setWorkspaceError(workspaceResult.errorMessage || "Unable to verify your workspace.");
        }
        return;
      }

      const context = workspaceResult.context;

      const [{ data: vendorData }, { data: costCodeData }, { data: projectData }, { data: profileData }] = await Promise.all([
        supabase.from("vendors").select("id, display_name, company_name, first_name, last_name").eq("company_id", context.companyId).order("display_name", { ascending: true }),
        supabase.from("cost_codes").select("id, code, name").eq("company_id", context.companyId).order("code", { ascending: true }),
        supabase.from("projects").select("id, name").eq("company_id", context.companyId),
        supabase.from("profiles").select("id, first_name, last_name").eq("company_id", context.companyId),
      ]);

      if (!active) {
        return;
      }

      setWorkspace(context);

      setVendorOptions((vendorData ?? []).map((row) => ({
        id: row.id,
        displayName: row.display_name || row.company_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.id,
      })));

      setCostCodeOptions((costCodeData ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name })));

      setProjectNameById((projectData ?? []).reduce<Record<string, string>>((acc, row) => {
        acc[row.id] = row.name;
        return acc;
      }, {}));

      setEmployeeNameById((profileData ?? []).reduce<Record<string, string>>((acc, row) => {
        const fullName = [row.first_name?.trim() || "", row.last_name?.trim() || ""].filter(Boolean).join(" ");
        acc[row.id] = fullName || row.id;
        return acc;
      }, {}));
    };

    void loadWorkspaceAndReferences();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const loadEquipment = async () => {
      if (!workspace || !supabase) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const vendorMap = vendorOptions.reduce<Record<string, string>>((acc, row) => {
        acc[row.id] = row.displayName;
        return acc;
      }, {});

      const costCodeMap = costCodeOptions.reduce<Record<string, string>>((acc, row) => {
        acc[row.id] = `${row.code} ${row.name}`;
        return acc;
      }, {});

      let request = supabase
        .from("equipment")
        .select(
          "id, equipment_number, name, equipment_type, category, manufacturer, model, model_year, serial_number, ownership_type, current_location_type, current_location_name, assigned_job_id, assigned_employee_id, assigned_crew_id, assigned_at, expected_return_date, effective_internal_hourly_cost, hourly_billable_rate, maintenance_status, status, last_service_date, next_service_date, inspection_expiration_date, warranty_expiration_date, registration_expiration_date, insurance_expiration_date, certification_expiration_date, qr_code, purchase_date, purchase_price, current_value, meter_type, current_meter_reading, lifetime_hours, lifetime_miles, utilization_target_percent, condition_score, fuel_type, maintenance_notes, notes, default_cost_code_id, vendor_id, criticality_level, replacement_priority, created_at, updated_at",
          { count: "exact" },
        )
        .eq("company_id", workspace.companyId);

      const queryPlan = buildEquipmentQueryPlan({
        query,
        status,
        equipmentType,
        category,
        ownershipType,
        vendorId,
        maintenanceStatus,
        locationType,
        defaultCostCodeId,
        criticalityLevel,
        replacementPriority,
        assignedJobId,
        assignedEmployeeId,
        sortBy,
      });

      if (queryPlan.searchOr) {
        request = request.or(queryPlan.searchOr);
      }

      for (const match of queryPlan.equals) {
        request = request.eq(match.column, match.value);
      }

      for (const match of queryPlan.ilike) {
        request = request.ilike(match.column, match.value);
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

      if (!active) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      const mapped = (data ?? []).map((row) => equipmentRowToListItem(row, {
        defaultCostCodeLabel: row.default_cost_code_id ? costCodeMap[row.default_cost_code_id] || null : null,
        vendorName: row.vendor_id ? vendorMap[row.vendor_id] || null : null,
      }));

      setItems(mapped);
      setRows(buildFleetGridRows(mapped, projectNameById, employeeNameById));
      setTotal(count || 0);
      setIsLoading(false);
    };

    void loadEquipment();

    return () => {
      active = false;
    };
  }, [workspace, supabase, query, status, equipmentType, category, ownershipType, vendorId, maintenanceStatus, locationType, defaultCostCodeId, criticalityLevel, replacementPriority, assignedJobId, assignedEmployeeId, sortBy, page, vendorOptions, costCodeOptions, projectNameById, employeeNameById]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (query.trim()) count += 1;
    if (status !== "all") count += 1;
    if (equipmentType !== "all") count += 1;
    if (category.trim()) count += 1;
    if (assignedJobId) count += 1;
    if (assignedEmployeeId) count += 1;
    if (ownershipType !== "all") count += 1;
    if (vendorId) count += 1;
    if (maintenanceStatus !== "all") count += 1;
    if (locationType !== "all") count += 1;
    if (defaultCostCodeId) count += 1;
    if (criticalityLevel !== "all") count += 1;
    if (replacementPriority !== "all") count += 1;
    return count;
  }, [query, status, equipmentType, category, assignedJobId, assignedEmployeeId, ownershipType, vendorId, maintenanceStatus, locationType, defaultCostCodeId, criticalityLevel, replacementPriority]);

  const summaryMetrics = useMemo(() => buildFleetSummaryMetrics(items), [items]);
  const orionRecommendations = useMemo(() => buildFleetOrionRecommendations(items), [items]);

  const avgHourlyCost = useMemo(() => (items.length ? items.reduce((sum, item) => sum + item.effectiveInternalHourlyCost, 0) / items.length : 0), [items]);
  const avgBillableRate = useMemo(() => (items.length ? items.reduce((sum, item) => sum + item.hourlyBillableRate, 0) / items.length : 0), [items]);

  const saveCurrentView = () => {
    const name = window.prompt("Name this saved view:");

    if (!name || !name.trim()) {
      return;
    }

    const next: EquipmentSavedView = {
      id: `view-${Date.now()}`,
      name: name.trim(),
      query,
      status,
      equipmentType,
      category,
      assignedJobId,
      assignedEmployeeId,
      ownershipType,
      vendorId,
      maintenanceStatus,
      locationType,
      defaultCostCodeId,
      criticalityLevel,
      replacementPriority,
      sortBy,
    };

    setSavedViews((current) => [...current, next]);
    setSavedViewId(next.id);
  };

  const applySavedView = (viewId: string) => {
    setSavedViewId(viewId);

    const selected = savedViews.find((view) => view.id === viewId);

    if (!selected) {
      return;
    }

    setQuery(selected.query);
    setStatus(selected.status);
    setEquipmentType(selected.equipmentType);
    setCategory(selected.category);
    setAssignedJobId(selected.assignedJobId);
    setAssignedEmployeeId(selected.assignedEmployeeId);
    setOwnershipType(selected.ownershipType);
    setVendorId(selected.vendorId);
    setMaintenanceStatus(selected.maintenanceStatus);
    setLocationType(selected.locationType);
    setDefaultCostCodeId(selected.defaultCostCodeId);
    setCriticalityLevel(selected.criticalityLevel);
    setReplacementPriority(selected.replacementPriority);
    setSortBy(selected.sortBy);
    setPage(1);
  };

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        eyebrow="Equipment"
        title="Equipment & Fleet Intelligence"
        description={`Central operating system for company assets in ${companyName || "your company"}.`}
        primaryAction={
          <Link href="/equipment/new" className={getButtonClassName({ size: "lg" })}><Plus size={16} /> New Equipment</Link>
        }
      />

      {workspaceError ? <ErrorState title="Unable to load equipment" description={workspaceError} /> : null}

      <PartialDataNotice message="Historical assignment, maintenance, inspection, and document coverage reflects the records currently available for each asset." />

      {isLoading ? <SkeletonLoader className="h-40 w-full" /> : null}
      {!isLoading && errorMessage ? <ErrorState title="Unable to load equipment" description={errorMessage} /> : null}

      {!isLoading && !errorMessage && items.length === 0 ? (
        <EmptyState
          title="No equipment yet"
          description="Create your first equipment record to track fleet utilization, maintenance, and assignment intelligence."
          action={<Link href="/equipment/new" className={getButtonClassName({ size: "lg" })}><Plus size={16} /> Add Equipment</Link>}
        />
      ) : null}

      {!isLoading && !errorMessage && items.length > 0 ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {summaryMetrics.map((metric) => (
              <SummaryCard
                key={metric.id}
                icon={<span>{metric.label.charAt(0)}</span>}
                label={metric.label}
                value={String(metric.value)}
                context={metric.availability === "partial" ? "Partial" : "Live"}
                tone={metric.id === "maintenanceDue" || metric.id === "inspectionAlerts" || metric.id === "warrantyAlerts" ? "warning" : metric.id === "outOfService" ? "danger" : "brand"}
              />
            ))}
          </section>

          <Card as="section" variant="elevated">
            <CardHeader className="bg-[var(--color-surface-subtle)]/45">
              <CardTitle>Orion Equipment Brief (Read-only)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {orionRecommendations.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">No urgent equipment recommendations right now.</p>
              ) : (
                orionRecommendations.map((recommendation) => (
                  <Link key={recommendation.id} href={recommendation.href} className="block rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-3">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{recommendation.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{recommendation.reason}</p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-3">
            <label htmlFor="equipment-saved-view" className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Saved Views</label>
            <Select
              id="equipment-saved-view"
              value={savedViewId}
              onChange={(event) => applySavedView(event.target.value)}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-2 text-sm"
            >
              <option value="">Select saved view</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>{view.name}</option>
              ))}
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={saveCurrentView}>Save current view</Button>
          </div>

          <EquipmentFilters
            query={query}
            status={status}
            equipmentType={equipmentType}
            category={category}
            assignedJobId={assignedJobId}
            assignedEmployeeId={assignedEmployeeId}
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
            projectOptions={Object.entries(projectNameById).map(([id, name]) => ({ id, name }))}
            employeeOptions={Object.entries(employeeNameById).map(([id, fullName]) => ({ id, fullName }))}
            onQueryChange={(value) => { setQuery(value); setPage(1); }}
            onStatusChange={(value) => { setStatus(value); setPage(1); }}
            onEquipmentTypeChange={(value) => { setEquipmentType(value); setPage(1); }}
            onCategoryChange={(value) => { setCategory(value); setPage(1); }}
            onAssignedJobChange={(value) => { setAssignedJobId(value); setPage(1); }}
            onAssignedEmployeeChange={(value) => { setAssignedEmployeeId(value); setPage(1); }}
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

          <EquipmentTable rows={rows} total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={<span>H</span>} label="Avg Internal Cost" value={formatUsdCurrency(avgHourlyCost)} context="Per hour" tone="info" />
            <SummaryCard icon={<span>B</span>} label="Avg Billable Rate" value={formatUsdCurrency(avgBillableRate)} context={`Markup ${formatPercent(avgBillableRate > 0 ? ((avgBillableRate - avgHourlyCost) / avgBillableRate) * 100 : 0)}`} tone="success" />
          </section>
        </>
      ) : null}
    </div>
  );
}
