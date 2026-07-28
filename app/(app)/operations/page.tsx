"use client";

import { useState } from "react";
import {
  AiOperationsSummary,
  AttentionQueue,
  CrewAllocationPanel,
  DailySchedule,
  OperationsEmptyState,
  OperationsHeader,
  OperationsKpiGrid,
  OperationsLoadingState,
  OperationsQuickActions,
  ProjectOperationsPanel,
  SafetyCompliancePanel,
  SiteCamActivityPanel,
  WorkforceStatusPanel,
} from "@/components/operations";
import { ErrorState } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { useOperations } from "@/lib/operations";

export default function OperationsPage() {
  const { t } = useI18n();
  const {
    filters,
    setDate,
    setShift,
    setProject,
    setQuery,
    attentionScope,
    setAttentionScope,
    payload,
    filteredAttention,
    isLoading,
    errorMessage,
    refresh,
  } = useOperations();
  const [noteOpen, setNoteOpen] = useState(false);

  if (isLoading) {
    return <OperationsLoadingState />;
  }

  if (errorMessage || !payload) {
    return <ErrorState title={t("operations.errorTitle")} description={t(errorMessage || "operations.errorLoad")} />;
  }

  const hasNoData = payload.projects.length === 0
    && payload.crewAllocations.length === 0
    && payload.schedule.length === 0;

  return (
    <div className="space-y-6">
      <OperationsHeader
        title={t("operations.header.title")}
        dateLabel={payload.summary.dateLabel}
        summary={t(payload.summary.dailySummary)}
        companyContext={payload.summary.companyContext}
        locationContext={payload.summary.locationContext}
        date={filters.date}
        shift={filters.shift}
        project={filters.project}
        query={filters.query}
        projectOptions={payload.projectOptions}
        onDateChange={setDate}
        onShiftChange={setShift}
        onProjectChange={setProject}
        onQueryChange={setQuery}
        onRefresh={refresh}
        t={t}
      />

      <OperationsQuickActions onCreateNote={() => setNoteOpen(true)} t={t} />

      {hasNoData ? (
        <OperationsEmptyState title={t("operations.empty.title")} description={t("operations.empty.description")} />
      ) : (
        <>
          <OperationsKpiGrid
            items={payload.summary.kpis.map((item) => ({
              ...item,
              label: t(item.label),
              insight: t(item.insight),
              trend: t(item.trend),
            }))}
          />

          <ProjectOperationsPanel items={payload.projects} t={t} />

          <div className="grid gap-5 2xl:grid-cols-2">
            <CrewAllocationPanel items={payload.crewAllocations} t={t} />
            <WorkforceStatusPanel data={payload.workforce} t={t} />
          </div>

          <DailySchedule items={payload.schedule} t={t} />

          <div className="grid gap-5 2xl:grid-cols-2">
            <SafetyCompliancePanel items={payload.safetyAlerts} t={t} />
            <SiteCamActivityPanel items={payload.sitecamActivity} t={t} />
          </div>

          <AiOperationsSummary items={payload.insights} t={t} />
          <AttentionQueue items={filteredAttention} scope={attentionScope} onScopeChange={setAttentionScope} t={t} />
        </>
      )}

      {noteOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-large)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">{t("operations.quickActions.createOperationsNote")}</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("operations.quickActions.notePlaceholder")}</p>
            <textarea
              rows={5}
              className="mt-4 w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
              placeholder={t("operations.quickActions.noteInputPlaceholder")}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)]"
              >
                {t("operations.actions.close")}
              </button>
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                className="rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-3 py-2 text-sm font-semibold text-white"
              >
                {t("operations.actions.saveNote")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
