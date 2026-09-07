"use client";

import Link from "next/link";
import { BadgeCheck, ClipboardCheck, Clock3, FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReportStatusChip } from "@/components/daily-reports";
import { EmptyState, EnterpriseTable, EnterpriseTableBody, EnterpriseTableCell, EnterpriseTableHead, EnterpriseTableHeading, EnterpriseTableRow, PageHeader, SummaryCard, TableContainer, getButtonClassName } from "@/components/ui";
import { createDailyReportsService, type DailyReportsService } from "@/lib/daily-reports";
import { loadDailyReportsPageData, type DailyReportsPageData, type DailyReportsPageReport } from "@/lib/daily-reports/daily-reports-page-data";
import { useI18n } from "@/lib/i18n/provider";

type PageState = { loading: boolean; error: string | null; data: DailyReportsPageData | null };
type ReportSummaryFilter = "all" | "submitted" | "reviewed" | "approved";
const INITIAL_STATE: PageState = { loading: true, error: null, data: null };

export default function DailyReportsPage() {
  const { t, locale } = useI18n();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;
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
        setPageState({ loading: false, error: es ? "No se pudieron cargar los reportes diarios." : "Daily Reports could not be loaded.", data: null });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [service, es]);

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader compact eyebrow={t("dailyReports.dashboard.badge")} title={l("Daily Reports", "Reportes diarios")} description={l("Capture, review, and track daily field activity across every active project.", "Captura, revisa y controla la actividad diaria de campo en todos los proyectos activos.")} primaryAction={<Link href="/daily-reports/new" className={getButtonClassName({ size: "lg" })}>{l("Create Report", "Crear reporte")}</Link>} />
      {pageState.loading ? <StaticMessage>{l("Loading daily reports...", "Cargando reportes diarios...")}</StaticMessage> : pageState.error ? <StaticMessage error>{pageState.error}</StaticMessage> : pageState.data ? <ReportsView reports={pageState.data.reports} summary={pageState.data.summary} t={t} es={es} /> : null}
    </div>
  );
}

function ReportsView({ reports, summary, t, es }: { reports: DailyReportsPageReport[]; summary: DailyReportsPageData["summary"]; t: (key: string, params?: Record<string, string | number>) => string; es: boolean }) {
  const l = (en: string, spanish: string) => es ? spanish : en;
  const [summaryFilter, setSummaryFilter] = useState<ReportSummaryFilter>("all");
  const filteredReports = useMemo(
    () => summaryFilter === "all" ? reports : reports.filter((report) => report.status === summaryFilter),
    [reports, summaryFilter],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={l("Daily report summary filters", "Filtros de resumen de reportes diarios")}>
        <SummaryCard icon={<FileText aria-hidden="true" />} label={l("Total Reports", "Reportes totales")} value={String(summary.total)} tone="brand" compact onClick={() => setSummaryFilter("all")} selected={summaryFilter === "all"} actionLabel={l("Show all daily reports", "Mostrar todos los reportes diarios")} />
        <SummaryCard icon={<Clock3 aria-hidden="true" />} label={l("Pending Review", "Pendientes de revisión")} value={String(summary.pending)} tone="warning" compact onClick={() => setSummaryFilter("submitted")} selected={summaryFilter === "submitted"} actionLabel={l("Show daily reports pending review", "Mostrar reportes diarios pendientes de revisión")} />
        <SummaryCard icon={<ClipboardCheck aria-hidden="true" />} label={l("Reviewed", "Revisados")} value={String(summary.reviewed)} tone="info" compact onClick={() => setSummaryFilter("reviewed")} selected={summaryFilter === "reviewed"} actionLabel={l("Show reviewed daily reports", "Mostrar reportes diarios revisados")} />
        <SummaryCard icon={<BadgeCheck aria-hidden="true" />} label={l("Approved", "Aprobados")} value={String(summary.approved)} tone="success" compact onClick={() => setSummaryFilter("approved")} selected={summaryFilter === "approved"} actionLabel={l("Show approved daily reports", "Mostrar reportes diarios aprobados")} />
      </section>

      {reports.length === 0 ? (
        <EmptyState
          icon="R"
          title={l("No daily reports yet", "Aún no hay reportes diarios")}
          description={l("Create the first field report to begin tracking daily production, workforce activity, safety, and jobsite conditions.", "Crea el primer reporte de campo para comenzar a controlar la producción diaria, la actividad del personal, la seguridad y las condiciones del sitio.")}
          action={<Link href="/daily-reports/new" className={getButtonClassName()}>{l("Create Report", "Crear reporte")}</Link>}
        />
      ) : filteredReports.length === 0 ? (
        <EmptyState compact icon="R" title={l("No reports in this status", "No hay reportes con este estado")} description={l("Choose another summary card to see the rest of your daily reports.", "Elige otra tarjeta de resumen para ver el resto de los reportes diarios.")} />
      ) : (
        <TableContainer title={l("Reports", "Reportes")} description={l("Daily report directory with status visibility and direct access.", "Directorio de reportes diarios con estado visible y acceso directo.")}>
          <EnterpriseTable ariaLabel={l("Daily reports directory", "Directorio de reportes diarios")} minWidthClassName="min-w-[820px]">
            <EnterpriseTableHead><tr><EnterpriseTableHeading>{l("Date", "Fecha")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Project", "Proyecto")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Employee or author", "Empleado o autor")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("Status", "Estado")}</EnterpriseTableHeading><EnterpriseTableHeading>{l("View", "Ver")}</EnterpriseTableHeading></tr></EnterpriseTableHead>
            <EnterpriseTableBody>{filteredReports.map((report) => <EnterpriseTableRow key={report.id}><EnterpriseTableCell>{report.date}</EnterpriseTableCell><EnterpriseTableCell>{report.projectName}</EnterpriseTableCell><EnterpriseTableCell>{report.authorName}</EnterpriseTableCell><EnterpriseTableCell><ReportStatusChip status={report.status} t={t} /></EnterpriseTableCell><EnterpriseTableCell><Link href={`/daily-reports/${report.id}`} className="font-semibold text-[var(--color-brand-700)] hover:underline">{l("View", "Ver")}</Link></EnterpriseTableCell></EnterpriseTableRow>)}</EnterpriseTableBody>
          </EnterpriseTable>
        </TableContainer>
      )}
    </div>
  );
}

function StaticMessage({ children, error = false }: { children: string; error?: boolean }) {
  return <section className={["rounded-[var(--radius-2xl)] border p-5", error ? "border-[var(--color-danger-200)] bg-[var(--color-danger-50)]" : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]"].join(" ")}><p className={error ? "text-sm font-semibold text-[var(--color-danger-700)]" : "text-sm text-[var(--color-text-secondary)]"}>{children}</p></section>;
}
