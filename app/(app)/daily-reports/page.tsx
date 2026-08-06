"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createDailyReportsService, type DailyReportsService } from "@/lib/daily-reports";
import { loadDailyReportsPageData, type DailyReportsPageData, type DailyReportsPageReport } from "@/lib/daily-reports/daily-reports-page-data";

type PageState = {
  loading: boolean;
  error: string | null;
  data: DailyReportsPageData | null;
};

const INITIAL_STATE: PageState = {
  loading: true,
  error: null,
  data: null,
};

export default function DailyReportsPage() {
  const [service] = useState<DailyReportsService>(() => createDailyReportsService());
  const requestIdRef = useRef(0);
  const [pageState, setPageState] = useState<PageState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const run = async () => {
      try {
        const data = await loadDailyReportsPageData(service);

        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }

        setPageState({ loading: false, error: null, data });
      } catch {
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }

        setPageState({ loading: false, error: "Daily Reports could not be loaded.", data: null });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">Daily Reports</h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">A stable, minimal view of company reports.</p>
          </div>

          <Link href="/daily-reports/new" className="inline-flex h-11 items-center rounded-[var(--radius-lg)] bg-[var(--color-brand-600)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-sm)]">
            Create Report
          </Link>
        </div>
      </section>

      {pageState.loading ? (
        <StaticMessage>Loading daily reports...</StaticMessage>
      ) : pageState.error ? (
        <StaticMessage error>{pageState.error}</StaticMessage>
      ) : pageState.data ? (
        <ReportsView reports={pageState.data.reports} summary={pageState.data.summary} />
      ) : null}
    </div>
  );
}

function ReportsView({ reports, summary }: { reports: DailyReportsPageReport[]; summary: DailyReportsPageData["summary"] }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total reports" value={summary.total} />
        <SummaryCard label="Pending" value={summary.pending} />
        <SummaryCard label="Approved" value={summary.approved} />
        <SummaryCard label="Rejected" value={summary.rejected} />
      </section>

      {reports.length === 0 ? (
        <StaticMessage>No daily reports found.</StaticMessage>
      ) : (
        <section className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border-subtle)]">
              <thead className="bg-[var(--color-surface-subtle)]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Project</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Employee or author</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)] bg-white">
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">{report.date}</td>
                    <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">{report.projectName}</td>
                    <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">{report.authorName}</td>
                    <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">
                      <StatusPill status={report.status} />
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <Link href={`/daily-reports/${report.id}`} className="font-semibold text-[var(--color-brand-700)] hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{value}</p>
    </article>
  );
}

function StaticMessage({ children, error = false }: { children: string; error?: boolean }) {
  return (
    <section
      className={[
        "rounded-[var(--radius-2xl)] border p-5",
        error ? "border-[var(--color-danger-200)] bg-[var(--color-danger-50)]" : "border-[var(--color-border-subtle)] bg-white",
      ].join(" ")}
    >
      <p className={error ? "text-sm font-semibold text-[var(--color-danger-700)]" : "text-sm text-[var(--color-text-secondary)]"}>{children}</p>
    </section>
  );
}

function StatusPill({ status }: { status: DailyReportsPageReport["status"] }) {
  const tone =
    status === "approved"
      ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
      : status === "reviewed"
        ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
        : status === "submitted"
          ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]"
          : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]";

  return <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", tone].join(" ")}>{status}</span>;
}
