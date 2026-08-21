"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ProjectFinancialReport } from "@/lib/financial-reporting";
import { ProjectReceiptsWorkspace } from "./project-receipts-workspace";

type ProjectFinancialReportingProps = {
  report: ProjectFinancialReport;
};

export function ProjectFinancialReporting({ report }: ProjectFinancialReportingProps) {
  const [approvedReceiptSpend, setApprovedReceiptSpend] = useState(0);
  const summary = useMemo(() => {
    const actualCost = toMoney(report.summary.actualCost + approvedReceiptSpend);
    const remainingCostToComplete = toMoney(Math.max(report.summary.revisedBudget - actualCost, 0));
    const forecastFinalCost = toMoney(Math.max(actualCost + report.summary.committedCost, report.summary.revisedBudget));
    const grossProfit = toMoney(report.summary.revisedContractValue - forecastFinalCost);
    const grossMarginPercent = report.summary.revisedContractValue > 0
      ? toMoney((grossProfit / report.summary.revisedContractValue) * 100)
      : null;

    return {
      ...report.summary,
      actualCost,
      remainingCostToComplete,
      forecastFinalCost,
      grossProfit,
      grossMarginPercent,
    };
  }, [approvedReceiptSpend, report.summary]);

  const jobCostByCategory = useMemo(() => report.jobCostByCategory.map((row) => {
    if (row.category !== "materials") return row;
    const actual = toMoney(row.actual + approvedReceiptSpend);
    const forecast = toMoney(row.committed + actual);
    const varianceAmount = toMoney(row.budget - forecast);
    const variancePercent = row.budget > 0 ? toMoney((varianceAmount / row.budget) * 100) : null;
    return {
      ...row,
      actual,
      forecast,
      varianceAmount,
      variancePercent,
      status: row.dataStatus === "unavailable" ? "unavailable" as const : deriveStatus(variancePercent),
      dataStatus: "measured" as const,
      note: null,
    };
  }), [approvedReceiptSpend, report.jobCostByCategory]);

  return (
    <div className="space-y-5">
      <ProjectReceiptsWorkspace projectId={summary.projectId} onApprovedSpendChange={setApprovedReceiptSpend} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revised Contract Value" value={formatMoney(summary.revisedContractValue)} context="Original estimate + approved change orders" />
        <MetricCard label="Forecast Final Cost" value={formatMoney(summary.forecastFinalCost)} context="Actual + committed baseline" />
        <MetricCard label="Projected Gross Profit" value={formatMoney(summary.grossProfit)} context={`Projected margin ${formatPercent(summary.grossMarginPercent)}`} />
        <MetricCard label="Outstanding Receivables" value={formatMoney(summary.outstandingReceivables)} context="Invoiced less payments received" />
      </section>

      <Card as="section" variant="elevated" className="rounded-[16px] border border-[var(--bos-border-light)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <CardTitle className="text-section-title">Project Financial Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryRow label="Original Estimate" value={formatMoney(summary.originalEstimate)} />
            <SummaryRow label="Approved Change Orders" value={formatMoney(summary.approvedChangeOrders)} />
            <SummaryRow label="Revised Contract Value" value={formatMoney(summary.revisedContractValue)} />
            <SummaryRow label="Original Budget" value={formatMoney(summary.originalBudget)} />
            <SummaryRow label="Revised Budget" value={formatMoney(summary.revisedBudget)} />
            <SummaryRow label="Committed Cost" value={formatMoney(summary.committedCost)} />
            <SummaryRow label="Actual Cost" value={formatMoney(summary.actualCost)} />
            <SummaryRow label="Remaining To Complete" value={formatMoney(summary.remainingCostToComplete)} />
            <SummaryRow label="Forecast Final Cost" value={formatMoney(summary.forecastFinalCost)} />
            <SummaryRow label="Gross Profit" value={formatMoney(summary.grossProfit)} />
            <SummaryRow label="Gross Margin" value={formatPercent(summary.grossMarginPercent)} />
            <SummaryRow label="Amount Invoiced" value={formatMoney(summary.amountInvoiced)} />
            <SummaryRow label="Payments Received" value={formatMoney(summary.paymentsReceived)} />
            <SummaryRow label="Outstanding Receivables" value={formatMoney(summary.outstandingReceivables)} />
            <SummaryRow label="Retainage" value={formatMoney(summary.retainage)} />
            <SummaryRow label="Unbilled Contract Value" value={formatMoney(summary.unbilledContractValue)} />
          </div>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated" className="rounded-[16px] border border-[var(--bos-border-light)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <CardTitle className="text-section-title">Job Cost By Category</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] text-left text-xs uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Budget</th>
                <th className="px-3 py-2.5">Committed</th>
                <th className="px-3 py-2.5">Actual</th>
                <th className="px-3 py-2.5">Forecast</th>
                <th className="px-3 py-2.5">Variance $</th>
                <th className="px-3 py-2.5">Variance %</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobCostByCategory.map((row) => (
                <tr key={row.category} className="border-b border-[var(--bos-border-light)] text-[var(--bos-text-strong-on-light)]">
                  <td className="px-3 py-2.5 font-semibold">{toTitleCase(row.category)}</td>
                  <td className="px-3 py-2.5">{formatMoney(row.budget)}</td>
                  <td className="px-3 py-2.5">{formatMoney(row.committed)}</td>
                  <td className="px-3 py-2.5">{formatMoney(row.actual)}</td>
                  <td className="px-3 py-2.5">{formatMoney(row.forecast)}</td>
                  <td className="px-3 py-2.5">{formatMoney(row.varianceAmount)}</td>
                  <td className="px-3 py-2.5">{formatPercent(row.variancePercent)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                      {toStatusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card as="section" variant="elevated" className="rounded-[16px] border border-[var(--bos-border-light)]">
          <CardHeader className="bg-[var(--color-surface-subtle)]/55">
            <CardTitle className="text-section-title">Cost Code Variance</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] text-left text-xs uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">
                  <th className="px-3 py-2.5">Cost Code</th>
                  <th className="px-3 py-2.5">Budget</th>
                  <th className="px-3 py-2.5">Committed</th>
                  <th className="px-3 py-2.5">Actual</th>
                  <th className="px-3 py-2.5">Forecast</th>
                  <th className="px-3 py-2.5">Variance $</th>
                  <th className="px-3 py-2.5">Variance %</th>
                </tr>
              </thead>
              <tbody>
                {report.costCodeVariance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-sm text-[var(--bos-text-medium-on-light)]">
                      No project-scoped cost code procurement activity is available yet.
                    </td>
                  </tr>
                ) : (
                  report.costCodeVariance.slice(0, 20).map((row) => (
                    <tr key={row.costCodeId} className="border-b border-[var(--bos-border-light)] text-[var(--bos-text-strong-on-light)]">
                      <td className="px-3 py-2.5 font-semibold">{row.code} {row.name}</td>
                      <td className="px-3 py-2.5">{formatMoney(row.budget)}</td>
                      <td className="px-3 py-2.5">{formatMoney(row.committed)}</td>
                      <td className="px-3 py-2.5">{formatMoney(row.actual)}</td>
                      <td className="px-3 py-2.5">{formatMoney(row.forecast)}</td>
                      <td className="px-3 py-2.5">{formatMoney(row.varianceAmount)}</td>
                      <td className="px-3 py-2.5">{formatPercent(row.variancePercent)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card as="section" variant="elevated" className="rounded-[16px] border border-[var(--bos-border-light)]">
          <CardHeader className="bg-[var(--color-surface-subtle)]/55">
            <CardTitle className="text-section-title">Billing & Receivables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 p-4">
            <SummaryRow label="Draft Invoices" value={String(report.billing.draftInvoices)} />
            <SummaryRow label="Sent Invoices" value={String(report.billing.sentInvoices)} />
            <SummaryRow label="Paid Invoices" value={String(report.billing.paidInvoices)} />
            <SummaryRow label="Overdue Invoices" value={String(report.billing.overdueInvoices)} />
            <SummaryRow label="Total Invoiced" value={formatMoney(report.billing.totalInvoiced)} />
            <SummaryRow label="Total Collected" value={formatMoney(report.billing.totalCollected)} />
            <SummaryRow label="Outstanding Balance" value={formatMoney(report.billing.outstandingBalance)} />
            <SummaryRow label="Retainage" value={formatMoney(report.billing.retainage)} />
            <SummaryRow label="Unbilled Contract" value={formatMoney(report.billing.unbilledContractAmount)} />
          </CardContent>
        </Card>
      </div>

      <Card as="section" variant="elevated" className="rounded-[16px] border border-[var(--bos-border-light)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <CardTitle className="text-section-title">Data Availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 p-4">
          {report.availability.map((item) => (
            <div key={item.key} className="rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{item.label}</p>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${availabilityClass(item.status)}`}>
                  {toTitleCase(item.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">{item.detail}</p>
            </div>
          ))}
          <div className="rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">Field Receipt Costs</p>
              <span className="inline-flex rounded-full bg-[var(--color-success-100)] px-2 py-1 text-xs font-semibold text-[var(--color-success-700)]">Available</span>
            </div>
            <p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">Approved project receipts are included in the live Actual Cost, material cost, forecast, and gross-profit calculations shown above.</p>
          </div>
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

function toMoney(value: number) {
  return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;
}

function deriveStatus(variancePercent: number | null): "on_track" | "at_risk" | "over_budget" {
  if (variancePercent === null) return "on_track";
  if (variancePercent < 0) return "over_budget";
  if (variancePercent <= 10) return "at_risk";
  return "on_track";
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

function toTitleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function toStatusLabel(status: "on_track" | "at_risk" | "over_budget" | "unavailable") {
  if (status === "on_track") {
    return "On Track";
  }

  if (status === "at_risk") {
    return "At Risk";
  }

  if (status === "over_budget") {
    return "Over Budget";
  }

  return "Unavailable";
}

function statusClass(status: "on_track" | "at_risk" | "over_budget" | "unavailable") {
  if (status === "on_track") {
    return "bg-[var(--color-success-100)] text-[var(--color-success-700)]";
  }

  if (status === "at_risk") {
    return "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]";
  }

  if (status === "over_budget") {
    return "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]";
  }

  return "bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]";
}

function availabilityClass(status: "available" | "partial" | "unavailable") {
  if (status === "available") {
    return "bg-[var(--color-success-100)] text-[var(--color-success-700)]";
  }

  if (status === "partial") {
    return "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]";
  }

  return "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]";
}
