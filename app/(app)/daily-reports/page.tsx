"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ReportStatusChip } from "@/components/daily-reports";
import {
  Button,
  EnterpriseTable,
  EnterpriseTableBody,
  EnterpriseTableCell,
  EnterpriseTableHead,
  EnterpriseTableHeading,
  EnterpriseTableRow,
  PageHeader,
  TableContainer,
} from "@/components/ui";
import { createDailyReportsService, type DailyReportsService } from "@/lib/daily-reports";
import { loadDailyReportsPageData, type DailyReportsPageData, type DailyReportsPageReport } from "@/lib/daily-reports/daily-reports-page-data";
import { useI18n } from "@/lib/i18n/provider";

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
  const { t } = useI18n();
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
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow="Field Operations"
        title="Daily Reports"
        description="A stable, minimal view of company reports."
        primaryAction={(
          <Link href="/daily-reports/new">
            <Button size="lg">Create Report</Button>
          </Link>
        )}
      />

      {pageState.loading ? (
        <StaticMessage>Loading daily reports...</StaticMessage>
      ) : pageState.error ? (
        <StaticMessage error>{pageState.error}</StaticMessage>
      ) : pageState.data ? (
        <ReportsView reports={pageState.data.reports} summary={pageState.data.summary} t={t} />
      ) : null}
    </div>
  );
}

function ReportsView({ reports, summary, t }: { reports: DailyReportsPageReport[]; summary: DailyReportsPageData["summary"]; t: (key: string, params?: Record<string, string | number>) => string }) {
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
        <TableContainer title="Reports" description="Daily report directory with status visibility and direct access.">
          <EnterpriseTable ariaLabel="Daily reports directory" minWidthClassName="min-w-[920px]">
            <EnterpriseTableHead>
              <tr>
                <EnterpriseTableHeading>Date</EnterpriseTableHeading>
                <EnterpriseTableHeading>Project</EnterpriseTableHeading>
                <EnterpriseTableHeading>Employee or author</EnterpriseTableHeading>
                <EnterpriseTableHeading>Status</EnterpriseTableHeading>
                <EnterpriseTableHeading>View</EnterpriseTableHeading>
              </tr>
            </EnterpriseTableHead>
            <EnterpriseTableBody>
              {reports.map((report) => (
                <EnterpriseTableRow key={report.id}>
                  <EnterpriseTableCell>{report.date}</EnterpriseTableCell>
                  <EnterpriseTableCell>{report.projectName}</EnterpriseTableCell>
                  <EnterpriseTableCell>{report.authorName}</EnterpriseTableCell>
                  <EnterpriseTableCell>
                    <ReportStatusChip status={report.status} t={t} />
                  </EnterpriseTableCell>
                  <EnterpriseTableCell>
                    <Link href={`/daily-reports/${report.id}`} className="font-semibold text-[var(--color-brand-700)] hover:underline">
                      View
                    </Link>
                  </EnterpriseTableCell>
                </EnterpriseTableRow>
              ))}
            </EnterpriseTableBody>
          </EnterpriseTable>
        </TableContainer>
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

