import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { getLowesPublicReadiness } from "@/lib/materials/lowes-server-config";

export function RetailerIntegrationStatus() {
  const lowes = getLowesPublicReadiness();
  const capabilities = [
    ["Catalog", lowes.catalogReady],
    ["Live pricing", lowes.pricingReady],
    ["Inventory", lowes.inventoryReady],
    ["Direct ordering", lowes.orderingReady],
    ["Order status", lowes.orderStatusReady],
  ] as const;

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle>Retailer Integrations</CardTitle><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Live supplier commerce extends the existing B.O.S. purchasing workflow without replacing purchase orders, approvals, job costing, or receiving.</p></div>
        <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide">Lowe&apos;s · {lowes.environment}</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{capabilities.map(([label, ready]) => <div key={label} className="rounded-xl border border-[var(--color-border)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</p><p className={`mt-1 font-semibold ${ready ? "text-emerald-600" : "text-amber-700"}`}>{ready ? "Ready" : "Configuration required"}</p></div>)}</div>
      {lowes.blockers.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">External access still required</p><ul className="mt-2 list-disc space-y-1 pl-5">{lowes.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul><p className="mt-3">B.O.S. will not attempt a live retailer order until the approved provider capabilities and credentials are configured and a purchase order has explicit human approval.</p></div> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">Lowe&apos;s integration configuration is present. Live order submission remains subject to the B.O.S. purchase-order approval gate.</div>}
    </CardContent>
  </Card>;
}
