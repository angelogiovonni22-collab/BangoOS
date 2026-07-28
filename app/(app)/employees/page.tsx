"use client";

import Link from "next/link";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableContainer,
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

export default function EmployeesPage() {
  const { t } = useI18n();
  const {
    items,
    summary,
    crewOptions,
    query,
    setQuery,
    crew,
    setCrew,
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
  } = useEmployees();

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("employees.pageTitle")}
        description={t("employees.pageDescription")}
        primaryAction={
          <Link href="/employees/new" className="inline-flex">
            <span className="inline-flex h-11 items-center rounded-[var(--radius-lg)] bg-[var(--color-brand-600)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:bg-[var(--color-brand-700)]">
              + {t("employees.actions.addEmployee")}
            </span>
          </Link>
        }
      />

      <EmployeeDashboardMetrics summary={summary} t={t} />

      <TableContainer
        title={t("employees.directoryTitle")}
        description={t("employees.directoryDescription")}
        controls={
          <EmployeeFilters
            query={query}
            crew={crew}
            employmentStatus={employmentStatus}
            availabilityStatus={availabilityStatus}
            sortBy={sortBy}
            crewOptions={crewOptions}
            activeFilters={activeFilters}
            onQueryChange={setQuery}
            onCrewChange={setCrew}
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
            action={
              <Link
                href="/employees/new"
                className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white"
              >
                {t("employees.actions.addEmployee")}
              </Link>
            }
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
