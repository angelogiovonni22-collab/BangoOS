"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DailyReportForm, ReportLoadingState } from "@/components/daily-reports";
import { ErrorState } from "@/components/ui";
import { useDailyReport, useDailyReports } from "@/lib/daily-reports";
import { useI18n } from "@/lib/i18n/provider";

export default function NewDailyReportPage() {
  return (
    <Suspense fallback={<ReportLoadingState />}>
      <NewDailyReportPageContent />
    </Suspense>
  );
}

function NewDailyReportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const selectedDate = useMemo(() => searchParams.get("date") || undefined, [searchParams]);
  const { projectOptions, superintendentOptions } = useDailyReports();
  const {
    draft,
    isLoading,
    isSaving,
    errorMessage,
    validationErrors,
    setDraft,
    save,
  } = useDailyReport({ initialDate: selectedDate });

  if (errorMessage) {
    return <ErrorState title={t("dailyReports.error.title")} description={t(errorMessage)} />;
  }

  if (isLoading || !draft) {
    return <ReportLoadingState />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{t("dailyReports.new.title")}</h2>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("dailyReports.new.description")}</p>

      <DailyReportForm
        value={draft}
        projectOptions={projectOptions}
        superintendentOptions={superintendentOptions}
        validationErrors={validationErrors}
        isSaving={isSaving}
        onChange={setDraft}
        onSave={async (status) => {
          const createdId = await save(status);
          if (createdId) {
            router.push(`/daily-reports/${createdId}`);
          }
        }}
        t={t}
      />
    </div>
  );
}
