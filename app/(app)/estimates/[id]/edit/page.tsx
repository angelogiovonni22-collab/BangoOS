"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function EditEstimatePage() {
  const { t } = useI18n();
  const params = useParams<{ id?: string | string[] }>();
  const estimateId = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-slate-500">BangoOS</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {t("estimates.edit")} {estimateId ? `#${estimateId}` : ""}
        </h1>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("common.moduleUnderDevelopmentTitle", { module: t("estimates.edit") })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600">{t("common.moduleUnderDevelopmentDescription")}</p>
          <Link href="/estimates" className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {t("customers.back")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
