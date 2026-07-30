"use client";

import { Button } from "@/components/ui";
import { buildDeterministicDailySummary } from "@/lib/daily-reports";
import type {
  DailyReportStatus,
  DailyReportUpsertInput,
} from "@/lib/daily-reports";
import { AttachmentsSection } from "./attachments-section";
import { AiSummaryPanel } from "./ai-summary-panel";
import { DailyReportHeader } from "./daily-report-header";
import { DelaysSection } from "./delays-section";
import { EquipmentSection } from "./equipment-section";
import { LaborSection } from "./labor-section";
import { MaterialsSection } from "./materials-section";
import { SafetySection } from "./safety-section";
import { WorkCompletedSection } from "./work-completed-section";

type DailyReportFormProps = {
  value: DailyReportUpsertInput;
  projectOptions: Array<{ id: string; name: string }>;
  superintendentOptions: Array<{ id: string; name: string }>;
  validationErrors: string[];
  isSaving: boolean;
  onChange: (next: DailyReportUpsertInput) => void;
  onSave: (status: DailyReportStatus) => Promise<void>;
  onRegenerateSummary?: () => Promise<void> | void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function DailyReportForm({
  value,
  projectOptions,
  superintendentOptions,
  validationErrors,
  isSaving,
  onChange,
  onSave,
  onRegenerateSummary,
  t,
}: DailyReportFormProps) {
  const previewSummary = buildDeterministicDailySummary({
    id: "preview",
    reportNumber: "preview",
    header: value.header,
    schedulingPreload: value.schedulingPreload,
    labor: value.labor,
    laborTotals: {
      scheduledWorkers: value.labor.filter((item) => item.scheduled).length,
      presentWorkers: value.labor.filter((item) => item.present).length,
      absentWorkers: Math.max(value.labor.filter((item) => item.scheduled).length - value.labor.filter((item) => item.present).length, 0),
      lateWorkers: value.labor.filter((item) => item.late).length,
      overtimeWorkers: value.labor.filter((item) => item.overtimeHours > 0).length,
      totalLaborHours: value.labor.reduce((acc, item) => acc + item.regularHours + item.overtimeHours, 0),
    },
    workCompleted: value.workCompleted,
    materials: value.materials,
    safety: value.safety,
    delays: value.delays,
    attachments: value.attachments,
    timeline: value.timeline,
    aiSummary: "",
    aiSummaryVersion: value.aiSummaryVersion,
    submittedAt: null,
    reviewedAt: null,
    approvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return (
    <div className="space-y-5">
      {validationErrors.length > 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-3">
          <p className="text-sm font-semibold text-[var(--color-danger-700)]">{t("dailyReports.validation.title")}</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-[var(--color-danger-700)]">
            {validationErrors.map((error) => (
              <li key={error}>{t(error)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <DailyReportHeader
        value={value.header}
        schedulingPreload={value.schedulingPreload}
        projectOptions={projectOptions}
        superintendentOptions={superintendentOptions}
        onChange={(header) => onChange({ ...value, header })}
        t={t}
      />

      <LaborSection value={value.labor} onChange={(labor) => onChange({ ...value, labor })} t={t} />
      <WorkCompletedSection value={value.workCompleted} onChange={(workCompleted) => onChange({ ...value, workCompleted })} t={t} />
      <MaterialsSection value={value.materials} onChange={(materials) => onChange({ ...value, materials })} t={t} />
      <EquipmentSection t={t} />
      <SafetySection value={value.safety} onChange={(safety) => onChange({ ...value, safety })} t={t} />
      <DelaysSection value={value.delays} onChange={(delays) => onChange({ ...value, delays })} t={t} />
      <AttachmentsSection value={value.attachments} onChange={(attachments) => onChange({ ...value, attachments })} t={t} />

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.sections.timeline")}</h3>
        <div className="mt-3 space-y-2">
          {value.timeline.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">{t("dailyReports.timeline.empty")}</p>
          ) : (
            value.timeline
              .slice()
              .sort((a, b) => a.happenedAt.localeCompare(b.happenedAt))
              .map((event) => (
                <div key={event.id} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm">
                  <p className="font-semibold text-[var(--color-text-primary)]">{new Date(event.happenedAt).toLocaleString()} · {t(`dailyReports.timelineType.${event.eventType}`)}</p>
                  <p className="text-[var(--color-text-secondary)]">{event.description}</p>
                </div>
              ))
          )}
        </div>
      </section>

      <AiSummaryPanel summary={previewSummary} onRegenerate={onRegenerateSummary} t={t} />

      <section className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={isSaving} onClick={() => void onSave("draft")}>
          {isSaving ? t("dailyReports.actions.saving") : t("dailyReports.actions.saveDraft")}
        </Button>
        <Button variant="secondary" disabled={isSaving} onClick={() => void onSave("submitted")}>{t("dailyReports.actions.submit")}</Button>
        <Button variant="secondary" disabled={isSaving} onClick={() => void onSave("reviewed")}>{t("dailyReports.actions.markReviewed")}</Button>
        <Button disabled={isSaving} onClick={() => void onSave("approved")}>{t("dailyReports.actions.approve")}</Button>
      </section>
    </div>
  );
}
