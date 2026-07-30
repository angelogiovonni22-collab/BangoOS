"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UnitForm } from "@/components/units-of-measure";
import { Button, ErrorState, PageHeader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  EMPTY_UNIT_FORM,
  buildUnitInsertPayload,
  isCompatibleMeasurementSystem,
  type UnitFormValues,
  type UnitOfMeasureRow,
  validateUnitFormValues,
} from "@/lib/units-of-measure";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function UnitNewClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [form, setForm] = useState<UnitFormValues>(EMPTY_UNIT_FORM);
  const [allBaseUnits, setAllBaseUnits] = useState<UnitOfMeasureRow[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || allBaseUnits !== null) {
      return;
    }

    void (async () => {
      const workspace = await resolveWorkspaceContext(supabase);

      if (!workspace.context) {
        return;
      }

      const { data } = await supabase
        .from("units_of_measure")
        .select("*")
        .or(`and(is_system.eq.true,company_id.is.null),and(is_system.eq.false,company_id.eq.${workspace.context.companyId})`)
        .order("code", { ascending: true });

      setAllBaseUnits((data ?? []) as UnitOfMeasureRow[]);
    })();
  }, [allBaseUnits, supabase]);

  const baseUnitOptions = useMemo(() => {
    const units = allBaseUnits ?? [];

    return units.filter((unit) => {
      if (unit.category !== form.category) {
        return false;
      }

      return isCompatibleMeasurementSystem(form.measurement_system, unit.measurement_system as UnitFormValues["measurement_system"]);
    });
  }, [allBaseUnits, form.category, form.measurement_system]);

  const updateField = <K extends keyof UnitFormValues>(key: K, value: UnitFormValues[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    if (isSaving) {
      return;
    }

    const workspace = await resolveWorkspaceContext(supabase);

    if (!workspace.context) {
      setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
      return;
    }

    const validation = validateUnitFormValues(form, {
      companyId: workspace.context.companyId,
      availableBaseUnits: baseUnitOptions,
    });

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] || "Please review the form.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = buildUnitInsertPayload(form, {
        companyId: workspace.context.companyId,
        userId: workspace.context.userId,
      });

      const { data, error } = await supabase
        .from("units_of_measure")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data?.id) {
        setErrorMessage("Unit was created but redirect target was not returned.");
        return;
      }

      router.push(`/units-of-measure/${data.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create unit.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master Data"
        title="New Unit of Measure"
        description={`Create a company unit for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <UnitForm value={form} baseUnitOptions={baseUnitOptions} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save unit" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/units-of-measure">
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Create Unit"}</Button>
        </div>
      </form>
    </div>
  );
}
