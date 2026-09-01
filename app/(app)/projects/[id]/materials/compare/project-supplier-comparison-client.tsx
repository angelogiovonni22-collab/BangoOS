"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, CheckCircle2, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, PageHeader, SkeletonLoader, SummaryCard, TableContainer } from "@/components/ui";
import { createProjectMaterialPlanService } from "@/lib/materials/project-material-plan-service";
import { createProjectSupplierComparisonService } from "@/lib/materials/project-supplier-comparison-service";
import type { ProjectMaterialPlanPayload } from "@/lib/materials/project-material-plan-types";
import type { SupplierPriceComparison } from "@/lib/materials/supplier-price-comparison";

export function ProjectSupplierComparisonClient({ projectId }: { projectId: string }) {
  const planService = useMemo(() => createProjectMaterialPlanService(), []);
  const comparisonService = useMemo(() => createProjectSupplierComparisonService(), []);
  const [plan, setPlan] = useState<ProjectMaterialPlanPayload | null>(null);
  const [comparisons, setComparisons] = useState<Record<string, SupplierPriceComparison>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextPlan, nextComparisons] = await Promise.all([planService.load(projectId), comparisonService.load(projectId)]);
      setPlan(nextPlan);
      setComparisons(nextComparisons.byPlanItemId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load supplier pricing.");
    } finally { setLoading(false); }
  }, [comparisonService, planService, projectId]);

  useEffect(() => { void load(); }, [load]);

  const pricedLines = plan?.items.filter((item) => (comparisons[item.id]?.options.length ?? 0) > 0).length ?? 0;
  const bestSavings = plan?.items.reduce((sum, item) => {
    const comparison = comparisons[item.id];
    if (!comparison?.best) return sum;
    return sum + Math.max(0, item.currentUnitCost - comparison.best.effectiveUnitCost) * item.quantityRemaining;
  }, 0) ?? 0;

  const select = async (itemId: string, entryId: string, vendorName: string) => {
    setSavingId(itemId); setError(null); setMessage(null);
    try {
      await comparisonService.select(projectId, itemId, entryId);
      setMessage(`${vendorName} pricing selected. The project material cost and supplier snapshot were updated.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to select supplier pricing."); }
    finally { setSavingId(null); }
  };

  if (loading && !plan) return <div className="space-y-4"><SkeletonLoader className="h-12 w-80" /><SkeletonLoader className="h-40 w-full" /><SkeletonLoader className="h-80 w-full" /></div>;
  if (error && !plan) return <ErrorState title="Unable to compare supplier pricing" description={error} />;
  if (!plan) return null;

  return <div className="container-content space-y-[var(--space-section)]">
    <PageHeader eyebrow="Project · Materials · Supplier comparison" title={`${plan.project.name} Supplier Pricing`} description="Compare confirmed prices from uploaded supplier lists before creating purchase orders. The approved estimate cost remains the variance baseline." primaryAction={<div className="flex flex-wrap gap-2"><Link href={`/projects/${projectId}/materials`} className={getButtonClassName({ variant: "outline" })}><ArrowLeft size={16}/>Material plan</Link><Link href={`/materials/procurement?projectId=${projectId}`} className={getButtonClassName({ variant: "outline" })}><ShoppingCart size={16}/>Procurement</Link></div>} />
    <section className="grid gap-3 sm:grid-cols-3">
      <SummaryCard icon={<BadgeDollarSign size={18}/>} label="Material lines" value={String(plan.items.length)} context="Approved project requirements" tone="brand" compact />
      <SummaryCard icon={<CheckCircle2 size={18}/>} label="Comparable lines" value={String(pricedLines)} context="Confirmed uploaded supplier matches" tone="success" compact />
      <SummaryCard icon={<span>$</span>} label="Potential savings" value={money(bestSavings)} context="Against currently selected project pricing" tone={bestSavings > 0 ? "success" : "neutral"} compact />
    </section>
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>Price source control:</strong> these are uploaded supplier-list prices, not live retailer checkout prices. Verify availability, tax, delivery, and final total before issuing any purchase order.</div>
    {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
    {message ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
    {plan.items.length === 0 ? <EmptyState title="No project materials to compare" description="Approved estimate material requirements will appear here after project conversion." /> : <TableContainer title="Supplier price comparison" description="Best price is highlighted, but supplier selection remains a controlled human purchasing decision."><div className="space-y-4 p-4">{plan.items.map((item) => {
      const comparison = comparisons[item.id];
      return <section key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{item.description}</h3><p className="text-sm text-slate-500">Need {item.quantityRemaining.toFixed(2)} {item.unitOfMeasure} · estimate {money(item.originalUnitCost)}/unit · current {money(item.currentUnitCost)}/unit</p></div>{comparison?.selected ? <Badge tone="brand">Selected: {comparison.selected.vendorName}</Badge> : <Badge tone="neutral">No supplier price selected</Badge>}</div>
      {!comparison || comparison.options.length === 0 ? <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">No confirmed uploaded supplier-price match is available for this material yet.</p> : <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{comparison.options.map((option) => {
        const isBest = comparison.best?.entryId === option.entryId; const isSelected = comparison.selected?.entryId === option.entryId;
        return <article key={option.entryId} className={`rounded-lg border p-3 ${isBest ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-950">{option.vendorName}</p><p className="text-xs text-slate-500">{option.listName}{option.branchName ? ` · ${option.branchName}` : ""}</p></div>{isBest ? <Badge tone="success">Best uploaded price</Badge> : null}</div><p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{money(option.effectiveUnitCost)}</p><p className="text-xs text-slate-500">SKU {option.supplierSku} · verified {option.verifiedOn}{option.availability ? ` · ${option.availability}` : ""}</p><p className="mt-2 text-sm font-medium text-slate-700">Line total: {money(option.effectiveUnitCost * item.quantityRemaining)}</p><Button className="mt-3 w-full" size="sm" variant={isSelected ? "secondary" : "primary"} disabled={savingId === item.id || isSelected} onClick={() => void select(item.id, option.entryId, option.vendorName)}>{isSelected ? "Selected" : "Use this supplier price"}</Button></article>;
      })}</div>}</section>;
    })}</div></TableContainer>}
  </div>;
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
