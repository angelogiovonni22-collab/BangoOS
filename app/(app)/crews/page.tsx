"use client";

import Link from "next/link";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableContainer,
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

export default function CrewsPage() {
  const { t } = useI18n();
  const {
    items,
    summary,
    specialtyOptions,
    query,
    setQuery,
    status,
    setStatus,
    availability,
    setAvailability,
    specialty,
    setSpecialty,
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
  } = useCrews();

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("crews.pageTitle")}
        description={t("crews.pageDescription")}
        primaryAction={
          <Link href="/crews/new" className="inline-flex">
            <span className="inline-flex h-11 items-center rounded-[var(--radius-lg)] bg-[var(--color-brand-600)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:bg-[var(--color-brand-700)]">
              + {t("crews.actions.addCrew")}
            </span>
          </Link>
        }
      />

      <CrewDashboardMetrics summary={summary} t={t} />

      <TableContainer
        title={t("crews.directoryTitle")}
        description={t("crews.directoryDescription")}
        controls={
          <CrewFilters
            query={query}
            status={status}
            availability={availability}
            specialty={specialty}
            sortBy={sortBy}
            specialtyOptions={specialtyOptions}
            activeFilters={activeFilters}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onAvailabilityChange={setAvailability}
            onSpecialtyChange={setSpecialty}
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
            action={
              <Link
                href="/crews/new"
                className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white"
              >
                {t("crews.actions.addCrew")}
              </Link>
            }
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
