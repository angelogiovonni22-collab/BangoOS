"use client";

import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, PageHeader, SkeletonLoader, SummaryCard, getButtonClassName } from "@/components/ui";
import { availableQuantity, inventoryHealth, inventoryValue, reorderSuggestion } from "@/lib/materials/inventory-intelligence";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type LocationRow = { id: string; name: string; location_type: string; active: boolean };
type BalanceRow = { id: string; material_id: string; location_id: string; on_hand: number; reserved: number; unit_cost: number };
type MaterialRow = { id: string; material_code: string; name: string; reorder_point: number; unit_of_measure: string };
type MovementRow = { id: string; material_id: string; location_id: string; project_id: string | null; movement_type: string; quantity: number; reason: string | null; created_at: string };

type InventoryView = BalanceRow & { materialName: string; materialCode: string; unit: string; locationName: string; locationType: string; reorderPoint: number };

export function InventoryWorkspaceClient() {
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), []);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [balances, setBalances] = useState<InventoryView[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const workspace = await resolveWorkspaceContext(supabase);
        if (!workspace.context) throw new Error(workspace.errorMessage || "Unable to verify your workspace.");
        const companyId = workspace.context.companyId;
        const [locationResult, balanceResult, movementResult] = await Promise.all([
          supabase.from("inventory_locations").select("id,name,location_type,active").eq("company_id", companyId).order("name"),
          supabase.from("inventory_balances").select("id,material_id,location_id,on_hand,reserved,unit_cost").eq("company_id", companyId),
          supabase.from("inventory_movements").select("id,material_id,location_id,project_id,movement_type,quantity,reason,created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(25),
        ]);
        const firstError = locationResult.error || balanceResult.error || movementResult.error;
        if (firstError) throw firstError;
        const rawBalances = (balanceResult.data || []) as BalanceRow[];
        const materialIds = Array.from(new Set(rawBalances.map((row) => row.material_id)));
        const materialResult = materialIds.length
          ? await supabase.from("materials").select("id,material_code,name,reorder_point,unit_of_measure").eq("company_id", companyId).in("id", materialIds)
          : { data: [], error: null };
        if (materialResult.error) throw materialResult.error;
        if (!active) return;
        const locationRows = (locationResult.data || []) as LocationRow[];
        const materialRows = (materialResult.data || []) as MaterialRow[];
        const locationMap = new Map(locationRows.map((row) => [row.id, row]));
        const materialMap = new Map(materialRows.map((row) => [row.id, row]));
        setLocations(locationRows);
        setBalances(rawBalances.map((row) => {
          const material = materialMap.get(row.material_id);
          const location = locationMap.get(row.location_id);
          return { ...row, materialName: material?.name || "Unknown material", materialCode: material?.material_code || "—", unit: material?.unit_of_measure || "unit", locationName: location?.name || "Unknown location", locationType: location?.location_type || "other", reorderPoint: Number(material?.reorder_point || 0) };
        }));
        setMovements((movementResult.data || []) as MovementRow[]);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load inventory.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [supabase]);

  const summary = useMemo(() => {
    let value = 0;
    let available = 0;
    let reserved = 0;
    let low = 0;
    for (const row of balances) {
      const model = { materialId: row.material_id, locationId: row.location_id, onHand: Number(row.on_hand), reserved: Number(row.reserved), reorderPoint: row.reorderPoint, unitCost: Number(row.unit_cost) };
      value += inventoryValue(model);
      available += availableQuantity(model);
      reserved += model.reserved;
      if (inventoryHealth(model) !== "healthy") low += 1;
    }
    return { value, available, reserved, low };
  }, [balances]);

  if (loading) return <div className="space-y-4"><SkeletonLoader className="h-12 w-80" /><SkeletonLoader className="h-36 w-full" /><SkeletonLoader className="h-80 w-full" /></div>;
  if (error) return <ErrorState title="Unable to load inventory" description={error} />;

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader eyebrow="Resources · Inventory" title="Inventory & Warehouse Command Center" description="Live stock, reservations, locations, movement history, and replenishment intelligence across B.O.S." primaryAction={<div className="flex flex-wrap gap-2"><Link href="/materials/procurement" className={getButtonClassName({})}>Receive Materials</Link><Link href="/materials" className={getButtonClassName({ variant: "outline" })}>Material Catalog</Link></div>} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<span>$</span>} label="Inventory value" value={`$${summary.value.toFixed(2)}`} context="Current on-hand value" tone="brand" />
        <SummaryCard icon={<span>A</span>} label="Available units" value={summary.available.toFixed(1)} context="On hand less reserved" tone="info" />
        <SummaryCard icon={<span>R</span>} label="Reserved units" value={summary.reserved.toFixed(1)} context="Committed to projects" tone="warning" />
        <SummaryCard icon={<span>!</span>} label="Needs reorder" value={String(summary.low)} context="Low or out of stock" tone={summary.low ? "warning" : "success"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_2fr]">
        <article className="rounded-[var(--radius-xl)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bos-text-muted)]">Storage network</p><h2 className="text-xl font-bold">Locations</h2></div>
          {locations.length ? <div className="space-y-2">{locations.map((location) => <div key={location.id} className="flex items-center justify-between rounded-lg border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-control)] px-4 py-3"><div><p className="font-semibold">{location.name}</p><p className="text-xs uppercase tracking-wide text-[var(--bos-text-muted)]">{location.location_type}</p></div><span className="text-xs font-semibold text-[var(--color-success-500)]">{location.active ? "Active" : "Inactive"}</span></div>)}</div> : <EmptyState title="No inventory locations" description="Warehouse, jobsite, and vehicle locations will appear here as inventory is configured." />}
        </article>

        <article className="rounded-[var(--radius-xl)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bos-text-muted)]">Stock intelligence</p><h2 className="text-xl font-bold">Inventory balances</h2></div>
          {balances.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--bos-border-default)] text-left text-xs uppercase tracking-wide text-[var(--bos-text-muted)]"><th className="py-3 pr-3">Material</th><th className="py-3 pr-3">Location</th><th className="py-3 pr-3 text-right">On hand</th><th className="py-3 pr-3 text-right">Reserved</th><th className="py-3 pr-3 text-right">Available</th><th className="py-3 text-right">Reorder</th></tr></thead><tbody>{balances.map((row) => { const model = { materialId: row.material_id, locationId: row.location_id, onHand: Number(row.on_hand), reserved: Number(row.reserved), reorderPoint: row.reorderPoint, unitCost: Number(row.unit_cost) }; const health = inventoryHealth(model); return <tr key={row.id} className="border-b border-[var(--bos-border-subtle)]"><td className="py-3 pr-3"><p className="font-semibold">{row.materialName}</p><p className="text-xs text-[var(--bos-text-muted)]">{row.materialCode}</p></td><td className="py-3 pr-3">{row.locationName}</td><td className="py-3 pr-3 text-right">{model.onHand.toFixed(1)}</td><td className="py-3 pr-3 text-right">{model.reserved.toFixed(1)}</td><td className="py-3 pr-3 text-right font-semibold">{availableQuantity(model).toFixed(1)}</td><td className="py-3 text-right"><span className={health === "healthy" ? "text-[var(--color-success-500)]" : "font-bold text-[var(--color-warning-500)]"}>{health === "healthy" ? "Healthy" : `${reorderSuggestion(model, Math.max(model.reorderPoint * 2, model.onHand)).toFixed(1)} suggested`}</span></td></tr>; })}</tbody></table></div> : <EmptyState title="No inventory balances yet" description="Receive a purchase order into inventory to establish the first stock balance." action={<Link href="/materials/procurement" className={getButtonClassName({})}>Open Receiving</Link>} />}
        </article>
      </section>

      <article className="rounded-[var(--radius-xl)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
        <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bos-text-muted)]">Audit trail</p><h2 className="text-xl font-bold">Recent inventory movements</h2><p className="text-sm text-[var(--bos-text-secondary)]">Receiving, allocation, consumption, returns, transfers, and audited adjustments.</p></div>
        {movements.length ? <div className="space-y-2">{movements.map((movement) => <div key={movement.id} className="grid gap-2 rounded-lg border border-[var(--bos-border-subtle)] px-4 py-3 sm:grid-cols-[140px_1fr_120px_180px]"><span className="font-semibold capitalize">{movement.movement_type}</span><span className="text-[var(--bos-text-secondary)]">{movement.reason || "Inventory movement"}</span><span className="font-semibold sm:text-right">{Number(movement.quantity).toFixed(1)}</span><span className="text-xs text-[var(--bos-text-muted)] sm:text-right">{new Date(movement.created_at).toLocaleString()}</span></div>)}</div> : <EmptyState title="No inventory movements yet" description="The immutable movement ledger will populate when materials are received or allocated." />}
      </article>
    </div>
  );
}
