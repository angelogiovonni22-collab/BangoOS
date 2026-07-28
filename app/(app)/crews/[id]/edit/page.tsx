"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { CrewForm, CrewLoadingState } from "@/components/crews";
import { HardHat } from "@/components/crews/crew-icons";
import { createCrewService, useCrewProfile } from "@/lib/crews";
import type { CrewEmployeeOption, UpsertCrewInput } from "@/lib/crews";
import { useI18n } from "@/lib/i18n/provider";

const PROJECT_OPTIONS = [
  "Northpoint Medical Center",
  "Project Oak",
  "Dock Expansion",
  "Harper Residence",
  "Summit Retail TI",
];

export default function EditCrewPage() {
  const { t } = useI18n();
  const params = useParams<{ id?: string | string[] }>();
  const crewId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const router = useRouter();
  const service = useMemo(() => createCrewService(), []);
  const [isSaving, setIsSaving] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<CrewEmployeeOption[]>([]);
  const [specialtyOptions, setSpecialtyOptions] = useState<string[]>([]);
  const { crew, isLoading, errorMessage, notFound } = useCrewProfile({ crewId, service });

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

  if (isLoading) {
    return <CrewLoadingState />;
  }

  if (errorMessage) {
    return <ErrorState title={t("crews.errorTitle")} description={t(errorMessage)} />;
  }

  if (notFound || !crew) {
    return (
      <EmptyState
        icon={<HardHat className="h-7 w-7" />}
        title={t("crews.notFound.title")}
        description={t("crews.notFound.description")}
        action={
          <Link
            href="/crews"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
          >
            {t("crews.actions.backToDirectory")}
          </Link>
        }
      />
    );
  }

  const handleSubmit = async (value: UpsertCrewInput) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const updated = await service.updateCrew(crew.id, value);

      if (!updated) {
        throw new Error("Crew not found");
      }

      router.push(`/crews/${crew.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t("crews.edit.title")} description={t("crews.edit.description")} />

      <CrewForm
        mode="edit"
        initialValue={crew}
        employeeOptions={employeeOptions}
        specialtyOptions={specialtyOptions}
        projectOptions={PROJECT_OPTIONS}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/crews/${crew.id}`)}
        t={t}
      />
    </div>
  );
}
