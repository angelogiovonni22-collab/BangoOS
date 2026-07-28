"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { EmployeeLoadingState, EmployeeProfileSections } from "@/components/employees";
import { useEmployeeProfile } from "@/lib/employees";
import { useI18n } from "@/lib/i18n/provider";
import { UsersIcon } from "@/components/employees/employee-icons";

export default function EmployeeProfilePage() {
  const params = useParams<{ id?: string | string[] }>();
  const employeeId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const { t, locale } = useI18n();
  const { employee, isLoading, errorMessage, notFound } = useEmployeeProfile({ employeeId });

  if (isLoading) {
    return <EmployeeLoadingState />;
  }

  if (errorMessage) {
    return <ErrorState title={t("employees.errorTitle")} description={t(errorMessage)} />;
  }

  if (notFound || !employee) {
    return (
      <EmptyState
        icon={<UsersIcon className="h-7 w-7" />}
        title={t("employees.notFound.title")}
        description={t("employees.notFound.description")}
        action={
          <Link
            href="/employees"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
          >
            {t("employees.actions.backToDirectory")}
          </Link>
        }
      />
    );
  }

  const localeTag = locale === "es" ? "es-ES" : "en-US";

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee.fullName}
        description={t("employees.profile.description")}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/employees"
              className="inline-flex h-11 items-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 text-sm font-semibold text-[var(--color-text-secondary)]"
            >
              {t("employees.actions.backToDirectory")}
            </Link>
            <Link
              href={`/employees/${employee.id}/edit`}
              className="inline-flex h-11 items-center rounded-[var(--radius-lg)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white"
            >
              {t("employees.actions.edit")}
            </Link>
          </div>
        }
      />

      <EmployeeProfileSections employee={employee} locale={localeTag} t={t} />
    </div>
  );
}
