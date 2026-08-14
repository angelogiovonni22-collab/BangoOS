"use client";

import Link from "next/link";
import { OrionVoiceSettingsPanel } from "@/components/orion/voice";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, ThemeGallery } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <div className="container-narrow space-y-[var(--space-section)]">
      <PageHeader compact eyebrow="Workspace" title={t("navigation.settings")} description="Manage appearance, memory review, and Orion voice preferences for this company workspace." />

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>Appearance</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">Choose a B.O.S. theme or full interface experience. Themes change the visual language; Experiences can also reshape navigation, spacing, surfaces, depth, and interaction while keeping the same protected B.O.S. data and workflows.</p>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">Themes & Experiences</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Select a preview to apply it instantly across B.O.S. Future 2030 is the first layout-changing experience. Your choice is saved on this device and can be changed at any time.</p>
          </div>
          <ThemeGallery />
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
