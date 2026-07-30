"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DailyReportForm, ReportLoadingState } from "@/components/daily-reports";
import { ErrorState } from "@/components/ui";
import { useDailyReport, useDailyReports } from "@/lib/daily-reports";
import { useI18n } from "@/lib/i18n/provider";

export default function EditDailyReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const reportId = typeof params.id === "string" ? params.id : "";

  const { projectOptions, superintendentOptions } = useDailyReports();
  const {
    draft,
    isLoading,
    isSaving,
    errorMessage,
    validationErrors,
    setDraft,
    save,
    regenerateSummary,
  } = useDailyReport({ reportId });

  if (isLoading || !draft) {
    return <ReportLoadingState />;
  }

  if (errorMessage) {
    return <ErrorState title={t("dailyReports.error.title")} description={t(errorMessage)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{t("dailyReports.edit.title")}</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("dailyReports.edit.description")}</p>
        </div>
        <Link href={`/daily-reports/${reportId}`} className="text-sm font-semibold text-[var(--color-brand-700)] hover:underline">
          {t("dailyReports.actions.viewReport")}
        </Link>
      </div>

      <DailyReportForm
        value={draft}
        projectOptions={projectOptions}
        superintendentOptions={superintendentOptions}
        validationErrors={validationErrors}
        isSaving={isSaving}
        onChange={setDraft}
        onSave={async (status) => {
          const savedId = await save(status);
          if (savedId) {
            router.push(`/daily-reports/${savedId}`);
          }
        }}
        onRegenerateSummary={regenerateSummary}
        t={t}
      />
    </div>
  );
}
