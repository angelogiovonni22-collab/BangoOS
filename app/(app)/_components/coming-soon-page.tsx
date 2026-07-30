"use client";

import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

type ComingSoonPageProps = {
  moduleKey: "crew" | "schedule" | "invoices" | "settings";
};

export function ComingSoonPage({ moduleKey }: ComingSoonPageProps) {
  const { t } = useI18n();
  const moduleName = t(`navigation.${moduleKey}`);

  return (
    <div className="space-y-8">
      <PageHeader title={moduleName} description={t("common.homeDescription")} />

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>{t("common.moduleUnderDevelopmentTitle", { module: moduleName })}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[var(--color-text-secondary)]">{t("common.moduleUnderDevelopmentDescription")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
