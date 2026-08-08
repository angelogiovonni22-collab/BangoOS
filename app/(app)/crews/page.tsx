"use client";

import {
  EmptyState,
  ErrorState,
  PageHeader,
  PartialDataNotice,
  TableContainer,
  Button,
} from "@/components/ui";
import {
  CrewDashboardMetrics,
  CrewFilters,
  CrewLoadingState,
  CrewPagination,
  CrewTable,
} from "@/components/crews";
import { HardHat } from "@/components/crews/crew-icons";
import { useCrews } from "@/lib/crews";
import { useI18n } from "@/lib/i18n/provider";
import Link from "next/link";

export default function CrewsPage() {
  const { t } = useI18n();
  const {
    items,
    summary,
    leadOptions,
    supervisorOptions,
    projectOptions,
    query,
    setQuery,
    status,
    setStatus,
    leadId,
    setLeadId,
    supervisorId,
    setSupervisorId,
    projectId,
    setProjectId,
    assignmentStatus,
    setAssignmentStatus,
    sortBy,
    setSortBy,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    canPrev,
    canNext,
    activeFilters,
    isLoading,
    errorMessage,
    partialNotices,
  } = useCrews();

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        title={t("crews.pageTitle")}
        description={t("crews.pageDescription")}
        secondaryActions={(
          <Link href="/crews/new">
            <Button size="md">New Crew</Button>
          </Link>
        )}
      />

      <CrewDashboardMetrics summary={summary} t={t} />

      {partialNotices.map((notice) => (
        <PartialDataNotice key={notice} message={notice} />
      ))}

      <TableContainer
        title={t("crews.directoryTitle")}
        description={t("crews.directoryDescription")}
        controls={
          <CrewFilters
            query={query}
            status={status}
            leadId={leadId}
            supervisorId={supervisorId}
            projectId={projectId}
            assignmentStatus={assignmentStatus}
            sortBy={sortBy}
            leadOptions={leadOptions}
            supervisorOptions={supervisorOptions}
            projectOptions={projectOptions}
            activeFilters={activeFilters}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onLeadChange={setLeadId}
            onSupervisorChange={setSupervisorId}
            onProjectChange={setProjectId}
            onAssignmentStatusChange={setAssignmentStatus}
            onSortChange={setSortBy}
            t={t}
          />
        }
      >
        {isLoading ? (
          <CrewLoadingState />
        ) : errorMessage ? (
          <ErrorState title={t("crews.errorTitle")} description={t(errorMessage)} compact />
        ) : items.length === 0 ? (
          <EmptyState
            compact
            icon={<HardHat className="h-7 w-7" />}
            title={t("crews.empty.title")}
            description={t("crews.empty.description")}
          />
        ) : (
          <>
            <CrewTable items={items} t={t} />
            <CrewPagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={() => setPage(page - 1)}
              onNext={() => setPage(page + 1)}
              onPageSizeChange={setPageSize}
              t={t}
            />
          </>
        )}
      </TableContainer>
    </div>
  );
}
