"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ReportCreationRecoveryNotice } from "@/components/daily-reports/report-creation-recovery-notice";
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
  const { t, locale } = useI18n();
  const selectedDate = useMemo(() => searchParams.get("date") || undefined, [searchParams]);
  const selectedProjectId = useMemo(() => searchParams.get("projectId") || undefined, [searchParams]);
  const selectedProjectName = useMemo(() => searchParams.get("projectName") || undefined, [searchParams]);
  const { projectOptions, superintendentOptions } = useDailyReports();
  const scopedProjectOptions = useMemo(() => {
    if (!selectedProjectId || projectOptions.some((project) => project.id === selectedProjectId)) {
      return projectOptions;
    }

    return [{ id: selectedProjectId, name: selectedProjectName || selectedProjectId }, ...projectOptions];
  }, [projectOptions, selectedProjectId, selectedProjectName]);
  const {
    draft,
    isLoading,
    isSaving,
    errorMessage,
    validationErrors,
    saveErrorMessage,
    pendingCreationId,
    recoveredReportId,
    startSeparateReport,
    setDraft,
    save,
  } = useDailyReport({ initialDate: selectedDate, initialProjectId: selectedProjectId, initialProjectName: selectedProjectName });

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

      {saveErrorMessage ? <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-3 text-sm text-[var(--color-danger-700)]">{saveErrorMessage}</p> : null}
      <ReportCreationRecoveryNotice pendingId={pendingCreationId} recoveredId={recoveredReportId} busy={isSaving} onSeparate={startSeparateReport} es={locale === "es"} />
      <DailyReportForm
        value={draft}
        projectOptions={scopedProjectOptions}
        superintendentOptions={superintendentOptions}
        validationErrors={validationErrors}
        isSaving={isSaving}
        isSaveBlocked={Boolean(recoveredReportId)}
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
