"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "@/components/employees";
import { createEmployeeService } from "@/lib/employees";
import type { UpsertEmployeeInput } from "@/lib/employees";
import { useI18n } from "@/lib/i18n/provider";

export default function NewEmployeePage() {
  const { t } = useI18n();
  const router = useRouter();
  const service = useMemo(() => createEmployeeService(), []);
  const [isSaving, setIsSaving] = useState(false);
  const crewOptions = ["Field Ops Alpha", "Field Ops Bravo", "Interior Crew", "MEP Crew", "Preconstruction", "Safety"];

  const handleSubmit = async (value: UpsertEmployeeInput) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const created = await service.createEmployee(value);
      router.push(`/employees/${created.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t("employees.new.title")} description={t("employees.new.description")} />

      <EmployeeForm
        mode="create"
        crewOptions={crewOptions}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/employees")}
        t={t}
      />
    </div>
  );
}
