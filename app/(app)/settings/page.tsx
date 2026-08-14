"use client";

import Link from "next/link";
import { OrionVoiceSettingsPanel } from "@/components/orion/voice";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, ThemeToggle } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <div className="container-narrow space-y-[var(--space-section)]">
      <PageHeader compact eyebrow="Workspace" title={t("navigation.settings")} description="Manage appearance, memory review, and Orion voice preferences for this company workspace." />

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>Appearance</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">Switch the B.O.S. workspace between the premium light and dark themes. Your choice is saved on this device.</p>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div><p className="font-semibold text-[var(--color-text-primary)]">Workspace theme</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Light and dark modes use the same semantic contrast system.</p></div>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>{t("navigation.settings")}</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("projects.memorySettingsDescription")}</p>
        </CardHeader>
        <CardContent className="p-5">
          <Link href="/settings/memory-review" className="inline-flex items-center rounded-[10px] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]">{t("projects.memoryReviewOpen")}</Link>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>Orion Voice</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">Configure spoken responses, preferred voice, and speech tuning.</p>
        </CardHeader>
        <CardContent className="p-5"><OrionVoiceSettingsPanel /></CardContent>
      </Card>
    </div>
  );
}
