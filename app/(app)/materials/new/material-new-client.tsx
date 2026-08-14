"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MaterialForm } from "@/components/materials";
import { Button, ErrorState, PageHeader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  EMPTY_MATERIAL_FORM,
  type MaterialFormInput,
  type VendorOption,
  validateMaterialInput,
} from "@/lib/materials";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function NewMaterialClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [form, setForm] = useState<MaterialFormInput>(EMPTY_MATERIAL_FORM);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadVendors = async () => {
      if (!supabase) {
        return;
      }

      const workspace = await resolveWorkspaceContext(supabase);

      if (!workspace.context || !active) {
        return;
      }

      const { data } = await supabase
        .from("vendors")
        .select("id, display_name")
        .eq("company_id", workspace.context.companyId)
        .order("display_name", { ascending: true });

      if (!active) {
        return;
      }

      setVendorOptions((data ?? []).map((vendor) => ({ id: vendor.id, displayName: vendor.display_name })));
    };

    void loadVendors();

    return () => {
      active = false;
    };
  }, [supabase]);

  const updateField = <K extends keyof MaterialFormInput>(key: K, value: MaterialFormInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

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
        company_id: workspace.context.companyId,
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
        created_by: workspace.context.userId,
        updated_by: workspace.context.userId,
      };

      const { data, error } = await supabase
        .from("materials")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data?.id) {
        setErrorMessage("Material was created but the redirect target was not returned.");
        return;
      }

      router.push(`/materials/${data.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create material.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Materials"
        title="New Material"
        description={`Create a new material profile for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <MaterialForm value={form} vendorOptions={vendorOptions} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save material" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/materials">
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Create Material"}</Button>
        </div>
      </form>
    </div>
  );
}
