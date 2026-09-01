"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CostCodesFilters, CostCodesTable } from "@/components/cost-codes";
import { EmptyState, ErrorState, PageHeader, SkeletonLoader, SummaryCard } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  type CostCodeListItem,
  type CostCodeSortKey,
  type CostCodeStatus,
} from "@/lib/cost-codes";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const PAGE_SIZE = 10;

type CostCodeQueryRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  division: string | null;
  category: string | null;
  trade: string | null;
  parent_cost_code_id: string | null;
  budget: number;
  committed_cost: number;
  actual_cost: number;
  created_at: string;
};

export function CostCodesListClient() {
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [items, setItems] = useState<CostCodeListItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CostCodeStatus | "all">("all");
  const [division, setDivision] = useState("");
  const [hierarchyMode, setHierarchyMode] = useState<"all" | "parent" | "child">("all");
  const [sortBy, setSortBy] = useState<CostCodeSortKey>("code_asc");
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
          .from("cost_codes")
          .select(
            "id, code, name, status, division, category, trade, parent_cost_code_id, budget, committed_cost, actual_cost, created_at",
            { count: "exact" },
          )
          .eq("company_id", workspace.context.companyId);

        if (query.trim()) {
          const sanitizedQuery = query.trim().replace(/,/g, " ");
          request = request.or(
            `code.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%,division.ilike.%${sanitizedQuery}%,category.ilike.%${sanitizedQuery}%,trade.ilike.%${sanitizedQuery}%`,
          );
        }

        if (status !== "all") {
          request = request.eq("status", status);
        }

        if (division.trim()) {
          request = request.ilike("division", `%${division.trim()}%`);
        }

        if (hierarchyMode === "parent") {
          request = request.is("parent_cost_code_id", null);
        }

        if (hierarchyMode === "child") {
          request = request.not("parent_cost_code_id", "is", null);
        }

        switch (sortBy) {
          case "name_asc":
            request = request.order("name", { ascending: true });
            break;
          case "status_asc":
            request = request.order("status", { ascending: true }).order("code", { ascending: true });
            break;
          case "budget_desc":
            request = request.order("budget", { ascending: false });
            break;
          case "actual_cost_desc":
            request = request.order("actual_cost", { ascending: false });
            break;
          case "created_at_desc":
            request = request.order("created_at", { ascending: false });
            break;
          case "code_asc":
          default:
            request = request.order("code", { ascending: true });
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

        const rows = (data ?? []) as CostCodeQueryRow[];

        const parentIds = Array.from(
          new Set(
            rows
              .map((row) => row.parent_cost_code_id)
              .filter((value): value is string => Boolean(value)),
          ),
        );

        const rowIds = rows.map((row) => row.id);
        const parentMap: Record<string, string> = {};
        const hasChildrenSet = new Set<string>();

        if (parentIds.length > 0) {
          const { data: parentRows, error: parentError } = await supabase
            .from("cost_codes")
            .select("id, code, name")
            .eq("company_id", workspace.context.companyId)
            .in("id", parentIds);

          if (!parentError) {
            for (const parent of parentRows ?? []) {
              parentMap[parent.id] = `${parent.code} ${parent.name}`;
            }
          }
        }

        if (rowIds.length > 0) {
          const { data: childRows, error: childError } = await supabase
            .from("cost_codes")
            .select("parent_cost_code_id")
            .eq("company_id", workspace.context.companyId)
            .in("parent_cost_code_id", rowIds);

          if (!childError) {
            for (const child of childRows ?? []) {
              if (child.parent_cost_code_id) {
                hasChildrenSet.add(child.parent_cost_code_id);
              }
            }
          }
        }

        const mapped = rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          status: row.status as CostCodeStatus,
          division: row.division,
          category: row.category,
          trade: row.trade,
          parentCostCodeId: row.parent_cost_code_id,
          parentLabel: row.parent_cost_code_id ? parentMap[row.parent_cost_code_id] || null : null,
          hasChildren: hasChildrenSet.has(row.id),
          budget: row.budget,
          committedCost: row.committed_cost,
          actualCost: row.actual_cost,
          createdAt: row.created_at,
        }));

        setItems(mapped);
        setTotal(count || 0);
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load cost codes.");
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
  }, [division, hierarchyMode, page, query, sortBy, status, supabase]);

  const activeFilters = useMemo(() => {
    let count = 0;

    if (query.trim()) {
      count += 1;
    }

    if (status !== "all") {
      count += 1;
    }

    if (division.trim()) {
      count += 1;
    }

    if (hierarchyMode !== "all") {
      count += 1;
    }

    return count;
  }, [division, hierarchyMode, query, status]);

  const summary = useMemo(() => {
    const totalBudget = items.reduce((sum, item) => sum + item.budget, 0);
    const totalCommitted = items.reduce((sum, item) => sum + item.committedCost, 0);
    const totalActual = items.reduce((sum, item) => sum + item.actualCost, 0);

    return {
      totalBudget,
      totalCommitted,
      totalActual,
      remainingBudget: totalBudget - totalActual,
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
    return <ErrorState title="Unable to load cost codes" description={errorMessage} />;
  }

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        eyebrow="Cost Controls"
        title="Cost Codes"
        description={`Manage budget structure and defaults for ${companyName || "your company"}.`}
        primaryAction={
          <Link href="/cost-codes/new" className={getButtonClassName({})}><Plus size={16} />
              New cost code</Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-4">
        <SummaryCard icon={<span>C</span>} label="Total loaded" value={String(total)} context="Across current filters" tone="brand" />
        <SummaryCard icon={<span>B</span>} label="Budget in view" value={`$${summary.totalBudget.toFixed(2)}`} context="Planned total" tone="info" />
        <SummaryCard icon={<span>M</span>} label="Committed in view" value={`$${summary.totalCommitted.toFixed(2)}`} context="Committed obligations" tone="warning" />
        <SummaryCard icon={<span>A</span>} label="Actual in view" value={`$${summary.totalActual.toFixed(2)}`} context={`Remaining: $${summary.remainingBudget.toFixed(2)}`} tone="neutral" />
      </section>

      <CostCodesFilters
        query={query}
        status={status}
        division={division}
        hierarchyMode={hierarchyMode}
        sortBy={sortBy}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        onDivisionChange={(value) => {
          setDivision(value);
          setPage(1);
        }}
        onHierarchyModeChange={(value) => {
          setHierarchyMode(value);
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
          title="No cost codes found"
          description="Try different filters or create your first cost code."
          action={
            <Link href="/cost-codes/new" className={getButtonClassName({})}>New cost code</Link>
          }
        />
      ) : (
        <CostCodesTable
          items={items}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={(nextPage) => {
            const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
            setPage(Math.min(Math.max(nextPage, 1), maxPage));
          }}
        />
      )}
    </div>
  );
}
