"use client";

import {
  EmptyState,
  ErrorState,
  PageHeader,
  PartialDataNotice,
  TableContainer,
  getButtonClassName,
} from "@/components/ui";
import {
  EmployeeDashboardMetrics,
  EmployeeFilters,
  EmployeeLoadingState,
  EmployeePagination,
  EmployeeTable,
} from "@/components/employees";
import { UsersIcon } from "@/components/employees/employee-icons";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";
import { useEmployees } from "@/lib/employees";
import { useI18n } from "@/lib/i18n/provider";
import Link from "next/link";

export default function EmployeesPage() {
  const { t } = useI18n();
  const { term } = useAdaptiveBos();
  const workforceLabel = term("workforce", "Workforce");
  const projectLabel = term("project", "Project");
  const projectsLabel = term("projects", "Projects");
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
        title={workforceLabel}
        description={`Manage team members, assignments, availability, and ${workforceLabel.toLowerCase()} operations.`}
        secondaryActions={<Link href="/employees/new" className={getButtonClassName({ size: "md" })}>New Team Member</Link>}
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
        workforceLabel={workforceLabel}
        projectLabel={projectLabel}
        t={t}
      />

      {partialNotices.map((notice) => (
        <PartialDataNotice key={notice} message={notice} />
      ))}

      <TableContainer
        title={`${workforceLabel} Directory`}
        description="Search team members, review current assignments, and manage availability."
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
            projectLabel={projectLabel}
            projectsLabel={projectsLabel}
            t={t}
          />
        }
      >
        {isLoading ? (
          <EmployeeLoadingState />
        ) : errorMessage ? (
          <ErrorState title={`${workforceLabel} unavailable`} description={t(errorMessage)} compact />
        ) : items.length === 0 ? (
          <EmptyState compact icon={<UsersIcon className="h-7 w-7" />} title="No team members found" description="Add a team member or adjust your filters to continue." />
        ) : (
          <>
            <EmployeeTable items={items} projectLabel={projectLabel} t={t} />
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
