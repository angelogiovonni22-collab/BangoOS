"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EquipmentForm } from "@/components/equipment";
import { Button, ErrorState, PageHeader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  EMPTY_EQUIPMENT_FORM,
  buildEquipmentInsertPayload,
  type EquipmentCostCodeOption,
  type EquipmentFormInput,
  type EquipmentVendorOption,
  validateEquipmentInput,
  calculateEquipmentSummary,
} from "@/lib/equipment";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function EquipmentNewClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [form, setForm] = useState<EquipmentFormInput>(EMPTY_EQUIPMENT_FORM);
  const [vendorOptions, setVendorOptions] = useState<EquipmentVendorOption[]>([]);
  const [costCodeOptions, setCostCodeOptions] = useState<EquipmentCostCodeOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      if (!supabase) {
        return;
      }

      const workspace = await resolveWorkspaceContext(supabase);

      if (!workspace.context || !active) {
        return;
      }

      const [{ data: vendorData }, { data: costCodeData }] = await Promise.all([
        supabase.from("vendors").select("id, display_name, company_name, first_name, last_name").eq("company_id", workspace.context.companyId).order("display_name", { ascending: true }),
        supabase.from("cost_codes").select("id, code, name").eq("company_id", workspace.context.companyId).order("code", { ascending: true }),
      ]);

      if (!active) {
        return;
      }

      setVendorOptions((vendorData ?? []).map((row) => ({ id: row.id, displayName: row.display_name || row.company_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.id })));
      setCostCodeOptions((costCodeData ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name })));
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, [supabase]);

  const updateField = <K extends keyof EquipmentFormInput>(key: K, value: EquipmentFormInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validation = validateEquipmentInput(form, {
      allowedVendorIds: vendorOptions.map((option) => option.id),
      allowedCostCodeIds: costCodeOptions.map((option) => option.id),
    });

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

      const calculations = calculateEquipmentSummary(form);

      const payload = buildEquipmentInsertPayload(form, {
        companyId: workspace.context.companyId,
        userId: workspace.context.userId,
      }, calculations);

      const { data, error } = await supabase.from("equipment").insert(payload).select("id").single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data?.id) {
        setErrorMessage("Equipment was created but the redirect target was not returned.");
        return;
      }

      router.push(`/equipment/${data.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create equipment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Asset Management" title="New Equipment" description={`Create a new asset record for ${companyName || "your company"}.`} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <EquipmentForm value={form} vendorOptions={vendorOptions} costCodeOptions={costCodeOptions} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save equipment" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/equipment"><Button type="button" variant="outline" size="lg">Cancel</Button></Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Create Equipment"}</Button>
        </div>
      </form>
    </div>
  );
}
