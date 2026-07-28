"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function NewEstimatePage() {
  const { t } = useI18n();

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-slate-500">BangoOS</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t("estimates.createEstimate")}</h1>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("common.moduleUnderDevelopmentTitle", { module: t("estimates.createEstimate") })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600">{t("common.moduleUnderDevelopmentDescription")}</p>
          <Link href="/estimates" className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {t("projects.backToProjects")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
