"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  SkeletonLoader,
  StatusBadge,
  SummaryCard,
} from "@/components/ui";
import { UnitCategoryBadge, UnitSystemBadge } from "@/components/units-of-measure";
import {
  convertToBaseUnit,
  formatUnitQuantity,
  getUnitUsageSummary,
  type UnitOfMeasureRow,
} from "@/lib/units-of-measure";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

function toProfileName(profile: { first_name: string | null; last_name: string | null } | null) {
  if (!profile) {
    return null;
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return fullName || null;
}

export function UnitDetailClient() {
  const params = useParams<{ id?: string | string[] }>();
  const unitId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [unit, setUnit] = useState<UnitOfMeasureRow | null>(null);
  const [baseUnit, setBaseUnit] = useState<UnitOfMeasureRow | null>(null);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [updatedByName, setUpdatedByName] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<string | null>(null);
  const [workspaceCompanyId, setWorkspaceCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let activeRequest = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);
      setActionMessage(null);

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

        setWorkspaceRole(workspace.context.role || null);
        setWorkspaceCompanyId(workspace.context.companyId);

        const { data: row, error } = await supabase
          .from("units_of_measure")
          .select("*")
          .eq("id", unitId)
          .or(`and(is_system.eq.true,company_id.is.null),and(is_system.eq.false,company_id.eq.${workspace.context.companyId})`)
          .maybeSingle<UnitOfMeasureRow>();

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

        const tasks: PromiseLike<unknown>[] = [];

        if (row.base_unit_id) {
          tasks.push(
            supabase
              .from("units_of_measure")
              .select("*")
              .eq("id", row.base_unit_id)
              .maybeSingle<UnitOfMeasureRow>()
              .then((result) => {
                if (activeRequest) {
                  setBaseUnit(result.data || null);
                }
              }),
          );
        } else {
          setBaseUnit(null);
        }

        if (row.created_by) {
          tasks.push(
            supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", row.created_by)
              .maybeSingle<{ first_name: string | null; last_name: string | null }>()
              .then((result) => {
                if (activeRequest) {
                  setCreatedByName(toProfileName(result.data || null));
                }
              }),
          );
        } else {
          setCreatedByName(null);
        }

        if (row.updated_by) {
          tasks.push(
            supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", row.updated_by)
              .maybeSingle<{ first_name: string | null; last_name: string | null }>()
              .then((result) => {
                if (activeRequest) {
                  setUpdatedByName(toProfileName(result.data || null));
                }
              }),
          );
        } else {
          setUpdatedByName(null);
        }

        await Promise.all(tasks);
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

  const canManageDeletes = workspaceRole === "owner" || workspaceRole === "administrator";
  const canManageCompanyUnit = Boolean(unit && !unit.is_system && unit.company_id && workspaceCompanyId === unit.company_id);

  const handleDeactivate = async () => {
    if (!supabase || !unit || !canManageCompanyUnit || isDeactivating) {
      return;
    }

    setActionMessage(null);
    setIsDeactivating(true);

    try {
      const workspace = await resolveWorkspaceContext(supabase);

      if (!workspace.context) {
        setActionMessage(workspace.errorMessage || "Unable to verify your workspace.");
        return;
      }

      const { error } = await supabase
        .from("units_of_measure")
        .update({ is_active: false, updated_by: workspace.context.userId })
        .eq("id", unit.id)
        .eq("company_id", workspace.context.companyId);

      if (error) {
        setActionMessage(error.message);
        return;
      }

      setUnit((previous) => (previous ? { ...previous, is_active: false } : previous));
      setActionMessage("Unit was deactivated.");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to deactivate this unit.");
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleDelete = async () => {
    if (!supabase || !unit || !canManageCompanyUnit || !canManageDeletes || isDeleting) {
      return;
    }

    setActionMessage(null);
    setIsDeleting(true);

    try {
      const workspace = await resolveWorkspaceContext(supabase);

      if (!workspace.context) {
        setActionMessage(workspace.errorMessage || "Unable to verify your workspace.");
        return;
      }

      const usage = await getUnitUsageSummary(supabase, {
        companyId: workspace.context.companyId,
        unitCode: unit.code,
        isSystem: unit.is_system,
      });

      if (usage.totalReferences > 0) {
        setActionMessage("This unit is already referenced by existing records. Deactivate it instead of deleting.");
        return;
      }

      const { error } = await supabase
        .from("units_of_measure")
        .delete()
        .eq("id", unit.id)
        .eq("company_id", workspace.context.companyId);

      if (error) {
        setActionMessage(error.message);
        return;
      }

      router.push("/units-of-measure");
      router.refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to delete this unit.");
    } finally {
      setIsDeleting(false);
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
    return <ErrorState title="Unable to load unit" description={errorMessage} />;
  }

  if (notFound || !unit) {
    return (
      <EmptyState
        title="Unit not found"
        description="This unit could not be located in your workspace."
        action={<Link href="/units-of-measure"><Button>Back to units</Button></Link>}
      />
    );
  }

  const sampleInput = 10;
  const sampleOutput = unit.conversion_factor ? convertToBaseUnit(sampleInput, unit.conversion_factor) : null;
  const sampleOutputText = sampleOutput !== null && baseUnit
    ? `${sampleInput} ${unit.code} = ${formatUnitQuantity(sampleOutput, baseUnit)}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        <Link href="/units-of-measure" className="text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">Units of Measure</Link>
        <span>/</span>
        <span>{unit.code}</span>
      </div>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-medium)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{unit.code}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{unit.name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <UnitSystemBadge isSystem={unit.is_system} />
              <UnitCategoryBadge category={unit.category as never} />
              <StatusBadge status={unit.is_active ? "active" : "inactive"} />
            </div>
          </div>

          {unit.is_system ? (
            <Badge tone="neutral">Managed by BangoOS</Badge>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/units-of-measure/${unit.id}/edit`}>
                <Button>Edit Unit</Button>
              </Link>
              <Button variant="outline" onClick={() => void handleDeactivate()} disabled={!unit.is_active || isDeactivating}>
                {isDeactivating ? "Deactivating..." : "Deactivate"}
              </Button>
              {canManageDeletes ? (
                <Button variant="danger" onClick={() => void handleDelete()} disabled={isDeleting}>
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {actionMessage ? <ErrorState compact title="Action result" description={actionMessage} /> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<span>P</span>} label="Decimal Precision" value={String(unit.decimal_precision)} tone="brand" compact />
        <SummaryCard icon={<span>F</span>} label="Fractional Quantities" value={unit.allow_fractional_quantity ? "Allowed" : "Whole only"} tone="info" compact />
        <SummaryCard icon={<span>O</span>} label="Sort Order" value={String(unit.sort_order)} tone="warning" compact />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Code" value={unit.code} />
            <InfoRow label="Name" value={unit.name} />
            <InfoRow label="Plural Name" value={unit.plural_name} />
            <InfoRow label="Symbol" value={unit.symbol} />
            <InfoRow label="Description" value={unit.description} />
            <InfoRow label="Category" value={unit.category} />
            <InfoRow label="Measurement System" value={unit.measurement_system} />
            <InfoRow label="Unit Type" value={unit.unit_type} />
            <InfoRow label="Source" value={unit.is_system ? "System" : "Company"} />
            <InfoRow label="Status" value={unit.is_active ? "Active" : "Inactive"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quantity Behavior</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Decimal Precision" value={String(unit.decimal_precision)} />
            <InfoRow label="Fractional Quantities Allowed" value={unit.allow_fractional_quantity ? "Yes" : "No"} />
            <InfoRow label="Example Quantity" value={formatUnitQuantity(12.34567, unit)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Conversion</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            {baseUnit && unit.conversion_factor ? (
              <>
                <InfoRow label="Base Unit" value={`${baseUnit.code} - ${baseUnit.name}`} />
                <InfoRow label="Conversion Factor" value={String(unit.conversion_factor)} />
                <InfoRow label="Formula" value="quantity in base unit = quantity in current unit × conversion factor" />
                <InfoRow label="Example" value={`1 ${unit.code} = ${formatUnitQuantity(unit.conversion_factor, baseUnit)}`} />
                <InfoRow label="Example (10)" value={sampleOutputText} />
              </>
            ) : (
              <InfoRow label="Conversion" value="No base-unit conversion configured" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Notes" value={unit.notes} />
            <InfoRow label="Created By" value={createdByName} />
            <InfoRow label="Updated By" value={updatedByName} />
            <InfoRow label="Created" value={new Date(unit.created_at).toLocaleString()} />
            <InfoRow label="Updated" value={new Date(unit.updated_at).toLocaleString()} />
          </CardContent>
        </Card>
      </section>

      {unit.is_system ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
          System units are managed by BangoOS and cannot be edited or deleted from normal company workflows.
        </div>
      ) : null}
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
