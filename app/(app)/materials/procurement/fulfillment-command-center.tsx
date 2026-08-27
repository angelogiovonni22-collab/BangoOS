"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, ErrorState, SkeletonLoader, SummaryCard } from "@/components/ui";
import { createProcurementService } from "@/lib/materials/procurement-service";
import type { ProcurementOverviewPayload } from "@/lib/materials/procurement-types";
import { buildFulfillmentDashboard } from "@/lib/materials/purchasing-fulfillment-intelligence";

const RISK_TONE = { none: "success", attention: "warning", critical: "danger" } as const;
const STAGE_TONE = {
  needed: "neutral",
  priced: "info",
  ready_to_order: "brand",
  ordered: "info",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
} as const;

export function FulfillmentCommandCenter() {
  const service = useMemo(() => createProcurementService(), []);
  const [payload, setPayload] = useState<ProcurementOverviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPayload(await service.loadOverview());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load fulfillment intelligence.");
    }
  }, [service]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorState compact title="Fulfillment intelligence unavailable" description={error} />;
  if (!payload) return <SkeletonLoader className="h-64 w-full" />;

  const dashboard = buildFulfillmentDashboard(payload);

  return (
    <section className="space-y-4" aria-labelledby="fulfillment-command-center-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Purchasing Automation</p>
        <h2 id="fulfillment-command-center-title" className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">Material Fulfillment Command Center</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Live purchasing exposure, receipt progress, and fulfillment risk. Supplier ordering remains approval-controlled.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<span>$</span>} label="Committed Cost" value={`$${dashboard.totals.committedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} context="Active purchase orders" tone="brand" />
        <SummaryCard icon={<span>R</span>} label="Received Cost" value={`$${dashboard.totals.receivedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} context="Materials physically received" tone="success" />
        <SummaryCard icon={<span>U</span>} label="Outstanding Units" value={dashboard.totals.outstandingUnits.toLocaleString()} context="Ordered less received/damaged" tone="warning" />
        <SummaryCard icon={<span>!</span>} label="At-Risk Orders" value={String(dashboard.totals.atRiskOrders)} context="Damage, backorder, or outstanding" tone={dashboard.totals.atRiskOrders > 0 ? "warning" : "success"} />
      </div>

      <Card>
        <CardHeader><CardTitle>Fulfillment Pipeline</CardTitle></CardHeader>
        <CardContent>
          {dashboard.orders.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No purchase orders are in the fulfillment pipeline yet.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.orders.map(({ order, fulfillment }) => (
                <article key={order.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{order.poNumber} · {order.vendorName}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{order.projectName} · ${fulfillment.committedCost.toFixed(2)} committed · ${fulfillment.receivedCost.toFixed(2)} received</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={STAGE_TONE[fulfillment.stage]}>{fulfillment.stage.replaceAll("_", " ")}</Badge>
                      <Badge tone={RISK_TONE[fulfillment.risk]}>{fulfillment.risk === "none" ? "on track" : fulfillment.risk}</Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-4">
                    <span>Ordered <strong className="text-[var(--color-text-primary)]">{fulfillment.orderedQuantity}</strong></span>
                    <span>Received <strong className="text-[var(--color-text-primary)]">{fulfillment.receivedQuantity}</strong></span>
                    <span>Backordered <strong className="text-[var(--color-text-primary)]">{fulfillment.backorderedQuantity}</strong></span>
                    <span>Damaged <strong className="text-[var(--color-text-primary)]">{fulfillment.damagedQuantity}</strong></span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-neutral-200)]" aria-label={`${fulfillment.receivedPercent}% received`}>
                    <div className="h-full rounded-full bg-[var(--color-brand-500)]" style={{ width: `${fulfillment.receivedPercent}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--color-text-secondary)]">{fulfillment.receivedPercent}% received · {fulfillment.remainingQuantity} outstanding</span>
                    {fulfillment.riskReason ? <span className="font-medium text-[var(--color-warning-700)]">{fulfillment.riskReason}</span> : <span className="font-medium text-[var(--color-success-700)]">No fulfillment exception</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
