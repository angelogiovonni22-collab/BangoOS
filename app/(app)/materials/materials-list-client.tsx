"use client";

import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MaterialsFilters, MaterialsTable } from "@/components/materials";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonLoader, SummaryCard } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  type MaterialListItem,
  type MaterialSortKey,
  type MaterialStatus,
} from "@/lib/materials";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const PAGE_SIZE = 10;

type MaterialQueryRow = {
  id: string;
  material_code: string;
  name: string;
  category: string | null;
  trade: string | null;
  status: string;
  unit_of_measure: string;
  standard_cost: number;
  current_stock: number;
  reorder_point: number;
  track_inventory: boolean;
  preferred_vendor_id: string | null;
  created_at: string;
};

export function MaterialsListClient() {
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [items, setItems] = useState<MaterialListItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MaterialStatus | "all">("all");
  const [inventoryMode, setInventoryMode] = useState<"all" | "tracked" | "not_tracked">("all");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<MaterialSortKey>("name_asc");
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

        let request = supabase
          .from("materials")
          .select(
            "id, material_code, name, category, trade, status, unit_of_measure, standard_cost, current_stock, reorder_point, track_inventory, preferred_vendor_id, created_at",
            { count: "exact" },
          )
          .eq("company_id", workspace.context.companyId);

        if (query.trim()) {
          const sanitizedQuery = query.trim().replace(/,/g, " ");
          request = request.or(
            `material_code.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%,category.ilike.%${sanitizedQuery}%,trade.ilike.%${sanitizedQuery}%`,
          );
        }

        if (status !== "all") {
          request = request.eq("status", status);
        }

        if (inventoryMode === "tracked") {
          request = request.eq("track_inventory", true);
        }

        if (inventoryMode === "not_tracked") {
          request = request.eq("track_inventory", false);
        }

        if (category.trim()) {
          request = request.ilike("category", `%${category.trim()}%`);
        }

        switch (sortBy) {
          case "material_code_asc":
            request = request.order("material_code", { ascending: true });
            break;
          case "status_asc":
            request = request.order("status", { ascending: true }).order("name", { ascending: true });
            break;
          case "current_stock_desc":
            request = request.order("current_stock", { ascending: false });
            break;
          case "standard_cost_desc":
            request = request.order("standard_cost", { ascending: false });
            break;
          case "created_at_desc":
            request = request.order("created_at", { ascending: false });
            break;
          case "name_asc":
          default:
            request = request.order("name", { ascending: true });
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

        const rows = (data ?? []) as MaterialQueryRow[];
        const vendorIds = Array.from(
          new Set(
            rows
              .map((row) => row.preferred_vendor_id)
              .filter((value): value is string => Boolean(value)),
          ),
        );

        const vendorMap: Record<string, string> = {};

        if (vendorIds.length > 0) {
          const { data: vendorData, error: vendorError } = await supabase
            .from("vendors")
            .select("id, display_name")
            .eq("company_id", workspace.context.companyId)
            .in("id", vendorIds);

          if (!vendorError) {
            for (const vendor of vendorData ?? []) {
              vendorMap[vendor.id] = vendor.display_name;
            }
          }
        }

        const mapped = rows.map((row) => ({
          id: row.id,
          materialCode: row.material_code,
          name: row.name,
          category: row.category,
          trade: row.trade,
          status: row.status as MaterialStatus,
          unitOfMeasure: row.unit_of_measure,
          standardCost: row.standard_cost,
          currentStock: row.current_stock,
          reorderPoint: row.reorder_point,
          trackInventory: row.track_inventory,
          preferredVendorId: row.preferred_vendor_id,
          preferredVendorName: row.preferred_vendor_id ? vendorMap[row.preferred_vendor_id] || null : null,
          createdAt: row.created_at,
        }));

        setItems(mapped);
        setTotal(count || 0);
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load materials.");
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
  }, [category, inventoryMode, page, query, sortBy, status, supabase]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeFilters = useMemo(() => {
    let count = 0;

    if (query.trim()) {
      count += 1;
    }

    if (status !== "all") {
      count += 1;
    }

    if (inventoryMode !== "all") {
      count += 1;
    }

    if (category.trim()) {
      count += 1;
    }

    return count;
  }, [category, inventoryMode, query, status]);

  const summary = useMemo(() => {
    const tracked = items.filter((item) => item.trackInventory).length;
    const lowStock = items.filter((item) => item.trackInventory && item.currentStock <= item.reorderPoint).length;
    const avgCost = items.length > 0
      ? items.reduce((totalCost, item) => totalCost + item.standardCost, 0) / items.length
      : 0;

    return {
      tracked,
      lowStock,
      avgCost,
    };
  }, [items]);

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
    return <ErrorState title="Unable to load materials" description={errorMessage} />;
  }

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        eyebrow="Materials"
        title="Materials Management"
        description={`Manage material catalog, costs, and inventory for ${companyName || "your company"}.`}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <Link href="/materials/price-lists">
              <Button variant="outline"><FileSpreadsheet size={16} />Supplier Price Lists</Button>
            </Link>
            <Link href="/materials/procurement">
              <Button variant="outline">Procurement Workflow</Button>
            </Link>
            <Link href="/materials/new">
              <Button>
                <Plus size={16} />
                New material
              </Button>
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<span>M</span>} label="Total loaded" value={String(total)} context="Across current filters" tone="brand" />
        <SummaryCard icon={<span>S</span>} label="Inventory tracked" value={String(summary.tracked)} context="Items with stock tracking" tone="info" />
        <SummaryCard icon={<span>C</span>} label="Average cost" value={summary.avgCost > 0 ? `$${summary.avgCost.toFixed(2)}` : "$0.00"} context={`Low stock in view: ${summary.lowStock}`} tone="warning" />
      </section>

      <MaterialsFilters
        query={query}
        status={status}
        inventoryMode={inventoryMode}
        category={category}
        sortBy={sortBy}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        onInventoryModeChange={(value) => {
          setInventoryMode(value);
          setPage(1);
        }}
        onCategoryChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
        onSortByChange={(value) => {
          setSortBy(value);
          setPage(1);
        }}
        activeFilters={activeFilters}
      />

      {items.length === 0 ? (
        <EmptyState
          title="No materials found"
          description="Try different filters or create your first material record."
          action={
            <Link href="/materials/new">
              <Button>New material</Button>
            </Link>
          }
        />
      ) : (
        <MaterialsTable
          items={items}
          total={total}
          page={Math.min(page, totalPages)}
          pageSize={PAGE_SIZE}
          onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
        />
      )}
    </div>
  );
}
