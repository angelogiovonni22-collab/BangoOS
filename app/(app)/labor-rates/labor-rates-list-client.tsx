"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LaborRatesFilters, LaborRatesTable } from "@/components/labor-rates";
import { EmptyState, ErrorState, PageHeader, SkeletonLoader, SummaryCard, getButtonClassName } from "@/components/ui";
import { useCompany } from "@/lib/company";
import { formatPercent, formatUsdCurrency, type CostCodeOption, type LaborRateListItem, type LaborRateSortKey, type LaborRateStatus, type SkillLevel, type UnionStatus, type WorkerClassification } from "@/lib/labor-rates";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const PAGE_SIZE = 10;
const TEXT_FILTER_DEBOUNCE_MS = 300;

type LaborRateQueryRow = {
  id: string; code: string; name: string; trade: string | null; position_title: string | null; skill_level: string | null; status: string; union_status: string | null; worker_classification: string | null; default_cost_code_id: string | null; base_hourly_rate: number; total_burden_hourly: number; true_hourly_cost: number; billable_hourly_rate: number; updated_at: string;
};

export function LaborRatesListClient() {
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();
  const [items, setItems] = useState<LaborRateListItem[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<LaborRateStatus | "all">("all");
  const [trade, setTrade] = useState("");
  const [debouncedTrade, setDebouncedTrade] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel | "all">("all");
  const [unionStatus, setUnionStatus] = useState<UnionStatus | "all">("all");
  const [workerClassification, setWorkerClassification] = useState<WorkerClassification | "all">("all");
  const [defaultCostCodeId, setDefaultCostCodeId] = useState("");
  const [sortBy, setSortBy] = useState<LaborRateSortKey>("code_asc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [costCodeOptions, setCostCodeOptions] = useState<CostCodeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedQuery(query); setPage(1); }, TEXT_FILTER_DEBOUNCE_MS); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedTrade(trade); setPage(1); }, TEXT_FILTER_DEBOUNCE_MS); return () => window.clearTimeout(timer); }, [trade]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setErrorMessage(null);
      if (!supabase) { if (active) { setErrorMessage("Unable to connect right now. Please try again shortly."); setIsLoading(false); } return; }
      try {
        const workspace = await resolveWorkspaceContext(supabase);
        if (!workspace.context) { if (active) { setErrorMessage(workspace.errorMessage || "Unable to verify your workspace."); setIsLoading(false); } return; }
        const { data: costCodeData } = await supabase.from("cost_codes").select("id, code, name").eq("company_id", workspace.context.companyId).order("code", { ascending: true });
        if (!active) return;
        const mappedCostCodes = (costCodeData ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name }));
        const costCodeMap = mappedCostCodes.reduce<Record<string, string>>((acc, row) => { acc[row.id] = `${row.code} ${row.name}`; return acc; }, {});
        setCostCodeOptions(mappedCostCodes);
        let request = supabase.from("labor_rates").select("id, code, name, trade, position_title, skill_level, status, union_status, worker_classification, default_cost_code_id, base_hourly_rate, total_burden_hourly, true_hourly_cost, billable_hourly_rate, updated_at", { count: "exact" }).eq("company_id", workspace.context.companyId);
        if (debouncedQuery.trim()) { const sanitizedQuery = debouncedQuery.trim().replace(/,/g, " "); request = request.or(`code.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%,trade.ilike.%${sanitizedQuery}%,position_title.ilike.%${sanitizedQuery}%,skill_level.ilike.%${sanitizedQuery}%`); }
        if (status !== "all") request = request.eq("status", status);
        if (debouncedTrade.trim()) request = request.ilike("trade", `%${debouncedTrade.trim()}%`);
        if (skillLevel !== "all") request = request.eq("skill_level", skillLevel);
        if (unionStatus !== "all") request = request.eq("union_status", unionStatus);
        if (workerClassification !== "all") request = request.eq("worker_classification", workerClassification);
        if (defaultCostCodeId) request = request.eq("default_cost_code_id", defaultCostCodeId);
        switch (sortBy) {
          case "name_asc": request = request.order("name", { ascending: true }); break;
          case "trade_asc": request = request.order("trade", { ascending: true, nullsFirst: false }).order("name", { ascending: true }); break;
          case "base_hourly_rate_desc": request = request.order("base_hourly_rate", { ascending: false }); break;
          case "true_hourly_cost_desc": request = request.order("true_hourly_cost", { ascending: false }); break;
          case "billable_hourly_rate_desc": request = request.order("billable_hourly_rate", { ascending: false }); break;
          case "updated_at_desc": request = request.order("updated_at", { ascending: false }); break;
          default: request = request.order("code", { ascending: true }); break;
        }
        const from = (page - 1) * PAGE_SIZE;
        const { data, count, error } = await request.range(from, from + PAGE_SIZE - 1);
        if (error) { if (active) setErrorMessage(error.message); return; }
        if (!active) return;
        setItems(((data ?? []) as LaborRateQueryRow[]).map((row) => ({ id: row.id, code: row.code, name: row.name, trade: row.trade, skillLevel: (row.skill_level as SkillLevel | null) || null, baseHourlyRate: row.base_hourly_rate, totalBurdenHourly: row.total_burden_hourly, trueHourlyCost: row.true_hourly_cost, billableHourlyRate: row.billable_hourly_rate, status: row.status as LaborRateStatus, unionStatus: (row.union_status as UnionStatus | null) || null, workerClassification: (row.worker_classification as WorkerClassification | null) || null, defaultCostCodeId: row.default_cost_code_id, defaultCostCodeLabel: row.default_cost_code_id ? costCodeMap[row.default_cost_code_id] || null : null, updatedAt: row.updated_at })));
        setTotal(count || 0);
      } catch (error) { if (active) setErrorMessage(error instanceof Error ? error.message : "Unable to load labor rates."); }
      finally { if (active) setIsLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [debouncedQuery, debouncedTrade, defaultCostCodeId, page, skillLevel, sortBy, status, supabase, unionStatus, workerClassification]);

  const activeFilters = useMemo(() => [query.trim(), status !== "all", trade.trim(), skillLevel !== "all", unionStatus !== "all", workerClassification !== "all", defaultCostCodeId].filter(Boolean).length, [defaultCostCodeId, query, skillLevel, status, trade, unionStatus, workerClassification]);
  const summary = useMemo(() => {
    const avg = (values:number[]) => values.length ? values.reduce((sum,current)=>sum+current,0)/values.length : 0;
    return { activeCount: items.filter((item)=>item.status==="active").length, avgBaseRate: avg(items.map((item)=>item.baseHourlyRate)), avgTrueCost: avg(items.map((item)=>item.trueHourlyCost)), avgBillableRate: avg(items.map((item)=>item.billableHourlyRate)), avgBurdenPercent: avg(items.map((item)=>item.baseHourlyRate > 0 ? (item.totalBurdenHourly/item.baseHourlyRate)*100 : 0)) };
  }, [items]);

  if (isLoading) return <div className="space-y-4"><SkeletonLoader className="h-10 w-80" /><SkeletonLoader className="h-36 w-full" /><SkeletonLoader className="h-72 w-full" /></div>;
  if (errorMessage) return <ErrorState title="Unable to load labor rates" description={errorMessage} />;

  return <div className="container-content space-y-[var(--space-section)]">
    <PageHeader eyebrow="Resource Costs" title="Labor Rates" description={`Manage labor cost standards and billable pricing for ${companyName || "your company"}.`} primaryAction={<Link href="/labor-rates/new" className={getButtonClassName()}><Plus size={16} aria-hidden="true" />New labor rate</Link>} />
    <section className="grid gap-3 sm:grid-cols-5">
      <SummaryCard icon={<span>A</span>} label="Active Labor Rates" value={String(summary.activeCount)} context="In current page" tone="brand" />
      <SummaryCard icon={<span>B</span>} label="Average Base Rate" value={formatUsdCurrency(summary.avgBaseRate)} context="Current page" tone="info" />
      <SummaryCard icon={<span>T</span>} label="Average True Cost" value={formatUsdCurrency(summary.avgTrueCost)} context="Current page" tone="warning" />
      <SummaryCard icon={<span>R</span>} label="Average Billable Rate" value={formatUsdCurrency(summary.avgBillableRate)} context="Current page" tone="neutral" />
      <SummaryCard icon={<span>%</span>} label="Average Burden %" value={formatPercent(summary.avgBurdenPercent)} context="Current page" tone="brand" />
    </section>
    <LaborRatesFilters query={query} status={status} trade={trade} skillLevel={skillLevel} unionStatus={unionStatus} workerClassification={workerClassification} defaultCostCodeId={defaultCostCodeId} sortBy={sortBy} costCodeOptions={costCodeOptions}
      onQueryChange={setQuery} onStatusChange={(value)=>{setStatus(value);setPage(1);}} onTradeChange={setTrade} onSkillLevelChange={(value)=>{setSkillLevel(value);setPage(1);}} onUnionStatusChange={(value)=>{setUnionStatus(value);setPage(1);}} onWorkerClassificationChange={(value)=>{setWorkerClassification(value);setPage(1);}} onDefaultCostCodeChange={(value)=>{setDefaultCostCodeId(value);setPage(1);}} onSortByChange={(value)=>{setSortBy(value);setPage(1);}} activeFilters={activeFilters} />
    {items.length === 0 ? <EmptyState title="No labor rates found" description="Try different filters or create your first labor rate." action={<Link href="/labor-rates/new" className={getButtonClassName()}>New labor rate</Link>} /> : <LaborRatesTable items={items} total={total} page={page} pageSize={PAGE_SIZE} onPageChange={(nextPage)=>{const maxPage=Math.max(1,Math.ceil(total/PAGE_SIZE));setPage(Math.min(Math.max(nextPage,1),maxPage));}} />}
  </div>;
}
