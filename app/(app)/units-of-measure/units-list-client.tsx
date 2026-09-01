"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { UnitFilters, UnitTable } from "@/components/units-of-measure";
import { EmptyState, ErrorState, PageHeader, SkeletonLoader, SummaryCard } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  type UnitCategory,
  type UnitListItem,
  type UnitMeasurementSystem,
  type UnitOfMeasureRow,
  type UnitSortKey,
  type UnitType,
} from "@/lib/units-of-measure";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const PAGE_SIZE = 10;

type UnitQueryRow = Pick<
  UnitOfMeasureRow,
  | "id"
  | "code"
  | "name"
  | "plural_name"
  | "symbol"
  | "category"
  | "measurement_system"
  | "unit_type"
  | "base_unit_id"
  | "conversion_factor"
  | "decimal_precision"
  | "is_system"
  | "is_active"
  | "sort_order"
  | "updated_at"
>;

export function UnitsListClient() {
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [items, setItems] = useState<UnitListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<UnitCategory | "all">("all");
  const [measurementSystem, setMeasurementSystem] = useState<UnitMeasurementSystem | "all">("all");
  const [unitType, setUnitType] = useState<UnitType | "all">("all");
  const [source, setSource] = useState<"all" | "system" | "company">("all");
  const [active, setActive] = useState<"all" | "active" | "inactive">("all");
  const [fractional, setFractional] = useState<"all" | "fractional" | "whole_only">("all");
  const [hasConversion, setHasConversion] = useState<"all" | "with_conversion" | "without_conversion">("all");
  const [baseUnitId, setBaseUnitId] = useState("");
  const [sortBy, setSortBy] = useState<UnitSortKey>("code_asc");
  const [page, setPage] = useState(1);
  const [baseUnitOptions, setBaseUnitOptions] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [summary, setSummary] = useState({
    totalAvailable: 0,
    systemUnits: 0,
    companyUnits: 0,
    activeUnits: 0,
    customUnits: 0,
    withConversions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let activeRequest = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      if (!supabase) {
        if (activeRequest) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(supabase);

        if (!workspace.context) {
          if (activeRequest) {
            setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
            setIsLoading(false);
          }
          return;
        }

        const companyId = workspace.context.companyId;

        let listRequest = supabase
          .from("units_of_measure")
          .select(
            "id, code, name, plural_name, symbol, category, measurement_system, unit_type, base_unit_id, conversion_factor, decimal_precision, is_system, is_active, sort_order, updated_at",
            { count: "exact" },
          );

        let summaryRequest = supabase
          .from("units_of_measure")
          .select("id, is_system, is_active, unit_type, base_unit_id, conversion_factor");

        let optionRequest = supabase
          .from("units_of_measure")
          .select("id, code, name")
          .order("code", { ascending: true });

        const applyScope = () => {
          if (source === "system") {
            listRequest = listRequest.eq("is_system", true).is("company_id", null);
            summaryRequest = summaryRequest.eq("is_system", true).is("company_id", null);
            optionRequest = optionRequest.eq("is_system", true).is("company_id", null);
            return;
          }

          if (source === "company") {
            listRequest = listRequest.eq("is_system", false).eq("company_id", companyId);
            summaryRequest = summaryRequest.eq("is_system", false).eq("company_id", companyId);
            optionRequest = optionRequest.eq("is_system", false).eq("company_id", companyId);
            return;
          }

          const scopeExpression = `and(is_system.eq.true,company_id.is.null),and(is_system.eq.false,company_id.eq.${companyId})`;
          listRequest = listRequest.or(scopeExpression);
          summaryRequest = summaryRequest.or(scopeExpression);
          optionRequest = optionRequest.or(scopeExpression);
        };

        applyScope();

        if (query.trim()) {
          const sanitizedQuery = query.trim().replace(/,/g, " ");
          listRequest = listRequest.or(
            `code.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%,plural_name.ilike.%${sanitizedQuery}%,symbol.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`,
          );
          summaryRequest = summaryRequest.or(
            `code.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%,plural_name.ilike.%${sanitizedQuery}%,symbol.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`,
          );
        }

        if (category !== "all") {
          listRequest = listRequest.eq("category", category);
          summaryRequest = summaryRequest.eq("category", category);
          optionRequest = optionRequest.eq("category", category);
        }

        if (measurementSystem !== "all") {
          listRequest = listRequest.eq("measurement_system", measurementSystem);
          summaryRequest = summaryRequest.eq("measurement_system", measurementSystem);
          optionRequest = optionRequest.eq("measurement_system", measurementSystem);
        }

        if (unitType !== "all") {
          listRequest = listRequest.eq("unit_type", unitType);
          summaryRequest = summaryRequest.eq("unit_type", unitType);
          optionRequest = optionRequest.eq("unit_type", unitType);
        }

        if (active !== "all") {
          listRequest = listRequest.eq("is_active", active === "active");
          summaryRequest = summaryRequest.eq("is_active", active === "active");
          optionRequest = optionRequest.eq("is_active", active === "active");
        }

        if (fractional !== "all") {
          listRequest = listRequest.eq("allow_fractional_quantity", fractional === "fractional");
          summaryRequest = summaryRequest.eq("allow_fractional_quantity", fractional === "fractional");
          optionRequest = optionRequest.eq("allow_fractional_quantity", fractional === "fractional");
        }

        if (hasConversion === "with_conversion") {
          listRequest = listRequest.not("base_unit_id", "is", null).not("conversion_factor", "is", null);
          summaryRequest = summaryRequest.not("base_unit_id", "is", null).not("conversion_factor", "is", null);
          optionRequest = optionRequest.not("base_unit_id", "is", null).not("conversion_factor", "is", null);
        }

        if (hasConversion === "without_conversion") {
          listRequest = listRequest.is("base_unit_id", null);
          summaryRequest = summaryRequest.is("base_unit_id", null);
          optionRequest = optionRequest.is("base_unit_id", null);
        }

        if (baseUnitId) {
          listRequest = listRequest.eq("base_unit_id", baseUnitId);
          summaryRequest = summaryRequest.eq("base_unit_id", baseUnitId);
          optionRequest = optionRequest.eq("base_unit_id", baseUnitId);
        }

        switch (sortBy) {
          case "name_asc":
            listRequest = listRequest.order("name", { ascending: true }).order("code", { ascending: true });
            break;
          case "category_asc":
            listRequest = listRequest.order("category", { ascending: true }).order("code", { ascending: true });
            break;
          case "measurement_system_asc":
            listRequest = listRequest.order("measurement_system", { ascending: true }).order("code", { ascending: true });
            break;
          case "unit_type_asc":
            listRequest = listRequest.order("unit_type", { ascending: true }).order("code", { ascending: true });
            break;
          case "is_system_desc":
            listRequest = listRequest.order("is_system", { ascending: false }).order("code", { ascending: true });
            break;
          case "sort_order_asc":
            listRequest = listRequest.order("sort_order", { ascending: true }).order("code", { ascending: true });
            break;
          case "updated_at_desc":
            listRequest = listRequest.order("updated_at", { ascending: false });
            break;
          case "code_asc":
          default:
            listRequest = listRequest.order("code", { ascending: true });
            break;
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const [{ data, count, error }, { data: summaryRows }, { data: optionRows }] = await Promise.all([
          listRequest.range(from, to),
          summaryRequest,
          optionRequest,
        ]);

        if (!activeRequest) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setIsLoading(false);
          return;
        }

        const rows = (data ?? []) as UnitQueryRow[];
        const baseUnitIds = Array.from(new Set(rows.map((row) => row.base_unit_id).filter((id): id is string => Boolean(id))));

        const baseUnitMap: Record<string, { code: string; name: string }> = {};

        if (baseUnitIds.length > 0) {
          const { data: baseRows } = await supabase
            .from("units_of_measure")
            .select("id, code, name")
            .in("id", baseUnitIds);

          for (const row of baseRows ?? []) {
            baseUnitMap[row.id] = { code: row.code, name: row.name };
          }
        }

        const mapped: UnitListItem[] = rows.map((row) => ({
          ...row,
          sourceLabel: row.is_system ? "System" : "Company",
          baseUnitCode: row.base_unit_id ? baseUnitMap[row.base_unit_id]?.code || null : null,
          baseUnitName: row.base_unit_id ? baseUnitMap[row.base_unit_id]?.name || null : null,
        }));

        const allRows = (summaryRows ?? []) as Array<{
          id: string;
          is_system: boolean;
          is_active: boolean;
          unit_type: string;
          base_unit_id: string | null;
          conversion_factor: number | null;
        }>;

        setSummary({
          totalAvailable: allRows.length,
          systemUnits: allRows.filter((row) => row.is_system).length,
          companyUnits: allRows.filter((row) => !row.is_system).length,
          activeUnits: allRows.filter((row) => row.is_active).length,
          customUnits: allRows.filter((row) => row.unit_type === "custom").length,
          withConversions: allRows.filter((row) => row.base_unit_id && row.conversion_factor !== null).length,
        });

        setBaseUnitOptions((optionRows ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name })));
        setItems(mapped);
        setTotal(count || 0);
      } catch (error) {
        if (activeRequest) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load units of measure.");
        }
      } finally {
        if (activeRequest) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      activeRequest = false;
    };
  }, [
    active,
    baseUnitId,
    category,
    fractional,
    hasConversion,
    measurementSystem,
    page,
    query,
    sortBy,
    source,
    supabase,
    unitType,
  ]);

  const activeFilters = useMemo(() => {
    let count = 0;

    if (query.trim()) count += 1;
    if (category !== "all") count += 1;
    if (measurementSystem !== "all") count += 1;
    if (unitType !== "all") count += 1;
    if (source !== "all") count += 1;
    if (active !== "all") count += 1;
    if (fractional !== "all") count += 1;
    if (hasConversion !== "all") count += 1;
    if (baseUnitId) count += 1;

    return count;
  }, [active, baseUnitId, category, fractional, hasConversion, measurementSystem, query, source, unitType]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-10 w-80" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-72 w-full" />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title="Unable to load units of measure" description={errorMessage} />;
  }

  if (items.length === 0 && !query.trim() && activeFilters === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Master Data"
          title="Units of Measure"
          description={`Manage system and company unit standards for ${companyName || "your company"}.`}
          primaryAction={(
            <Link href="/units-of-measure/new" className={getButtonClassName({ size: "md" })}><Plus size={16} />
                New Unit</Link>
          )}
        />
        <EmptyState
          title="No units available"
          description="Create your first company unit or apply system defaults to begin."
          action={
            <Link href="/units-of-measure/new" className={getButtonClassName({})}>Create Unit</Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master Data"
        title="Units of Measure"
        description={`Centralized unit library for ${companyName || "your company"}.`}
        primaryAction={(
          <Link href="/units-of-measure/new" className={getButtonClassName({ size: "md" })}><Plus size={16} />
              New Unit</Link>
        )}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard icon={<span>T</span>} label="Total Available Units" value={String(summary.totalAvailable)} tone="brand" compact />
        <SummaryCard icon={<span>S</span>} label="System Units" value={String(summary.systemUnits)} tone="neutral" compact />
        <SummaryCard icon={<span>C</span>} label="Company Units" value={String(summary.companyUnits)} tone="info" compact />
        <SummaryCard icon={<span>A</span>} label="Active Units" value={String(summary.activeUnits)} tone="success" compact />
        <SummaryCard icon={<span>U</span>} label="Custom Units" value={String(summary.customUnits)} tone="warning" compact />
        <SummaryCard icon={<span>V</span>} label="Units With Conversions" value={String(summary.withConversions)} tone="analytics" compact />
      </section>

      <UnitFilters
        query={query}
        category={category}
        measurementSystem={measurementSystem}
        unitType={unitType}
        source={source}
        active={active}
        fractional={fractional}
        hasConversion={hasConversion}
        baseUnitId={baseUnitId}
        sortBy={sortBy}
        baseUnitOptions={baseUnitOptions}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onCategoryChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
        onMeasurementSystemChange={(value) => {
          setMeasurementSystem(value);
          setPage(1);
        }}
        onUnitTypeChange={(value) => {
          setUnitType(value);
          setPage(1);
        }}
        onSourceChange={(value) => {
          setSource(value);
          setPage(1);
        }}
        onActiveChange={(value) => {
          setActive(value);
          setPage(1);
        }}
        onFractionalChange={(value) => {
          setFractional(value);
          setPage(1);
        }}
        onHasConversionChange={(value) => {
          setHasConversion(value);
          setPage(1);
        }}
        onBaseUnitIdChange={(value) => {
          setBaseUnitId(value);
          setPage(1);
        }}
        onSortByChange={(value) => {
          setSortBy(value);
          setPage(1);
        }}
        activeFilters={activeFilters}
      />

      {items.length === 0 ? (
        <EmptyState title="No matching units" description="Adjust your filters or add a new unit of measure." compact />
      ) : (
        <UnitTable items={items} total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}
    </div>
  );
}
