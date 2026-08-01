"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Dialog, ErrorState } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { useLaborForecast, useScheduling, type LaborForecastRange, type ScheduleView } from "@/lib/scheduling";
import { AssignmentForm } from "./assignment-form";
import { AvailableResourcesPanel } from "./available-resources-panel";
import { ConflictCenter } from "./conflict-center";
import { DispatchBoard } from "./dispatch-board";
import { LaborDemandChart } from "./labor-demand-chart";
import { LaborForecastSummary } from "./labor-forecast-summary";
import { LaborShortageTable } from "./labor-shortage-table";
import { OpenShiftsPanel } from "./open-shifts-panel";
import { ScheduleCalendar } from "./schedule-calendar";
import { ScheduleHealthCard } from "./schedule-health-card";
import { SchedulingAiAssistant } from "./scheduling-ai-assistant";
import { SchedulingAnalytics } from "./scheduling-analytics";
import { SchedulingEmptyState } from "./scheduling-empty-state";
import { SchedulingHeader } from "./scheduling-header";
import { SchedulingKpiGrid } from "./scheduling-kpi-grid";
import { SchedulingLoadingState } from "./scheduling-loading-state";

type SchedulingDashboardProps = {
  initialSection?: "overview" | "dispatch" | "calendar" | "forecast";
};

export function SchedulingDashboard({ initialSection = "overview" }: SchedulingDashboardProps) {
  const { t } = useI18n();
  const scheduling = useScheduling();
  const [activeSection, setActiveSection] = useState(initialSection);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<{ assignmentId: string; previousDate: string } | null>(null);

  const assignments = scheduling.filteredAssignments;
  const forecastHook = useLaborForecast(scheduling.payload?.assignments || []);

  const handlePeriodMove = (deltaDays: number) => {
    const base = new Date(`${scheduling.periodDate}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + deltaDays);
    scheduling.setPeriodDate(base.toISOString().slice(0, 10));
  };

  const onMoveAssignment = (assignmentId: string, targetDate: string) => {
    const current = scheduling.payload?.assignments.find((item) => item.id === assignmentId);
    if (!current) {
      return;
    }

    setUndoSnapshot({ assignmentId, previousDate: current.date });
    void scheduling.moveAssignmentCard(assignmentId, { date: targetDate });
  };

  const onQuickMoveShift = (assignmentId: string, shift: "day" | "swing" | "night") => {
    void scheduling.moveAssignmentCard(assignmentId, { shift });
  };

  const onUndo = () => {
    if (!undoSnapshot) {
      return;
    }

    void scheduling.moveAssignmentCard(undoSnapshot.assignmentId, { date: undoSnapshot.previousDate });
    setUndoSnapshot(null);
  };

  const openSections = useMemo(() => [
    { key: "overview", label: t("scheduling.sections.overview") },
    { key: "calendar", label: t("scheduling.sections.calendar") },
    { key: "dispatch", label: t("scheduling.sections.dispatch") },
    { key: "forecast", label: t("scheduling.sections.forecast") },
  ] as const, [t]);

  if (scheduling.isLoading && !scheduling.payload) {
    return <SchedulingLoadingState />;
  }

  if (scheduling.errorMessage || !scheduling.payload) {
    return <ErrorState title={t("scheduling.errorTitle")} description={t(scheduling.errorMessage || "scheduling.errorLoad")} />;
  }

  const payload = scheduling.payload;

  return (
    <div className="space-y-6">
      <SchedulingHeader
        title={t("scheduling.pageTitle")}
        dateRangeLabel={t(payload.summary.dateRangeLabel)}
        summary={t(payload.summary.operationalSummary)}
        companyContext={payload.summary.companyContext}
        branchContext={payload.summary.branchContext}
        periodDate={scheduling.periodDate}
        view={scheduling.view}
        filters={scheduling.filters}
        projectOptions={payload.projectOptions}
        crewOptions={payload.crewOptions}
        tradeOptions={payload.tradeOptions}
        onViewChange={(value) => scheduling.setView(value as ScheduleView)}
        onPeriodDateChange={scheduling.setPeriodDate}
        onPrev={() => handlePeriodMove(scheduling.view === "month" ? -30 : scheduling.view === "week" ? -7 : -1)}
        onNext={() => handlePeriodMove(scheduling.view === "month" ? 30 : scheduling.view === "week" ? 7 : 1)}
        onToday={() => scheduling.setPeriodDate(new Date().toISOString().slice(0, 10))}
        onRefresh={scheduling.refresh}
        onCreateAssignment={() => setIsCreateOpen(true)}
        onOpenDispatch={() => setActiveSection("dispatch")}
        onFilterChange={scheduling.setFilter}
        t={t}
      />

      <nav className="flex flex-wrap gap-2">
        {openSections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActiveSection(section.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${activeSection === section.key ? "border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white" : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]"}`}
          >
            {section.label}
          </button>
        ))}
        <Link href="/scheduling/dispatch" className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{t("scheduling.routes.dispatch")}</Link>
        <Link href="/scheduling/calendar" className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{t("scheduling.routes.calendar")}</Link>
        <Link href="/scheduling/forecast" className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{t("scheduling.routes.forecast")}</Link>
      </nav>

      <SchedulingKpiGrid
        items={payload.summary.kpis}
        onDrillDown={(id) => {
          if (id === "conflicts") {
            setActiveSection("overview");
          }
          if (id === "openShifts") {
            setActiveSection("overview");
          }
          if (id === "scheduleHealth") {
            setActiveSection("overview");
          }
        }}
        t={t}
      />

      {undoSnapshot ? (
        <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-info-200)] bg-[var(--color-info-50)] px-4 py-3 text-sm text-[var(--color-info-700)]">
          <p>{t("scheduling.feedback.assignmentMoved")}</p>
          <button type="button" onClick={onUndo} className="font-semibold underline">{t("scheduling.actions.undo")}</button>
        </div>
      ) : null}

      {assignments.length === 0 ? (
        <SchedulingEmptyState
          title={t("scheduling.empty.filteredTitle")}
          description={t("scheduling.empty.filteredDescription")}
          actionLabel={t("scheduling.actions.refresh")}
        />
      ) : null}

      {(activeSection === "overview" || activeSection === "calendar") && assignments.length > 0 ? (
        <ScheduleCalendar
          view={scheduling.view}
          groupBy={scheduling.filters.groupBy}
          date={scheduling.periodDate}
          assignments={assignments}
          onMoveAssignment={onMoveAssignment}
          onQuickMoveShift={onQuickMoveShift}
          t={t}
        />
      ) : null}

      {(activeSection === "overview" || activeSection === "dispatch") ? (
        <DispatchBoard
          resources={payload.dispatch}
          projectOptions={payload.projectOptions}
          tradeOptions={payload.tradeOptions}
          onMove={(dispatchId, status) => {
            const delayReason = status === "delayed" ? "Manual dispatch delay" : null;
            void scheduling.moveDispatch(dispatchId, status, delayReason);
          }}
          t={t}
        />
      ) : null}

      {(activeSection === "overview" || activeSection === "forecast") ? (
        <div className="space-y-4">
          <LaborForecastSummary
            forecast={forecastHook.forecast}
            range={forecastHook.range}
            onRangeChange={(value) => forecastHook.setRange(value as LaborForecastRange)}
            t={t}
          />
          <div className="grid gap-4 2xl:grid-cols-2">
            <LaborDemandChart title={t("scheduling.forecast.demandByTrade")} data={forecastHook.forecast.demandByTrade} t={t} />
            <LaborDemandChart title={t("scheduling.forecast.demandByProject")} data={forecastHook.forecast.demandByProject} t={t} />
          </div>
          <div className="grid gap-4 2xl:grid-cols-2">
            <LaborShortageTable title={t("scheduling.forecast.shortageTable")} data={forecastHook.forecast.demandByTrade} mode="shortage" t={t} />
            <LaborShortageTable title={t("scheduling.forecast.surplusTable")} data={forecastHook.forecast.demandByTrade} mode="surplus" t={t} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-2">
        <OpenShiftsPanel
          items={payload.openShifts}
          employeeOptions={payload.employeeOptions}
          crewOptions={payload.crewOptions}
          onAssign={(openShiftId, employeeId, crewId) => {
            void scheduling.fillOpenShift(openShiftId, employeeId, crewId);
          }}
          t={t}
        />
        <AvailableResourcesPanel
          items={payload.availability}
          onQuickAssign={() => setIsCreateOpen(true)}
          t={t}
        />
      </div>

      <div className="grid gap-5 2xl:grid-cols-2">
        <ConflictCenter
          items={payload.conflicts}
          onResolve={(conflictId, status) => {
            void scheduling.resolveConflict(conflictId, status);
          }}
          t={t}
        />
        <ScheduleHealthCard health={payload.health} t={t} />
      </div>

      <div className="grid gap-5 2xl:grid-cols-2">
        <SchedulingAiAssistant
          insights={payload.insights}
          onAccept={(insightId) => {
            void scheduling.acceptInsight(insightId);
          }}
          onDismiss={(insightId) => {
            void scheduling.dismissInsight(insightId);
          }}
          t={t}
        />
        <SchedulingAnalytics analytics={payload.analytics} t={t} />
      </div>

      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        ariaLabel={t("scheduling.form.titleCreate")}
        backdropLabel={t("scheduling.actions.close")}
        panelClassName="max-h-[92vh] max-w-4xl overflow-auto rounded-[var(--radius-2xl)] p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">{t("scheduling.form.titleCreate")}</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
            {t("scheduling.actions.close")}
          </Button>
        </div>

        <AssignmentForm
          projectOptions={payload.projectOptions}
          crewOptions={payload.crewOptions}
          employeeOptions={payload.employeeOptions}
          tradeOptions={payload.tradeOptions}
          onSubmit={async (draft) => {
            await scheduling.createNewAssignment(draft);
            setIsCreateOpen(false);
          }}
          onCancel={() => setIsCreateOpen(false)}
          t={t}
        />
      </Dialog>
    </div>
  );
}
