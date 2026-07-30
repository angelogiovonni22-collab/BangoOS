"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, SkeletonLoader, StatusBadge } from "@/components/ui";
import { getStockBadgeLabel, getStockBadgeTone, type MaterialListItem, type MaterialRow } from "@/lib/materials";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function MaterialDetailClient() {
  const params = useParams<{ id?: string | string[] }>();
  const materialId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);

  const [material, setMaterial] = useState<MaterialRow | null>(null);
  const [preferredVendorName, setPreferredVendorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      if (!supabase) {
        if (active) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }

        return;
      }

      if (!materialId) {
        if (active) {
          setErrorMessage("Unable to read material id.");
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

        const { data, error } = await supabase
          .from("materials")
          .select("*")
          .eq("id", materialId)
          .eq("company_id", workspace.context.companyId)
          .maybeSingle<MaterialRow>();

        if (!active) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setIsLoading(false);
          return;
        }

        if (!data) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setMaterial(data);

        if (data.preferred_vendor_id) {
          const { data: vendorData } = await supabase
            .from("vendors")
            .select("display_name")
            .eq("company_id", workspace.context.companyId)
            .eq("id", data.preferred_vendor_id)
            .maybeSingle<{ display_name: string }>();

          if (active) {
            setPreferredVendorName(vendorData?.display_name || null);
          }
        } else {
          setPreferredVendorName(null);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load material.");
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
  }, [materialId, supabase]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-8 w-80" />
        <SkeletonLoader className="h-24 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title="Unable to load material" description={errorMessage} />;
  }

  if (notFound || !material) {
    return (
      <EmptyState
        title="Material not found"
        description="This material could not be located in your company workspace."
        action={<Link href="/materials"><Badge tone="brand">Back to materials</Badge></Link>}
      />
    );
  }

  const stockBadgeInput: Pick<MaterialListItem, "trackInventory" | "currentStock" | "reorderPoint"> = {
    trackInventory: material.track_inventory,
    currentStock: material.current_stock,
    reorderPoint: material.reorder_point,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        <Link href="/materials" className="text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">Materials</Link>
        <span>/</span>
        <span>{material.name}</span>
      </div>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-medium)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{material.name}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{material.material_code}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={material.status} />
              <Badge tone={getStockBadgeTone(stockBadgeInput)}>{getStockBadgeLabel(stockBadgeInput)}</Badge>
              <Badge tone="info">Std Cost ${material.standard_cost.toFixed(2)}</Badge>
            </div>
          </div>

          <Link href={`/materials/${material.id}/edit`} className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
            Edit Material
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Basic</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Category" value={material.category} />
            <InfoRow label="Trade" value={material.trade} />
            <InfoRow label="Unit" value={material.unit_of_measure} />
            <InfoRow label="Description" value={material.description} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Standard cost" value={`$${material.standard_cost.toFixed(2)}`} />
            <InfoRow label="Average cost" value={`$${material.average_cost.toFixed(2)}`} />
            <InfoRow label="Last purchase cost" value={`$${material.last_purchase_cost.toFixed(2)}`} />
            <InfoRow label="Markup percent" value={`${material.markup_percent.toFixed(2)}%`} />
            <InfoRow label="Suggested sell price" value={`$${material.suggested_sell_price.toFixed(2)}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vendor</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Preferred vendor" value={preferredVendorName} />
            <InfoRow label="Manufacturer" value={material.manufacturer} />
            <InfoRow label="Manufacturer part #" value={material.manufacturer_part_number} />
            <InfoRow label="Vendor part #" value={material.vendor_part_number} />
            <InfoRow label="Lead time days" value={material.lead_time_days !== null ? String(material.lead_time_days) : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Inventory</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Track inventory" value={material.track_inventory ? "Yes" : "No"} />
            <InfoRow label="Current stock" value={`${material.current_stock.toFixed(3)} ${material.unit_of_measure}`} />
            <InfoRow label="Reorder point" value={material.reorder_point.toFixed(3)} />
            <InfoRow label="Reorder quantity" value={material.reorder_quantity.toFixed(3)} />
            <InfoRow label="Warehouse location" value={material.warehouse_location} />
            <InfoRow label="Bin location" value={material.bin_location} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Physical</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Weight" value={material.weight !== null ? String(material.weight) : null} />
            <InfoRow label="Width" value={material.width !== null ? String(material.width) : null} />
            <InfoRow label="Height" value={material.height !== null ? String(material.height) : null} />
            <InfoRow label="Length" value={material.length !== null ? String(material.length) : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Analytics</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Last purchase date" value={material.last_purchase_date} />
            <InfoRow label="Notes" value={material.notes} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--color-text-primary)]">{value?.trim() || "-"}</p>
    </div>
  );
}
