"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

export default function HomePage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl bg-slate-950 p-10 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
            {t("common.homeEyebrow")}
          </p>

          <h1 className="mt-3 text-5xl font-bold">BangoOS</h1>

          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            {t("common.homeDescription")}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/crm"
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              {t("common.openCrm")}
            </Link>

            <Link
              href="/supabase-test"
              className="rounded-lg border border-slate-600 px-5 py-3 font-semibold text-white hover:bg-slate-800"
            >
              {t("common.testSupabase")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}