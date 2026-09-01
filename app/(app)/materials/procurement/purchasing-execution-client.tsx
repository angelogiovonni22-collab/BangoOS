"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { CheckCircle2, ShieldCheck, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ErrorState, SkeletonLoader, SummaryCard } from "@/components/ui";
import { buildEstimateToOrderPlan } from "@/lib/materials/estimate-to-order-automation";
import { buildPurchasingExecutionPlan } from "@/lib/materials/purchasing-execution";
import { createProcurementService } from "@/lib/materials/procurement-service";
import { createProjectMaterialPlanService } from "@/lib/materials/project-material-plan-service";
import { createProjectSupplierComparisonService } from "@/lib/materials/project-supplier-comparison-service";
import type { ProjectMaterialPlanPayload } from "@/lib/materials/project-material-plan-types";
import type { SupplierPriceComparison } from "@/lib/materials/supplier-price-comparison";

export function PurchasingExecutionClient({ projectId }: { projectId: string }) {
  const materialService = useMemo(() => createProjectMaterialPlanService(), []);
  const comparisonService = useMemo(() => createProjectSupplierComparisonService(), []);
  const procurementService = useMemo(() => createProcurementService(), []);
  const [materials, setMaterials] = useState<ProjectMaterialPlanPayload | null>(null);
  const [comparisons, setComparisons] = useState<Record<string, SupplierPriceComparison>>({});
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [plan, prices] = await Promise.all([materialService.load(projectId), comparisonService.load(projectId)]);
      setMaterials(plan); setComparisons(prices.byPlanItemId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to prepare the purchasing plan."); }
    finally { setLoading(false); }
  }, [comparisonService, materialService, projectId]);

  useEffect(() => { void load(); }, [load]);

  const recommendation = useMemo(() => materials ? buildEstimateToOrderPlan(materials.items, comparisons) : null, [comparisons, materials]);
  const execution = useMemo(() => materials && recommendation ? buildPurchasingExecutionPlan(projectId, recommendation, materials.items) : null, [materials, projectId, recommendation]);

  const prepareDrafts = async () => {
    if (!execution?.readyToPrepare) return;
    setPreparing(true); setError(null); setMessage(null);
    try {
      for (const draft of execution.drafts) await procurementService.createDraftPurchaseOrder(draft.input);
      setMessage(`${execution.drafts.length} supplier purchase order${execution.drafts.length === 1 ? "" : "s"} prepared as draft. Review tax, delivery, quantities, and totals before approval or issue.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to prepare draft purchase orders."); }
    finally { setPreparing(false); }
  };

  if (loading && !materials) return <SkeletonLoader className="h-72 w-full" />;
  if (error && !materials) return <ErrorState title="Unable to load Order Materials" description={error} />;
  if (!materials || !recommendation || !execution) return null;

  return <Card>
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Order Materials · B.O.S. Purchasing Plan</CardTitle><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{materials.project.name}: remaining approved material requirements are matched to the best confirmed uploaded supplier pricing and split into supplier draft orders.</p></div><Link href={`/projects/${projectId}/materials/compare`} className={getButtonClassName({ variant: "outline" })}>Review supplier prices</Link></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<ShoppingCart size={18}/>} label="Ready lines" value={String(recommendation.totals.readyLines)} context="Available for draft purchasing" tone="brand" compact />
        <SummaryCard icon={<span>$</span>} label="Planned cost" value={money(recommendation.totals.plannedCost)} context="Before tax and delivery" tone="neutral" compact />
        <SummaryCard icon={<CheckCircle2 size={18}/>} label="Projected savings" value={money(recommendation.totals.savingsAgainstCurrent)} context="Against current project cost" tone={recommendation.totals.savingsAgainstCurrent > 0 ? "success" : "neutral"} compact />
        <SummaryCard icon={<ShieldCheck size={18}/>} label="Needs attention" value={String(recommendation.totals.blockedLines)} context="Missing confirmed supplier pricing" tone={recommendation.totals.blockedLines ? "warning" : "success"} compact />
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>Approval control:</strong> B.O.S. can prepare these purchase orders as drafts only. It cannot submit a supplier order from this step. Final availability, tax, shipping/delivery, quantities, and totals must be reviewed before approval and issue.</div>
      {error ? <ErrorState compact title="Unable to prepare purchasing drafts" description={error} /> : null}
      {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p> : null}
      <div className="grid gap-3 lg:grid-cols-2">{execution.drafts.map((draft) => <section key={draft.vendorId} className="rounded-xl border border-[var(--color-border)] p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{draft.vendorName}</p><p className="text-sm text-[var(--color-text-secondary)]">{draft.lineCount} material line{draft.lineCount === 1 ? "" : "s"}</p></div><Badge tone="brand">{money(draft.subtotal)}</Badge></div><div className="mt-3 space-y-1 text-sm">{draft.input.lines.map((line) => <div key={line.projectMaterialPlanItemId ?? line.description} className="flex justify-between gap-3"><span>{line.description} · {line.quantityOrdered}</span><span className="tabular-nums">{money(line.quantityOrdered * line.unitCost)}</span></div>)}</div></section>)}</div>
      {execution.blockedItemIds.length ? <p className="text-sm font-medium text-amber-800">{execution.blockedItemIds.length} material line{execution.blockedItemIds.length === 1 ? " requires" : "s require"} a confirmed supplier selection before B.O.S. can prepare the complete order set.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4"><p className="text-sm text-[var(--color-text-secondary)]">Preparing drafts reserves the remaining quantities so duplicate purchasing is prevented.</p><Button disabled={!execution.readyToPrepare || preparing} onClick={() => void prepareDrafts()}>{preparing ? "Preparing drafts…" : `Review & Prepare ${execution.drafts.length} Draft PO${execution.drafts.length === 1 ? "" : "s"}`}</Button></div>
    </CardContent>
  </Card>;
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
