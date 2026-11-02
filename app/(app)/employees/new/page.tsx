"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeeForm } from "@/components/employees";
import { ErrorState, PageHeader } from "@/components/ui";
import { createEmployeeService } from "@/lib/employees";
import { useI18n } from "@/lib/i18n/provider";

export default function NewEmployeePage() {
  const { t } = useI18n();
  const router = useRouter();
  const employeeService = useMemo(() => createEmployeeService(), []);

  const [supervisorOptions, setSupervisorOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const options = await employeeService.getSupervisorProfileOptions();

        if (!active) {
          return;
        }

        setSupervisorOptions(options);
      } catch {
        if (active) {
          setErrorMessage("employees.errorLoad");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [employeeService]);

  const handleSubmit = async (value: Parameters<typeof employeeService.createEmployee>[0]) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const created = await employeeService.createEmployee(value);
      router.push(`/employees/${created.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("employees.form.createTitle")} description={t("employees.form.createDescription")} />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title={t("employees.errorTitle")} description={t(errorMessage)} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t("employees.form.createTitle")} description={t("employees.form.createDescription")} />
      <EmployeeForm
        mode="create"
        supervisorOptions={supervisorOptions}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/employees")}
        t={t}
      />
    </div>
  );
}
