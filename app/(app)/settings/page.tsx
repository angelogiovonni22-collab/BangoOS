"use client";

import Link from "next/link";
import { OrionVoiceSettingsPanel } from "@/components/orion/voice";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="container-narrow space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow="Workspace"
        title={t("navigation.settings")}
        description="Manage memory review and Orion voice preferences for this company workspace."
      />

      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--bos-bg-control)]/70">
          <CardTitle className="text-[1.1rem] font-bold text-[var(--bos-text-primary)]">{t("navigation.settings")}</CardTitle>
          <p className="text-sm text-[var(--bos-text-secondary)]">{t("projects.memorySettingsDescription")}</p>
        </CardHeader>
        <CardContent className="p-5">
          <Link href="/settings/memory-review" className="inline-flex items-center rounded-[10px] border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 py-2 text-sm font-semibold text-[var(--bos-text-primary)] hover:bg-[var(--bos-bg-hover)]">
            {t("projects.memoryReviewOpen")}
          </Link>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--bos-bg-control)]/70">
          <CardTitle className="text-[1.1rem] font-bold text-[var(--bos-text-primary)]">Orion Voice</CardTitle>
          <p className="text-sm text-[var(--bos-text-secondary)]">
            Configure spoken responses, preferred voice, and speech tuning.
          </p>
        </CardHeader>
        <CardContent className="p-5">
          <OrionVoiceSettingsPanel />
        </CardContent>
      </Card>
    </div>
  );
}
