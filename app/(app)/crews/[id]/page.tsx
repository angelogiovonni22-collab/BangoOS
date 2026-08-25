"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { CrewLoadingState, CrewProfileSections, CrewProjectAssignmentPanel } from "@/components/crews";
import { HardHat } from "@/components/crews/crew-icons";
import { useCrewProfile } from "@/lib/crews";
import { useI18n } from "@/lib/i18n/provider";

export default function CrewProfilePage() {
  const params = useParams<{ id?: string | string[] }>();
  const crewId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const { t, locale } = useI18n();
  const { crew, isLoading, errorMessage, notFound } = useCrewProfile({ crewId });

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

  const localeTag = locale === "es" ? "es-ES" : "en-US";

  return (
    <div className="space-y-6">
      <PageHeader
        title={crew.overview.name}
        description={t("crews.profile.description")}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/crews"
              className="inline-flex h-11 items-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 text-sm font-semibold text-[var(--color-text-secondary)]"
            >
              {t("crews.actions.backToDirectory")}
            </Link>
            <Link
              href={`/crews/${crewId}/edit`}
              className="inline-flex h-11 items-center rounded-[var(--radius-lg)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
            >
              Edit Crew
            </Link>
          </div>
        }
      />

      <CrewProjectAssignmentPanel
        crewId={crewId}
        crewName={crew.overview.name}
        activeMemberCount={crew.overview.activeMemberCount}
        supervisorName={crew.overview.supervisorName}
      />

      <CrewProfileSections crew={crew} locale={localeTag} t={t} />
    </div>
  );
}
