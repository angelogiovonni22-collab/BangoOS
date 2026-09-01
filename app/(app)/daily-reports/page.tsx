"use client";

import Link from "next/link";
import { BadgeCheck, ClipboardCheck, Clock3, FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReportStatusChip } from "@/components/daily-reports";
import { Button, EmptyState, EnterpriseTable, EnterpriseTableBody, EnterpriseTableCell, EnterpriseTableHead, EnterpriseTableHeading, EnterpriseTableRow, PageHeader, SummaryCard, TableContainer } from "@/components/ui";
import { createDailyReportsService, type DailyReportsService } from "@/lib/daily-reports";
import { loadDailyReportsPageData, type DailyReportsPageData, type DailyReportsPageReport } from "@/lib/daily-reports/daily-reports-page-data";
import { useI18n } from "@/lib/i18n/provider";

type PageState = { loading: boolean; error: string | null; data: DailyReportsPageData | null };
type ReportSummaryFilter = "all" | "submitted" | "reviewed" | "approved";
const INITIAL_STATE: PageState = { loading: true, error: null, data: null };

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
        if (cancelled || requestId !== requestIdRef.current) return;
        setPageState({ loading: false, error: null, data });
      } catch {
        if (cancelled || requestId !== requestIdRef.current) return;
        setPageState({ loading: false, error: "Daily Reports could not be loaded.", data: null });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [service]);

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader compact eyebrow="Field Operations" title="Daily Reports" description="Capture, review, and track daily field activity across every active project." primaryAction={<Link href="/daily-reports/new"><Button size="lg">Create Report</Button></Link>} />
      {pageState.loading ? <StaticMessage>Loading daily reports...</StaticMessage> : pageState.error ? <StaticMessage error>{pageState.error}</StaticMessage> : pageState.data ? <ReportsView reports={pageState.data.reports} summary={pageState.data.summary} t={t} /> : null}
    </div>
  );
}

function ReportsView({ reports, summary, t }: { reports: DailyReportsPageReport[]; summary: DailyReportsPageData["summary"]; t: (key: string, params?: Record<string, string | number>) => string }) {
  const [summaryFilter, setSummaryFilter] = useState<ReportSummaryFilter>("all");
  const filteredReports = useMemo(
    () => summaryFilter === "all" ? reports : reports.filter((report) => report.status === summaryFilter),
    [reports, summaryFilter],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Daily report summary filters">
        <SummaryCard icon={<FileText aria-hidden="true" />} label="Total Reports" value={String(summary.total)} tone="brand" compact onClick={() => setSummaryFilter("all")} selected={summaryFilter === "all"} actionLabel="Show all daily reports" />
        <SummaryCard icon={<Clock3 aria-hidden="true" />} label="Pending Review" value={String(summary.pending)} tone="warning" compact onClick={() => setSummaryFilter("submitted")} selected={summaryFilter === "submitted"} actionLabel="Show daily reports pending review" />
        <SummaryCard icon={<ClipboardCheck aria-hidden="true" />} label="Reviewed" value={String(summary.reviewed)} tone="info" compact onClick={() => setSummaryFilter("reviewed")} selected={summaryFilter === "reviewed"} actionLabel="Show reviewed daily reports" />
        <SummaryCard icon={<BadgeCheck aria-hidden="true" />} label="Approved" value={String(summary.approved)} tone="success" compact onClick={() => setSummaryFilter("approved")} selected={summaryFilter === "approved"} actionLabel="Show approved daily reports" />
      </section>

      {reports.length === 0 ? (
        <EmptyState
          icon="R"
          title="No daily reports yet"
          description="Create the first field report to begin tracking daily production, workforce activity, safety, and jobsite conditions."
          action={<Link href="/daily-reports/new"><Button>Create Report</Button></Link>}
        />
      ) : filteredReports.length === 0 ? (
        <EmptyState compact icon="R" title="No reports in this status" description="Choose another summary card to see the rest of your daily reports." />
      ) : (
        <TableContainer title="Reports" description="Daily report directory with status visibility and direct access.">
          <EnterpriseTable ariaLabel="Daily reports directory" minWidthClassName="min-w-[820px]">
            <EnterpriseTableHead><tr><EnterpriseTableHeading>Date</EnterpriseTableHeading><EnterpriseTableHeading>Project</EnterpriseTableHeading><EnterpriseTableHeading>Employee or author</EnterpriseTableHeading><EnterpriseTableHeading>Status</EnterpriseTableHeading><EnterpriseTableHeading>View</EnterpriseTableHeading></tr></EnterpriseTableHead>
            <EnterpriseTableBody>{filteredReports.map((report) => <EnterpriseTableRow key={report.id}><EnterpriseTableCell>{report.date}</EnterpriseTableCell><EnterpriseTableCell>{report.projectName}</EnterpriseTableCell><EnterpriseTableCell>{report.authorName}</EnterpriseTableCell><EnterpriseTableCell><ReportStatusChip status={report.status} t={t} /></EnterpriseTableCell><EnterpriseTableCell><Link href={`/daily-reports/${report.id}`} className="font-semibold text-[var(--color-brand-700)] hover:underline">View</Link></EnterpriseTableCell></EnterpriseTableRow>)}</EnterpriseTableBody>
          </EnterpriseTable>
        </TableContainer>
      )}
    </div>
  );
}

function StaticMessage({ children, error = false }: { children: string; error?: boolean }) {
  return <section className={["rounded-[var(--radius-2xl)] border p-5", error ? "border-[var(--color-danger-200)] bg-[var(--color-danger-50)]" : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]"].join(" ")}><p className={error ? "text-sm font-semibold text-[var(--color-danger-700)]" : "text-sm text-[var(--color-text-secondary)]"}>{children}</p></section>;
}
