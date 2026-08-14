"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

type AiSummaryPanelProps = {
  summary: string;
  onRegenerate?: () => Promise<void> | void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function AiSummaryPanel({ summary, onRegenerate, t }: AiSummaryPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const copySummary = async () => {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(summary);
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-info-200)] bg-[var(--color-info-50)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.ai.title")}</h3>
          <p className="text-sm text-[var(--color-info-700)]">{t("dailyReports.ai.simulated")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpanded((current) => !current)}>
            {expanded ? t("dailyReports.actions.collapse") : t("dailyReports.actions.expand")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void copySummary()}>
            {t("dailyReports.actions.copy")}
          </Button>
          <Button size="sm" onClick={() => void onRegenerate?.()}>{t("dailyReports.actions.regenerate")}</Button>
        </div>
      </div>

      {expanded ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-[var(--radius-lg)] border border-[var(--color-info-200)] bg-white p-3 text-sm text-[var(--color-text-primary)]">
          {summary}
        </pre>
      ) : null}
    </section>
  );
}
