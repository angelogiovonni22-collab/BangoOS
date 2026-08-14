"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MaterialForm } from "@/components/materials";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonLoader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  EMPTY_MATERIAL_FORM,
  type MaterialFormInput,
  type MaterialRow,
  type VendorOption,
  validateMaterialInput,
} from "@/lib/materials";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function EditMaterialClient() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const materialId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [material, setMaterial] = useState<MaterialRow | null>(null);
  const [form, setForm] = useState<MaterialFormInput>(EMPTY_MATERIAL_FORM);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

        const [materialResult, vendorsResult] = await Promise.all([
          supabase
            .from("materials")
            .select("*")
            .eq("id", materialId)
            .eq("company_id", workspace.context.companyId)
            .maybeSingle<MaterialRow>(),
          supabase
            .from("vendors")
            .select("id, display_name")
            .eq("company_id", workspace.context.companyId)
            .order("display_name", { ascending: true }),
        ]);

        if (!active) {
          return;
        }

        if (vendorsResult.data) {
          setVendorOptions(vendorsResult.data.map((vendor) => ({ id: vendor.id, displayName: vendor.display_name })));
        }

        if (materialResult.error) {
          setErrorMessage(materialResult.error.message);
          setIsLoading(false);
          return;
        }

        if (!materialResult.data) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        const data = materialResult.data;
        setMaterial(data);
        setForm({
          material_code: data.material_code,
          status: data.status as MaterialFormInput["status"],
          name: data.name,
          description: data.description || "",
          category: data.category || "",
          trade: data.trade || "",
          unit_of_measure: data.unit_of_measure,
          standard_cost: String(data.standard_cost),
          average_cost: String(data.average_cost),
          last_purchase_cost: String(data.last_purchase_cost),
          markup_percent: String(data.markup_percent),
          suggested_sell_price: String(data.suggested_sell_price),
          preferred_vendor_id: data.preferred_vendor_id || "",
          manufacturer: data.manufacturer || "",
          manufacturer_part_number: data.manufacturer_part_number || "",
          vendor_part_number: data.vendor_part_number || "",
          lead_time_days: data.lead_time_days !== null ? String(data.lead_time_days) : "",
          track_inventory: data.track_inventory,
          current_stock: String(data.current_stock),
          reorder_point: String(data.reorder_point),
          reorder_quantity: String(data.reorder_quantity),
          warehouse_location: data.warehouse_location || "",
          bin_location: data.bin_location || "",
          weight: data.weight !== null ? String(data.weight) : "",
          width: data.width !== null ? String(data.width) : "",
          height: data.height !== null ? String(data.height) : "",
          length: data.length !== null ? String(data.length) : "",
          last_purchase_date: data.last_purchase_date || "",
          notes: data.notes || "",
        });
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

  const updateField = <K extends keyof MaterialFormInput>(key: K, value: MaterialFormInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!material) {
      setErrorMessage("Material record is unavailable.");
      return;
    }

    const validation = validateMaterialInput(form);

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] || "Please review the form.");
      return;
    }

    if (!supabase) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const workspace = await resolveWorkspaceContext(supabase);

      if (!workspace.context) {
        setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
        return;
      }

      const payload = {
        material_code: form.material_code.trim(),
        status: form.status,
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        trade: form.trade.trim() || null,
        unit_of_measure: form.unit_of_measure.trim(),
        standard_cost: Number(form.standard_cost),
        average_cost: Number(form.average_cost),
        last_purchase_cost: Number(form.last_purchase_cost),
        markup_percent: Number(form.markup_percent),
        suggested_sell_price: Number(form.suggested_sell_price),
        preferred_vendor_id: form.preferred_vendor_id || null,
        manufacturer: form.manufacturer.trim() || null,
        manufacturer_part_number: form.manufacturer_part_number.trim() || null,
        vendor_part_number: form.vendor_part_number.trim() || null,
        lead_time_days: form.lead_time_days.trim() ? Number(form.lead_time_days) : null,
        track_inventory: form.track_inventory,
        current_stock: Number(form.current_stock),
        reorder_point: Number(form.reorder_point),
        reorder_quantity: Number(form.reorder_quantity),
        warehouse_location: form.warehouse_location.trim() || null,
        bin_location: form.bin_location.trim() || null,
        weight: form.weight.trim() ? Number(form.weight) : null,
        width: form.width.trim() ? Number(form.width) : null,
        height: form.height.trim() ? Number(form.height) : null,
        length: form.length.trim() ? Number(form.length) : null,
        last_purchase_date: form.last_purchase_date.trim() || null,
        notes: form.notes.trim() || null,
        updated_by: workspace.context.userId,
      };

      const { error } = await supabase
        .from("materials")
        .update(payload)
        .eq("id", material.id)
        .eq("company_id", workspace.context.companyId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push(`/materials/${material.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update material.");
    } finally {
      setIsSaving(false);
    }
  };

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
        action={<Link href="/materials"><Button>Back to materials</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Materials"
        title="Edit Material"
        description={`Update material details and inventory settings for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <MaterialForm value={form} vendorOptions={vendorOptions} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save material" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href={`/materials/${material.id}`}>
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </form>
    </div>
  );
}
