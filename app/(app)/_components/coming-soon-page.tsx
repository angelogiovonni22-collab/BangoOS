"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

type ComingSoonPageProps = {
  moduleKey: "crew" | "schedule" | "invoices" | "settings";
};

export function ComingSoonPage({ moduleKey }: ComingSoonPageProps) {
  const { t } = useI18n();
  const moduleName = t(`navigation.${moduleKey}`);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-slate-500">BangoOS</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{moduleName}</h1>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("common.moduleUnderDevelopmentTitle", { module: moduleName })}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600">{t("common.moduleUnderDevelopmentDescription")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
