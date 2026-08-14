"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, ErrorState, SkeletonLoader } from "@/components/ui";
import { buildCompanyFinancialReport, type CompanyFinancialReport } from "@/lib/financial-reporting";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export function CompanyFinancialReportingPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [report, setReport] = useState<CompanyFinancialReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      if (!supabase) {
        if (active) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(supabase);

        if (!workspace.context) {
          if (active) {
            setErrorMessage(workspace.errorMessage || "Unable to resolve workspace context.");
            setIsLoading(false);
          }
          return;
        }

        const nextReport = await buildCompanyFinancialReport({
          supabase,
          companyId: workspace.context.companyId,
        });

        if (active) {
          setReport(nextReport);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load company financial reporting.");
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
  }, [supabase]);

  if (isLoading) {
    return (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonLoader className="h-28 w-full" />
        <SkeletonLoader className="h-28 w-full" />
        <SkeletonLoader className="h-28 w-full" />
        <SkeletonLoader className="h-28 w-full" />
      </section>
    );
  }

  if (errorMessage || !report) {
    return <ErrorState title="Unable to load financial reporting" description={errorMessage || "Financial reporting is unavailable."} />;
  }

  const summary = report.summary;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Company Revenue" value={formatMoney(summary.companyRevenue)} context="Collected payments" />
        <MetricCard label="Total Backlog" value={formatMoney(summary.totalBacklog)} context="Revised contract less invoiced" />
        <MetricCard label="Outstanding Receivables" value={formatMoney(summary.totalOutstandingReceivables)} context="Invoiced less collected" />
        <MetricCard label="Committed Cost" value={formatMoney(summary.committedCost)} context="Cost code + active subcontractor commitments" />
        <MetricCard label="Projected Gross Profit" value={formatMoney(summary.projectGrossProfit)} context={`Projected margin ${formatPercent(summary.projectMarginPercent)}`} />
        <MetricCard label="Cash Exposure" value={formatMoney(summary.cashExposure)} context="Receivables + committed exposure" />
      </section>

      <Card as="section" variant="elevated" className="rounded-[16px] border border-[var(--bos-border-light)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <CardTitle className="text-section-title">Executive Financial Reporting</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryRow label="Jobs Over Budget" value={String(summary.jobsOverBudget)} />
          <SummaryRow label="Jobs Under Margin Target" value={String(summary.jobsUnderMarginTarget)} />
          <SummaryRow label="Projects Reviewed" value={String(report.projectsReviewed)} />
          <SummaryRow label="Margin Target" value={`${report.marginTargetPercent}%`} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, context }: { label: string; value: string; context: string }) {
  return (
    <article className="rounded-[14px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] p-4 shadow-[var(--bos-shadow-workspace-card)]">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--bos-text-strong-on-light)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">{context}</p>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-[0.07em] text-[var(--bos-text-medium-on-light)]">{label}</p>
      <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(2)}%`;
}
