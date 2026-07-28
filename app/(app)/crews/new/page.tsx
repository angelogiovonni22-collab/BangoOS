"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { CrewForm } from "@/components/crews";
import { createCrewService } from "@/lib/crews";
import type { CrewEmployeeOption, UpsertCrewInput } from "@/lib/crews";
import { useI18n } from "@/lib/i18n/provider";

const PROJECT_OPTIONS = [
  "Northpoint Medical Center",
  "Project Oak",
  "Dock Expansion",
  "Harper Residence",
  "Summit Retail TI",
];

export default function NewCrewPage() {
  const { t } = useI18n();
  const router = useRouter();
  const service = useMemo(() => createCrewService(), []);
  const [isSaving, setIsSaving] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<CrewEmployeeOption[]>([]);
  const [specialtyOptions, setSpecialtyOptions] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const loadFormOptions = async () => {
      const [employees, specialties] = await Promise.all([
        service.getEmployeeOptions(),
        service.getSpecialtyOptions(),
      ]);

      if (!active) {
        return;
      }

      setEmployeeOptions(employees);
      setSpecialtyOptions(specialties);
    };

    void loadFormOptions();

    return () => {
      active = false;
    };
  }, [service]);

  const handleSubmit = async (value: UpsertCrewInput) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const created = await service.createCrew(value);
      router.push(`/crews/${created.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t("crews.new.title")} description={t("crews.new.description")} />

      <CrewForm
        mode="create"
        employeeOptions={employeeOptions}
        specialtyOptions={specialtyOptions}
        projectOptions={PROJECT_OPTIONS}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/crews")}
        t={t}
      />
    </div>
  );
}
