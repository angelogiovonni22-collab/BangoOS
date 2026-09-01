"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EquipmentForm } from "@/components/equipment";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonLoader, getButtonClassName } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  EMPTY_EQUIPMENT_FORM,
  buildEquipmentUpdatePayload,
  equipmentRowToFormInput,
  type EquipmentCostCodeOption,
  type EquipmentFormInput,
  type EquipmentVendorOption,
  validateEquipmentInput,
  calculateEquipmentSummary,
} from "@/lib/equipment";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function EquipmentEditClient() {
  const params = useParams<{ id?: string | string[] }>();
  const equipmentId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [form, setForm] = useState<EquipmentFormInput>(EMPTY_EQUIPMENT_FORM);
  const [vendorOptions, setVendorOptions] = useState<EquipmentVendorOption[]>([]);
  const [costCodeOptions, setCostCodeOptions] = useState<EquipmentCostCodeOption[]>([]);
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

      if (!equipmentId) {
        if (active) {
          setErrorMessage("Unable to read equipment id.");
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

        const [{ data: vendorData }, { data: costCodeData }] = await Promise.all([
          supabase.from("vendors").select("id, display_name, company_name, first_name, last_name").eq("company_id", workspace.context.companyId).order("display_name", { ascending: true }),
          supabase.from("cost_codes").select("id, code, name").eq("company_id", workspace.context.companyId).order("code", { ascending: true }),
        ]);

        if (!active) {
          return;
        }

        setVendorOptions((vendorData ?? []).map((row) => ({ id: row.id, displayName: row.display_name || row.company_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.id })));
        setCostCodeOptions((costCodeData ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name })));

        const { data, error } = await supabase
          .from("equipment")
          .select("*")
          .eq("id", equipmentId)
          .eq("company_id", workspace.context.companyId)
          .maybeSingle();

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

        setForm(equipmentRowToFormInput(data));
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load equipment.");
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
  }, [equipmentId, supabase]);

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

      const payload = buildEquipmentUpdatePayload(form, {
        companyId: workspace.context.companyId,
        userId: workspace.context.userId,
      }, calculations);

      const { error } = await supabase.from("equipment").update(payload).eq("id", equipmentId).eq("company_id", workspace.context.companyId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push(`/equipment/${equipmentId}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update equipment.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SkeletonLoader className="h-64 w-full" />;
  }

  if (notFound) {
    return <EmptyState title="Equipment not found" description="This equipment record could not be located in your company workspace." action={<Link href="/equipment" className={getButtonClassName({ variant: "outline" })}>Back to equipment</Link>} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Equipment" title="Edit Equipment" description={`Update this asset record for ${companyName || "your company"}.`} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <EquipmentForm value={form} vendorOptions={vendorOptions} costCodeOptions={costCodeOptions} onChange={updateField} disabled={isSaving} />
        {errorMessage ? <ErrorState compact title="Unable to save equipment" description={errorMessage} /> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href={`/equipment/${equipmentId}`}><Button type="button" variant="outline" size="lg">Cancel</Button></Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </form>
    </div>
  );
}
