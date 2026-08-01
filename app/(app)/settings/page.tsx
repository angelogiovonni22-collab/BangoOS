"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <CardTitle className="text-[1.1rem] font-bold text-[var(--color-navy-900)]">{t("navigation.settings")}</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("projects.memorySettingsDescription")}</p>
        </CardHeader>
        <CardContent className="p-5">
          <Link href="/settings/memory-review" className="inline-flex items-center rounded-[10px] border border-[var(--color-primary-200)] bg-[var(--color-primary-100)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-700)] hover:bg-[var(--color-primary-200)]">
            {t("projects.memoryReviewOpen")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
