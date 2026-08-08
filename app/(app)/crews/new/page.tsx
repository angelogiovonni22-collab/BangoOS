"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CrewForm } from "@/components/crews";
import { ErrorState, PageHeader } from "@/components/ui";
import { createCrewService, type CrewEmployeeOption } from "@/lib/crews";
import { useI18n } from "@/lib/i18n/provider";

export default function NewCrewPage() {
  const { t } = useI18n();
  const router = useRouter();
  const crewService = useMemo(() => createCrewService(), []);

  const [employeeOptions, setEmployeeOptions] = useState<CrewEmployeeOption[]>([]);
  const [specialtyOptions, setSpecialtyOptions] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [employees, specialties, projects] = await Promise.all([
          crewService.getEmployeeOptions(),
          crewService.getSpecialtyOptions(),
          crewService.getProjectOptions(),
        ]);

        if (!active) {
          return;
        }

        setEmployeeOptions(employees);
        setSpecialtyOptions(specialties.length > 0 ? specialties : ["General Labor"]);
        setProjectOptions(projects.map((project) => project.label));
      } catch {
        if (active) {
          setErrorMessage("crews.errorLoad");
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

  const handleSubmit = async (value: Parameters<typeof crewService.createCrew>[0]) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const created = await crewService.createCrew(value);
      router.push(`/crews/${created.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Crew records" description="Create an operations crew profile." />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title={t("crews.errorTitle")} description={t(errorMessage)} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Crew records" description="Create an operations crew profile." />
      <CrewForm
        mode="create"
        employeeOptions={employeeOptions}
        specialtyOptions={specialtyOptions}
        projectOptions={projectOptions}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/crews")}
        t={t}
      />
    </div>
  );
}
