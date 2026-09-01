"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { UnitForm } from "@/components/units-of-measure";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonLoader } from "@/components/ui";
import { useCompany } from "@/lib/company";
import {
  buildUnitUpdatePayload,
  isCompatibleMeasurementSystem,
  type UnitFormValues,
  type UnitOfMeasureRow,
  validateUnitFormValues,
} from "@/lib/units-of-measure";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

function rowToForm(row: UnitOfMeasureRow): UnitFormValues {
  return {
    code: row.code,
    name: row.name,
    plural_name: row.plural_name || "",
    symbol: row.symbol || "",
    description: row.description || "",
    category: row.category as UnitFormValues["category"],
    measurement_system: row.measurement_system as UnitFormValues["measurement_system"],
    unit_type: row.unit_type as UnitFormValues["unit_type"],
    base_unit_id: row.base_unit_id || "",
    conversion_factor: row.conversion_factor !== null ? String(row.conversion_factor) : "",
    decimal_precision: String(row.decimal_precision),
    allow_fractional_quantity: row.allow_fractional_quantity,
    is_active: row.is_active,
    sort_order: String(row.sort_order),
    notes: row.notes || "",
  };
}

export function UnitEditClient() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const unitId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);
  const { companyName } = useCompany();

  const [unit, setUnit] = useState<UnitOfMeasureRow | null>(null);
  const [form, setForm] = useState<UnitFormValues | null>(null);
  const [allBaseUnits, setAllBaseUnits] = useState<UnitOfMeasureRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let activeRequest = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      if (!supabase) {
        if (activeRequest) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }
        return;
      }

      if (!unitId) {
        if (activeRequest) {
          setErrorMessage("Unable to read unit id.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(supabase);

        if (!workspace.context) {
          if (activeRequest) {
            setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
            setIsLoading(false);
          }
          return;
        }

        const companyId = workspace.context.companyId;

        const [{ data: row, error }, { data: optionRows }] = await Promise.all([
          supabase
            .from("units_of_measure")
            .select("*")
            .eq("id", unitId)
            .or(`and(is_system.eq.true,company_id.is.null),and(is_system.eq.false,company_id.eq.${companyId})`)
            .maybeSingle<UnitOfMeasureRow>(),
          supabase
            .from("units_of_measure")
            .select("*")
            .or(`and(is_system.eq.true,company_id.is.null),and(is_system.eq.false,company_id.eq.${companyId})`)
            .order("code", { ascending: true }),
        ]);

        if (!activeRequest) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setIsLoading(false);
          return;
        }

        if (!row) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setUnit(row);
        setForm(rowToForm(row));
        setAllBaseUnits((optionRows ?? []) as UnitOfMeasureRow[]);
      } catch (error) {
        if (activeRequest) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load unit.");
        }
      } finally {
        if (activeRequest) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      activeRequest = false;
    };
  }, [supabase, unitId]);

  const baseUnitOptions = useMemo(() => {
    if (!unit || !form) {
      return [];
    }

    return allBaseUnits.filter((candidate) => {
      if (candidate.id === unit.id) {
        return false;
      }

      if (candidate.category !== form.category) {
        return false;
      }

      if (!isCompatibleMeasurementSystem(form.measurement_system, candidate.measurement_system as UnitFormValues["measurement_system"])) {
        return false;
      }

      if (!candidate.is_system && unit.company_id && candidate.company_id !== unit.company_id) {
        return false;
      }

      return true;
    });
  }, [allBaseUnits, form, unit]);

  const updateField = <K extends keyof UnitFormValues>(key: K, value: UnitFormValues[K]) => {
    if (!form) {
      return;
    }

    setForm((previous) => (previous ? { ...previous, [key]: value } : previous));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!supabase || !unit || !form) {
      setErrorMessage("Unit data is unavailable.");
      return;
    }

    if (unit.is_system) {
      setErrorMessage("System units cannot be edited through company workflows.");
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
      currentUnitId: unit.id,
      companyId: workspace.context.companyId,
      availableBaseUnits: baseUnitOptions,
      existingUnit: unit,
    });

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] || "Please review the form.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = buildUnitUpdatePayload(form, {
        companyId: workspace.context.companyId,
        userId: workspace.context.userId,
      });

      const { error } = await supabase
        .from("units_of_measure")
        .update(payload)
        .eq("id", unit.id)
        .eq("company_id", workspace.context.companyId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push(`/units-of-measure/${unit.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update unit.");
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

  if (errorMessage && !form) {
    return <ErrorState title="Unable to load unit" description={errorMessage} />;
  }

  if (notFound || !unit || !form) {
    return (
      <EmptyState
        title="Unit not found"
        description="This unit could not be located in your workspace."
        action={<Link href="/units-of-measure" className={getButtonClassName({})}>Back to units</Link>}
      />
    );
  }

  if (unit.is_system) {
    return (
      <EmptyState
        title="System unit cannot be edited"
        description="System units are managed by BangoOS through platform migrations and admin tooling."
        action={<Link href={`/units-of-measure/${unit.id}`} className={getButtonClassName({})}>Back to details</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master Data"
        title="Edit Unit of Measure"
        description={`Update company unit settings for ${companyName || "your company"}.`}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <UnitForm value={form} baseUnitOptions={baseUnitOptions} onChange={updateField} disabled={isSaving} />

        {errorMessage ? <ErrorState compact title="Unable to save unit" description={errorMessage} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href={`/units-of-measure/${unit.id}`}>
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </form>
    </div>
  );
}
