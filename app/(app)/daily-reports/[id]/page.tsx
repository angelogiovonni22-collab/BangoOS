"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AiSummaryPanel, ReportLoadingState, ReportStatusChip } from "@/components/daily-reports";
import { Card, CardContent, CardHeader, CardTitle, ErrorState, PageHeader } from "@/components/ui";
import { createDailyReportsService } from "@/lib/daily-reports";
import { useI18n } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import type { DailyReport } from "@/lib/daily-reports";

export default function DailyReportDetailsPage() {
  const params = useParams<{ id: string }>();
  const reportId = typeof params.id === "string" ? params.id : "";
  const { t } = useI18n();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const service = createDailyReportsService();

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setReport(null);

      try {
        const next = await service.getReport(reportId);

        if (!next) {
          setErrorMessage("dailyReports.error.notFound");
          return;
        }

        setReport(next);
      } catch {
        setErrorMessage("dailyReports.error.loadReport");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [reportId]);

  if (errorMessage) {
    return <ErrorState title={t("dailyReports.error.title")} description={t(errorMessage)} />;
  }

  if (isLoading || !report) {
    return <ReportLoadingState />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={`${report.reportNumber} · ${report.header.projectName}`}
        description={`${report.header.date} · ${t(`dailyReports.shift.${report.header.shift}`)} · ${report.header.superintendentName}`}
        secondaryActions={(
          <div className="flex items-center gap-2">
            <Link
              href="/daily-reports"
              className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 text-sm font-semibold text-[var(--color-text-secondary)]"
            >
              Back to reports
            </Link>
            <ReportStatusChip status={report.header.overallStatus} t={t} />
          </div>
        )}
        primaryAction={(
          <Link href={`/daily-reports/${report.id}/edit`} className="rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-3 py-2 text-sm font-semibold text-white">
            {t("dailyReports.actions.edit")}
          </Link>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card as="section">
          <CardHeader><CardTitle>{t("dailyReports.sections.header")}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <Info label={t("dailyReports.fields.projectManager")} value={report.header.projectManagerName} />
            <Info label={t("dailyReports.fields.weather")} value={t(`dailyReports.weather.${report.header.weather}`)} />
            <Info label={t("dailyReports.fields.temperature")} value={`${report.header.temperatureF}F`} />
            <Info label={t("dailyReports.fields.siteConditions")} value={t(`dailyReports.siteConditions.${report.header.siteConditions}`)} />
            <Info label={t("dailyReports.labor.totalHours")} value={report.laborTotals.totalLaborHours.toFixed(1)} />
            <Info label={t("dailyReports.fields.status")} value={t(`dailyReports.status.${report.header.overallStatus}`)} />
          </CardContent>
        </Card>

        <Card as="section">
          <CardHeader><CardTitle>{t("dailyReports.sections.timeline")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {report.timeline.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{t("dailyReports.timeline.empty")}</p>
            ) : (
              report.timeline
                .slice()
                .sort((a, b) => a.happenedAt.localeCompare(b.happenedAt))
                .map((event) => (
                  <div key={event.id} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-2 text-sm">
                    <p className="font-semibold text-[var(--color-text-primary)]">{new Date(event.happenedAt).toLocaleString()} · {t(`dailyReports.timelineType.${event.eventType}`)}</p>
                    <p className="text-[var(--color-text-secondary)]">{event.description}</p>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card as="section">
        <CardHeader><CardTitle>{t("dailyReports.sections.workCompleted")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {report.workCompleted.map((item) => (
            <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-3 text-sm">
              <p className="font-semibold text-[var(--color-text-primary)]">{item.activity}</p>
              <p className="text-[var(--color-text-secondary)]">{item.quantity} {item.unit} · {item.percentComplete}% · {item.productionNotes || t("dailyReports.common.none")}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card as="section">
        <CardHeader><CardTitle>{t("dailyReports.sections.equipment")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(report.equipment || []).length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">{t("dailyReports.common.none")}</p>
          ) : (report.equipment || []).map((item) => (
            <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-3 text-sm">
              <p className="font-semibold text-[var(--color-text-primary)]">{item.equipmentId} · {item.operatorName || t("dailyReports.common.none")}</p>
              <p className="text-[var(--color-text-secondary)]">
                {t("dailyReports.fields.runtime")}: {item.runtimeHours}h · {t("dailyReports.fields.idle")}: {item.idleHours}h · {t("dailyReports.fields.downtime")}: {item.downtimeHours}h
              </p>
              <p className="text-[var(--color-text-secondary)]">{item.maintenanceNotes || t("dailyReports.common.none")}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card as="section">
          <CardHeader><CardTitle>{t("dailyReports.sections.delays")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {report.delays.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{t("dailyReports.common.none")}</p>
            ) : report.delays.map((item) => (
              <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-3 text-sm">
                <p className="font-semibold text-[var(--color-text-primary)]">{t(`dailyReports.delayCategory.${item.category}`)} · {item.durationHours}h</p>
                <p className="text-[var(--color-text-secondary)]">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card as="section">
          <CardHeader><CardTitle>{t("dailyReports.sections.safety")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {report.safety.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{t("dailyReports.common.none")}</p>
            ) : report.safety.map((item) => (
              <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-3 text-sm">
                <p className="font-semibold text-[var(--color-text-primary)]">{t(`dailyReports.safetyType.${item.type}`)} · {t(`dailyReports.severity.${item.severity}`)}</p>
                <p className="text-[var(--color-text-secondary)]">{item.notes || t("dailyReports.common.none")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <AiSummaryPanel summary={report.aiSummary} t={t} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
