"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { AlertTriangle, ArrowLeft, Boxes, ClipboardCheck, ShoppingCart, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Input, PageHeader, Select, SkeletonLoader, SummaryCard, TableContainer, getButtonClassName } from "@/components/ui";
import { createProjectMaterialPlanService } from "@/lib/materials/project-material-plan-service";
import type { ProjectMaterialPlanItem, ProjectMaterialPlanPayload } from "@/lib/materials/project-material-plan-types";

type EditState = { inventoryQuantity: string; requiredOn: string; vendorId: string };

export function ProjectMaterialPlanClient({ projectId }: { projectId: string }) {
  const service = useMemo(() => createProjectMaterialPlanService(), []);
  const [payload, setPayload] = useState<ProjectMaterialPlanPayload | null>(null);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [purchaseVendorId, setPurchaseVendorId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const next = await service.load(projectId);
      setPayload(next);
      setEdits(Object.fromEntries(next.items.map((item) => [item.id, {
        inventoryQuantity: String(item.inventoryQuantity),
        requiredOn: item.requiredOn || "",
        vendorId: item.selectedVendorId || "",
      }])));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the project material plan.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, service]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    const items = payload?.items ?? [];
    return {
      estimated: items.reduce((sum, item) => sum + item.estimatedPurchaseCost, 0),
      current: items.reduce((sum, item) => sum + item.currentPurchaseCost, 0),
      remaining: items.reduce((sum, item) => sum + item.quantityRemaining, 0),
      atRisk: items.filter((item) => item.costVariance > 0).length,
    };
  }, [payload]);

  const saveItem = async (item: ProjectMaterialPlanItem) => {
    const edit = edits[item.id];
    if (!edit) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const next = await service.update(projectId, {
        itemId: item.id,
        inventoryQuantity: Number(edit.inventoryQuantity || 0),
        requiredOn: edit.requiredOn || null,
        selectedVendorId: edit.vendorId || null,
      });
      setPayload(next);
      setSuccessMessage(`${item.description} was updated.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update this material.");
    } finally {
      setIsSaving(false);
    }
  };

  const createDraftPo = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await service.createDraftPurchaseOrder(projectId, selectedIds, purchaseVendorId);
      setPayload(result.payload);
      setSelectedIds([]);
      setSuccessMessage("Draft purchase order created. Review tax, delivery, cost codes, and final approval in Procurement before issuing it.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create the draft purchase order.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="space-y-4"><SkeletonLoader className="h-12 w-80" /><SkeletonLoader className="h-40 w-full" /><SkeletonLoader className="h-80 w-full" /></div>;
  if (errorMessage && !payload) return <ErrorState title="Unable to load project materials" description={errorMessage} />;
  if (!payload) return null;

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        eyebrow="Project · Materials & procurement"
        title={`${payload.project.name} Material Plan`}
        description="Review the approved estimate quantities, reserve inventory, compare the current purchasing cost, and prepare controlled purchase orders."
        primaryAction={<div className="flex flex-wrap gap-2"><Link href={`/projects/${projectId}`} className={getButtonClassName({ variant: "outline" })}><ArrowLeft size={16} />Project workspace</Link><Link href={`/materials/procurement?projectId=${projectId}`} className={getButtonClassName({ variant: "outline" })}><Truck size={16} />Procurement</Link></div>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<Boxes size={18} />} label="Material lines" value={String(payload.items.length)} context="From the approved estimate" tone="brand" compact />
        <SummaryCard icon={<span>$</span>} label="Estimate snapshot" value={formatMoney(summary.estimated)} context="Original approved cost basis" tone="info" compact />
        <SummaryCard icon={<ShoppingCart size={18} />} label="Current purchase cost" value={formatMoney(summary.current)} context={`${summary.remaining.toFixed(2)} units remaining`} tone="success" compact />
        <SummaryCard icon={<AlertTriangle size={18} />} label="Cost increases" value={String(summary.atRisk)} context="Lines above estimate pricing" tone={summary.atRisk > 0 ? "warning" : "neutral"} compact />
      </section>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Approval control:</strong> creating a purchase order here only creates a draft. An authorized employee must still review supplier, quantities, tax, delivery, total cost, variance, required date, project, and cost code before approving or issuing it.
      </div>

      {errorMessage ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div> : null}
      {successMessage ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</div> : null}

      {payload.items.length === 0 ? (
        <EmptyState title="No approved estimate materials" description="Material lines will appear automatically when an approved estimate is converted into this project." />
      ) : (
        <TableContainer
          title="Project material requirements"
          description="Original pricing remains locked for variance reporting. Inventory and current purchasing decisions remain editable."
          controls={<div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto]"><Select aria-label="Purchase order supplier" value={purchaseVendorId} onChange={(event) => setPurchaseVendorId(event.target.value)}><option value="">Supplier for selected lines</option>{payload.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</Select><Button disabled={isSaving || selectedIds.length === 0 || !purchaseVendorId} onClick={() => void createDraftPo()}><ClipboardCheck size={16} />Create draft PO ({selectedIds.length})</Button></div>}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-sm">
              <thead className="bg-slate-900 text-left text-white"><tr><th className="px-3 py-3"><span className="sr-only">Select</span></th><th className="px-3 py-3">Material</th><th className="px-3 py-3 text-right">Estimate qty</th><th className="px-3 py-3 text-right">Inventory</th><th className="px-3 py-3 text-right">To purchase</th><th className="px-3 py-3 text-right">Ordered</th><th className="px-3 py-3 text-right">Received</th><th className="px-3 py-3">Supplier</th><th className="px-3 py-3 text-right">Estimate cost</th><th className="px-3 py-3 text-right">Current cost</th><th className="px-3 py-3 text-right">Variance</th><th className="px-3 py-3">Required</th><th className="px-3 py-3">Order state</th><th className="px-3 py-3">Action</th></tr></thead>
              <tbody>{payload.items.map((item) => {
                const edit = edits[item.id] || { inventoryQuantity: "0", requiredOn: "", vendorId: "" };
                const selectable = item.quantityRemaining > 0;
                return <tr key={item.id} className="border-b border-slate-200 align-top">
                  <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${item.description}`} disabled={!selectable} checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></td>
                  <td className="px-3 py-3"><p className="font-semibold text-slate-950">{item.description}</p><p className="text-xs text-slate-500">{item.itemCode || "No item code"} · {item.unitOfMeasure}{item.inventoryAvailable > 0 ? ` · ${item.inventoryAvailable} available` : ""}</p></td>
                  <td className="px-3 py-3 text-right tabular-nums">{item.estimatedQuantity.toFixed(2)}</td>
                  <td className="px-3 py-2"><Input className="min-w-24 text-right tabular-nums" type="number" min={0} max={item.estimatedQuantity} step="0.01" value={edit.inventoryQuantity} onChange={(event) => setEdits((current) => ({ ...current, [item.id]: { ...edit, inventoryQuantity: event.target.value } }))} /></td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{item.quantityToPurchase.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{item.quantityOrdered.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{item.quantityReceived.toFixed(2)}</td>
                  <td className="px-3 py-2"><Select className="min-w-44" value={edit.vendorId} onChange={(event) => setEdits((current) => ({ ...current, [item.id]: { ...edit, vendorId: event.target.value } }))}><option value="">Select supplier</option>{payload.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</Select></td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(item.originalUnitCost)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(item.currentUnitCost)}</td>
                  <td className={`px-3 py-3 text-right font-semibold tabular-nums ${item.costVariance > 0 ? "text-red-700" : item.costVariance < 0 ? "text-emerald-700" : "text-slate-600"}`}>{signedMoney(item.costVariance)}</td>
                  <td className="px-3 py-2"><Input className="min-w-36" type="date" value={edit.requiredOn} onChange={(event) => setEdits((current) => ({ ...current, [item.id]: { ...edit, requiredOn: event.target.value } }))} /></td>
                  <td className="px-3 py-3"><Badge tone={orderTone(item.orderStatus)}>{item.orderStatus.replaceAll("_", " ")}</Badge></td>
                  <td className="px-3 py-2"><Button size="sm" variant="secondary" disabled={isSaving} onClick={() => void saveItem(item)}>Save</Button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </TableContainer>
      )}
    </div>
  );
}

function formatMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
function signedMoney(value: number) { return `${value > 0 ? "+" : ""}${formatMoney(value)}`; }
function orderTone(status: ProjectMaterialPlanItem["orderStatus"]): "neutral" | "warning" | "brand" | "info" | "success" {
  if (status === "received") return "success";
  if (status === "partially_received") return "warning";
  if (status === "issued") return "info";
  if (status === "approved") return "brand";
  return "neutral";
}
