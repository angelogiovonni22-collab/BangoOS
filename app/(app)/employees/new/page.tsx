"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeeForm } from "@/components/employees";
import { ErrorState, PageHeader } from "@/components/ui";
import { createEmployeeService } from "@/lib/employees";
import { createCrewService } from "@/lib/crews";
import { useI18n } from "@/lib/i18n/provider";

export default function NewEmployeePage() {
  const { t } = useI18n();
  const router = useRouter();
  const employeeService = useMemo(() => createEmployeeService(), []);
  const crewService = useMemo(() => createCrewService(), []);

  const [crewOptions, setCrewOptions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const crews = await crewService.getCrews({
          query: "",
          status: "all",
          leadId: "all",
          supervisorId: "all",
          projectId: "all",
          assignmentStatus: "all",
          sortBy: "name_asc",
          page: 1,
          pageSize: 50,
        });

        if (!active) {
          return;
        }

        const options = crews.items.map((crew) => crew.name).filter(Boolean);
        setCrewOptions(options.length > 0 ? options : ["General Crew"]);
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
  }, [crewService]);

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
        <PageHeader title="Employee records" description="Create a workforce employee profile." />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title={t("employees.errorTitle")} description={t(errorMessage)} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Employee records" description="Create a workforce employee profile." />
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
