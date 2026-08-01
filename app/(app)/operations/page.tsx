"use client";

import { useMemo } from "react";
import {
  CommandCenterHeader,
  LiveProjectStatus,
  OperationsSummary,
  OrionOperationsBrief,
  PendingDecisions,
  PriorityActionQueue,
  WorkforceBoard,
} from "@/components/operations";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ScheduleWidget } from "@/components/dashboard/ScheduleWidget";
import { ErrorState, PageLoadingState, PartialDataNotice, PermissionState, SectionLoadingState } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { useOperationsCommandCenter } from "@/lib/operations";

export default function OperationsPage() {
  const { locale, t } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const {
    data,
    isLoading,
    isRefreshing,
    errorMessage,
    isPermissionError,
    focusFilter,
    setFocusFilter,
    filteredPriorityQueue,
    filteredPendingDecisions,
    refresh,
  } = useOperationsCommandCenter({ localeTag, t });

  const currentDateLabel = useMemo(() => {
    if (!data) {
      return "";
    }

    return new Intl.DateTimeFormat(localeTag, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(data.currentDateIso));
  }, [data, localeTag]);

  const lastRefreshedLabel = useMemo(() => {
    if (!data) {
      return "";
    }

    return new Intl.DateTimeFormat(localeTag, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(data.lastRefreshedAt));
  }, [data, localeTag]);

  if (isLoading) {
    return <PageLoadingState sections={6} />;
  }

  if (isPermissionError) {
    return <PermissionState title="Operations access unavailable" description={errorMessage || "Your workspace could not be resolved for this company."} />;
  }

  if (errorMessage || !data) {
    return <ErrorState title="Unable to load Operations Command Center" description={errorMessage || "The command center data could not be loaded."} />;
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <CommandCenterHeader
        companyName={data.companyName}
        currentDateLabel={currentDateLabel}
        lastRefreshedLabel={lastRefreshedLabel}
        operatingStatus={data.operatingStatus}
        healthIndicator={data.healthIndicator}
        orionState={data.orionBrief?.readinessState || null}
        focusFilter={focusFilter}
        isRefreshing={isRefreshing}
        onFocusFilterChange={setFocusFilter}
        onRefresh={refresh}
      />

      {isRefreshing ? <SectionLoadingState rows={1} /> : null}

      {data.partialNotices.map((notice) => (
        <PartialDataNotice key={notice} message={notice} />
      ))}

      <OperationsSummary metrics={data.summaryMetrics} />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <PriorityActionQueue items={filteredPriorityQueue} />
        </div>
        <div className="xl:col-span-5">
          <ScheduleWidget events={data.schedule} t={t} />
        </div>

        <div className="xl:col-span-8">
          <LiveProjectStatus items={data.projectStatus} />
        </div>
        <div className="xl:col-span-4">
          <WorkforceBoard items={data.workforceBoard} availability={data.availability.workforce} />
        </div>

        <div className="xl:col-span-7">
          <ActivityFeed items={data.activityFeed} isLoading={false} errorMessage={null} t={t} />
        </div>
        <div className="xl:col-span-5">
          <PendingDecisions items={filteredPendingDecisions} />
        </div>

        <div className="xl:col-span-12">
          <OrionOperationsBrief brief={data.orionBrief} />
        </div>
      </div>
    </div>
  );
}
