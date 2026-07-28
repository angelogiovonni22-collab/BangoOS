"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { EmployeeForm, EmployeeLoadingState } from "@/components/employees";
import { createEmployeeService, useEmployeeProfile } from "@/lib/employees";
import type { UpsertEmployeeInput } from "@/lib/employees";
import { useI18n } from "@/lib/i18n/provider";
import { UsersIcon } from "@/components/employees/employee-icons";

export default function EditEmployeePage() {
  const { t } = useI18n();
  const params = useParams<{ id?: string | string[] }>();
  const employeeId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const router = useRouter();
  const service = useMemo(() => createEmployeeService(), []);
  const [isSaving, setIsSaving] = useState(false);
  const { employee, isLoading, errorMessage, notFound } = useEmployeeProfile({ employeeId, service });
  const crewOptions = ["Field Ops Alpha", "Field Ops Bravo", "Interior Crew", "MEP Crew", "Preconstruction", "Safety"];

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

  const handleSubmit = async (value: UpsertEmployeeInput) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const updated = await service.updateEmployee(employee.id, value);

      if (!updated) {
        throw new Error("Employee not found");
      }

      router.push(`/employees/${employee.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t("employees.edit.title")} description={t("employees.edit.description")} />

      <EmployeeForm
        mode="edit"
        initialValue={employee}
        crewOptions={crewOptions}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/employees/${employee.id}`)}
        t={t}
      />
    </div>
  );
}
