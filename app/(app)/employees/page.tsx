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
  EmployeeDashboardMetrics,
  EmployeeFilters,
  EmployeeLoadingState,
  EmployeePagination,
  EmployeeTable,
} from "@/components/employees";
import { UsersIcon } from "@/components/employees/employee-icons";
import { useEmployees } from "@/lib/employees";
import { useI18n } from "@/lib/i18n/provider";
import Link from "next/link";

export default function EmployeesPage() {
  const { t } = useI18n();
  const {
    items,
    summary,
    crewOptions,
    supervisorOptions,
    projectOptions,
    query,
    setQuery,
    crewId,
    setCrewId,
    supervisorId,
    setSupervisorId,
    projectId,
    setProjectId,
    employmentStatus,
    setEmploymentStatus,
    availabilityStatus,
    setAvailabilityStatus,
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
  } = useEmployees();

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        title={t("employees.pageTitle")}
        description={t("employees.pageDescription")}
        secondaryActions={(
          <Link href="/employees/new">
            <Button size="md">New Employee</Button>
          </Link>
        )}
      />

      <EmployeeDashboardMetrics
        summary={summary}
        employmentStatus={employmentStatus}
        availabilityStatus={availabilityStatus}
        onShowAll={() => {
          setEmploymentStatus("all");
          setAvailabilityStatus("all");
        }}
        onAvailabilityChange={setAvailabilityStatus}
        onEmploymentStatusChange={setEmploymentStatus}
        t={t}
      />

      {partialNotices.map((notice) => (
        <PartialDataNotice key={notice} message={notice} />
      ))}

      <TableContainer
        title={t("employees.directoryTitle")}
        description={t("employees.directoryDescription")}
        controls={
          <EmployeeFilters
            query={query}
            crewId={crewId}
            supervisorId={supervisorId}
            projectId={projectId}
            employmentStatus={employmentStatus}
            availabilityStatus={availabilityStatus}
            sortBy={sortBy}
            crewOptions={crewOptions}
            supervisorOptions={supervisorOptions}
            projectOptions={projectOptions}
            activeFilters={activeFilters}
            onQueryChange={setQuery}
            onCrewChange={setCrewId}
            onSupervisorChange={setSupervisorId}
            onProjectChange={setProjectId}
            onEmploymentStatusChange={setEmploymentStatus}
            onAvailabilityStatusChange={setAvailabilityStatus}
            onSortChange={setSortBy}
            t={t}
          />
        }
      >
        {isLoading ? (
          <EmployeeLoadingState />
        ) : errorMessage ? (
          <ErrorState title={t("employees.errorTitle")} description={t(errorMessage)} compact />
        ) : items.length === 0 ? (
          <EmptyState
            compact
            icon={<UsersIcon className="h-7 w-7" />}
            title={t("employees.empty.title")}
            description={t("employees.empty.description")}
          />
        ) : (
          <>
            <EmployeeTable items={items} t={t} />
            <EmployeePagination
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