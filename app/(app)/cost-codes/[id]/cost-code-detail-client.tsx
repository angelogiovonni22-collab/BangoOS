"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, PageHeader, SkeletonLoader, StatusBadge, SummaryCard } from "@/components/ui";
import type { CostCodeRow } from "@/lib/cost-codes";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type ChildCode = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export function CostCodeDetailClient() {
  const params = useParams<{ id?: string | string[] }>();
  const costCodeId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);

  const [costCode, setCostCode] = useState<CostCodeRow | null>(null);
  const [parentLabel, setParentLabel] = useState<string | null>(null);
  const [children, setChildren] = useState<ChildCode[]>([]);
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

      if (!costCodeId) {
        if (active) {
          setErrorMessage("Unable to read cost code id.");
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
          .from("cost_codes")
          .select("*")
          .eq("id", costCodeId)
          .eq("company_id", workspace.context.companyId)
          .maybeSingle<CostCodeRow>();

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

        setCostCode(data);

        const tasks: PromiseLike<unknown>[] = [];

        if (data.parent_cost_code_id) {
          tasks.push(
            supabase
              .from("cost_codes")
              .select("code, name")
              .eq("company_id", workspace.context.companyId)
              .eq("id", data.parent_cost_code_id)
              .maybeSingle<{ code: string; name: string }>()
              .then((result) => {
                if (active) {
                  setParentLabel(result.data ? `${result.data.code} ${result.data.name}` : null);
                }
              }),
          );
        } else {
          setParentLabel(null);
        }

        tasks.push(
          supabase
            .from("cost_codes")
            .select("id, code, name, status")
            .eq("company_id", workspace.context.companyId)
            .eq("parent_cost_code_id", data.id)
            .order("code", { ascending: true })
            .then((result) => {
              if (active) {
                setChildren((result.data ?? []) as ChildCode[]);
              }
            }),
        );

        await Promise.all(tasks);
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load cost code.");
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
  }, [costCodeId, supabase]);

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
    return <ErrorState title="Unable to load cost code" description={errorMessage} />;
  }

  if (notFound || !costCode) {
    return (
      <EmptyState
        title="Cost code not found"
        description="This cost code could not be located in your company workspace."
        action={<Link href="/cost-codes"><Badge tone="brand">Back to cost codes</Badge></Link>}
      />
    );
  }

  const remainingBudget = costCode.budget - costCode.actual_cost;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={`${costCode.code} · ${costCode.name}`}
        description="Track classification, hierarchy, and budget posture for this cost code."
        secondaryActions={(
          <Link
            href="/cost-codes"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 text-sm font-semibold text-[var(--color-text-secondary)]"
          >
            Back to Cost Codes
          </Link>
        )}
        primaryAction={(
          <Link href={`/cost-codes/${costCode.id}/edit`} className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
            Edit Cost Code
          </Link>
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={costCode.status} />
        {parentLabel ? <Badge tone="info">Child of {parentLabel}</Badge> : <Badge tone="brand">Top-level</Badge>}
        {children.length > 0 ? <Badge tone="warning">{children.length} child codes</Badge> : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<span>B</span>} label="Budget" value={`$${costCode.budget.toFixed(2)}`} context="Planned total" tone="brand" />
        <SummaryCard icon={<span>C</span>} label="Committed" value={`$${costCode.committed_cost.toFixed(2)}`} context="Committed obligations" tone="info" />
        <SummaryCard icon={<span>A</span>} label="Actual" value={`$${costCode.actual_cost.toFixed(2)}`} context={`Remaining: $${remainingBudget.toFixed(2)}`} tone="warning" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Classification</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Division" value={costCode.division} />
            <InfoRow label="Category" value={costCode.category} />
            <InfoRow label="Trade" value={costCode.trade} />
            <InfoRow label="Description" value={costCode.description} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Hierarchy</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Parent" value={parentLabel} />
            <div>
              <p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">Children</p>
              {children.length === 0 ? (
                <p className="mt-0.5 text-sm text-[var(--color-text-primary)]">-</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {children.map((child) => (
                    <li key={child.id}>
                      <Link href={`/cost-codes/${child.id}`} className="text-sm text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">
                        {child.code} {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Defaults</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Default labor rate id" value={costCode.default_labor_rate_id} />
            <InfoRow label="Default material category id" value={costCode.default_material_category_id} />
            <InfoRow label="Default equipment category id" value={costCode.default_equipment_category_id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Created at" value={new Date(costCode.created_at).toLocaleString()} />
            <InfoRow label="Updated at" value={new Date(costCode.updated_at).toLocaleString()} />
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
