"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
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
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Financial operations shortcuts">
        <MetricCard href="/invoices" label="Company Revenue" value={formatMoney(summary.companyRevenue)} context="Collected payments" />
        <MetricCard href="/projects" label="Total Backlog" value={formatMoney(summary.totalBacklog)} context="Revised contract less invoiced" />
        <MetricCard href="/invoices" label="Outstanding Receivables" value={formatMoney(summary.totalOutstandingReceivables)} context="Invoiced less collected" />
        <MetricCard href="/projects" label="Committed Cost" value={formatMoney(summary.committedCost)} context="Cost code + active subcontractor commitments" />
        <MetricCard href="/projects" label="Projected Gross Profit" value={formatMoney(summary.projectGrossProfit)} context={`Projected margin ${formatPercent(summary.projectMarginPercent)}`} />
        <MetricCard href="/invoices" label="Cash Exposure" value={formatMoney(summary.cashExposure)} context="Receivables + committed exposure" />
      </section>

      <Card as="section" variant="elevated" className="rounded-[16px] border border-[var(--bos-border-light)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-section-title">Executive Financial Reporting</CardTitle>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Review projects <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryRow href="/projects" label="Jobs Over Budget" value={String(summary.jobsOverBudget)} />
          <SummaryRow href="/projects" label="Jobs Under Margin Target" value={String(summary.jobsUnderMarginTarget)} />
          <SummaryRow href="/projects" label="Projects Reviewed" value={String(report.projectsReviewed)} />
          <SummaryRow href="/projects" label="Margin Target" value={`${report.marginTargetPercent}%`} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ href, label, value, context }: { href: string; label: string; value: string; context: string }) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}. Open related records.`}
      className="group block rounded-[14px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] p-4 shadow-[var(--bos-shadow-workspace-card)] transition duration-150 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{label}</p>
        <ArrowUpRight size={15} className="shrink-0 text-[var(--color-text-muted)] transition group-hover:text-blue-500" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--bos-text-strong-on-light)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">{context}</p>
    </Link>
  );
}

function SummaryRow({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5 transition hover:border-blue-400 hover:bg-[var(--color-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.07em] text-[var(--bos-text-medium-on-light)]">{label}</p>
      <span className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</span>
        <ArrowUpRight size={13} className="text-[var(--color-text-muted)] transition group-hover:text-blue-500" aria-hidden="true" />
      </span>
    </Link>
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
