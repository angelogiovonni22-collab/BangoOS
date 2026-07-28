import { SummaryCard } from "@/components/ui";
import type { ProjectTimelineSummary as ProjectTimelineSummaryModel } from "@/lib/project-intelligence/types";

type ProjectTimelineSummaryProps = {
  summary: ProjectTimelineSummaryModel;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectTimelineSummary({ summary, locale, t }: ProjectTimelineSummaryProps) {
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(summary.financialImpactTotal);

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("projects.intelligenceSummaryTitle") }>
      <SummaryCard icon="E" label={t("projects.intelligenceSummaryTotalEvents")} value={String(summary.totalEvents)} />
      <SummaryCard icon="R" label={t("projects.intelligenceSummaryOpenRisks")} value={String(summary.openRisks)} />
      <SummaryCard icon="$" label={t("projects.intelligenceSummaryFinancialImpact")} value={currency} />
      <SummaryCard
        icon="S"
        label={t("projects.intelligenceSummaryScheduleImpact")}
        value={t("projects.intelligenceSummaryScheduleDelta", { delay: summary.scheduleDelayDays, recovered: summary.scheduleRecoveredDays })}
      />
      <SummaryCard
        icon="DR"
        label={t("projects.intelligenceSummaryLastDailyReport")}
        value={summary.lastDailyReportAt ? formatShortDate(summary.lastDailyReportAt, locale) : t("projects.notProvided")}
      />
      <SummaryCard
        icon="SC"
        label={t("projects.intelligenceSummaryLastSiteCam")}
        value={summary.lastSiteCamUploadAt ? formatShortDate(summary.lastSiteCamUploadAt, locale) : t("projects.notProvided")}
      />
      <SummaryCard
        icon="C"
        label={t("projects.intelligenceSummaryCustomerActivity")}
        value={summary.latestCustomerActivityAt ? formatShortDate(summary.latestCustomerActivityAt, locale) : t("projects.notProvided")}
      />
      <SummaryCard
        icon="I"
        label={t("projects.intelligenceSummaryInspection")}
        value={t(`projects.intelligenceInspection${toTitle(summary.latestInspectionResult)}`)}
      />
    </section>
  );
}

function formatShortDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
