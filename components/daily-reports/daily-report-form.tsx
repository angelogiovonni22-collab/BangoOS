"use client";

import { Button } from "@/components/ui";
import type {
  DailyReportStatus,
  DailyReportUpsertInput,
} from "@/lib/daily-reports";
import { AttachmentsSection } from "./attachments-section";
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
  allowedStatuses?: readonly DailyReportStatus[];
  onRegenerateSummary?: () => Promise<void> | void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const ALL_STATUSES: readonly DailyReportStatus[] = ["draft", "submitted", "reviewed", "approved"];

export function DailyReportForm({
  value,
  projectOptions,
  superintendentOptions,
  validationErrors,
  isSaving,
  onChange,
  onSave,
  allowedStatuses = ALL_STATUSES,
  t,
}: DailyReportFormProps) {
  const canSaveAs = (status: DailyReportStatus) => allowedStatuses.includes(status);

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
      <EquipmentSection value={value.equipment || []} onChange={(equipment) => onChange({ ...value, equipment })} t={t} />
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

      <section className="flex flex-wrap justify-end gap-2">
        {canSaveAs("draft") ? (
          <Button variant="outline" disabled={isSaving} onClick={() => void onSave("draft")}>
            {isSaving ? t("dailyReports.actions.saving") : t("dailyReports.actions.saveDraft")}
          </Button>
        ) : null}
        {canSaveAs("submitted") ? <Button variant="secondary" disabled={isSaving} onClick={() => void onSave("submitted")}>{t("dailyReports.actions.submit")}</Button> : null}
        {canSaveAs("reviewed") ? <Button variant="secondary" disabled={isSaving} onClick={() => void onSave("reviewed")}>{t("dailyReports.actions.markReviewed")}</Button> : null}
        {canSaveAs("approved") ? <Button disabled={isSaving} onClick={() => void onSave("approved")}>{t("dailyReports.actions.approve")}</Button> : null}
      </section>
    </div>
  );
}
