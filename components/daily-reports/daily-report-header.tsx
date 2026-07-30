import { Input, Select } from "@/components/ui";
import type { DailyReportUpsertInput } from "@/lib/daily-reports";

type DailyReportHeaderProps = {
  value: DailyReportUpsertInput["header"];
  schedulingPreload: DailyReportUpsertInput["schedulingPreload"];
  projectOptions: Array<{ id: string; name: string }>;
  superintendentOptions: Array<{ id: string; name: string }>;
  onChange: (next: DailyReportUpsertInput["header"]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function DailyReportHeader({
  value,
  schedulingPreload,
  projectOptions,
  superintendentOptions,
  onChange,
  t,
}: DailyReportHeaderProps) {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-700)]">{t("dailyReports.form.header.badge")}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{t("dailyReports.form.header.title")}</h2>
        </div>

        {schedulingPreload ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-info-50)] px-3 py-2 text-xs font-semibold text-[var(--color-info-700)]">
            {t("dailyReports.form.header.preloaded", { assignment: schedulingPreload.assignmentTitle })}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
          <span>{t("dailyReports.fields.project")}</span>
          <Select
            value={value.projectId}
            onChange={(event) => {
              const project = projectOptions.find((item) => item.id === event.target.value);
              onChange({
                ...value,
                projectId: event.target.value,
                projectName: project?.name || value.projectName,
              });
            }}
          >
            <option value="">{t("dailyReports.fields.selectProject")}</option>
            {projectOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
          <span>{t("dailyReports.fields.date")}</span>
          <Input type="date" value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} />
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
          <span>{t("dailyReports.fields.shift")}</span>
          <Select value={value.shift} onChange={(event) => onChange({ ...value, shift: event.target.value as DailyReportUpsertInput["header"]["shift"] })}>
            <option value="day">{t("dailyReports.shift.day")}</option>
            <option value="swing">{t("dailyReports.shift.swing")}</option>
            <option value="night">{t("dailyReports.shift.night")}</option>
          </Select>
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
          <span>{t("dailyReports.fields.status")}</span>
          <Select value={value.overallStatus} onChange={(event) => onChange({ ...value, overallStatus: event.target.value as DailyReportUpsertInput["header"]["overallStatus"] })}>
            <option value="draft">{t("dailyReports.status.draft")}</option>
            <option value="submitted">{t("dailyReports.status.submitted")}</option>
            <option value="reviewed">{t("dailyReports.status.reviewed")}</option>
            <option value="approved">{t("dailyReports.status.approved")}</option>
          </Select>
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
          <span>{t("dailyReports.fields.superintendent")}</span>
          <Select
            value={value.superintendentId}
            onChange={(event) => {
              const selected = superintendentOptions.find((item) => item.id === event.target.value);
              onChange({
                ...value,
                superintendentId: event.target.value,
                superintendentName: selected?.name || value.superintendentName,
              });
            }}
          >
            <option value="">{t("dailyReports.fields.selectSuperintendent")}</option>
            {superintendentOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
          <span>{t("dailyReports.fields.projectManager")}</span>
          <Input value={value.projectManagerName} onChange={(event) => onChange({ ...value, projectManagerName: event.target.value })} />
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
          <span>{t("dailyReports.fields.weather")}</span>
          <Select value={value.weather} onChange={(event) => onChange({ ...value, weather: event.target.value as DailyReportUpsertInput["header"]["weather"] })}>
            <option value="sunny">{t("dailyReports.weather.sunny")}</option>
            <option value="cloudy">{t("dailyReports.weather.cloudy")}</option>
            <option value="rain">{t("dailyReports.weather.rain")}</option>
            <option value="storm">{t("dailyReports.weather.storm")}</option>
            <option value="snow">{t("dailyReports.weather.snow")}</option>
            <option value="mixed">{t("dailyReports.weather.mixed")}</option>
          </Select>
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
          <span>{t("dailyReports.fields.temperature")}</span>
          <Input
            type="number"
            value={String(value.temperatureF)}
            onChange={(event) => onChange({ ...value, temperatureF: Number(event.target.value) || 0 })}
          />
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2">
          <span>{t("dailyReports.fields.siteConditions")}</span>
          <Select value={value.siteConditions} onChange={(event) => onChange({ ...value, siteConditions: event.target.value as DailyReportUpsertInput["header"]["siteConditions"] })}>
            <option value="dry">{t("dailyReports.siteConditions.dry")}</option>
            <option value="wet">{t("dailyReports.siteConditions.wet")}</option>
            <option value="muddy">{t("dailyReports.siteConditions.muddy")}</option>
            <option value="windy">{t("dailyReports.siteConditions.windy")}</option>
            <option value="frozen">{t("dailyReports.siteConditions.frozen")}</option>
            <option value="restricted">{t("dailyReports.siteConditions.restricted")}</option>
          </Select>
        </label>
      </div>

      {schedulingPreload ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm">
          <p className="font-semibold text-[var(--color-text-primary)]">{t("dailyReports.preload.title")}</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <p className="text-[var(--color-text-secondary)]">{t("dailyReports.preload.assignment")}: <span className="font-semibold text-[var(--color-text-primary)]">{schedulingPreload.assignmentTitle}</span></p>
            <p className="text-[var(--color-text-secondary)]">{t("dailyReports.preload.supervisor")}: <span className="font-semibold text-[var(--color-text-primary)]">{schedulingPreload.supervisor}</span></p>
            <p className="text-[var(--color-text-secondary)]">{t("dailyReports.preload.plannedHours")}: <span className="font-semibold text-[var(--color-text-primary)]">{schedulingPreload.plannedHours}</span></p>
            <p className="text-[var(--color-text-secondary)]">{t("dailyReports.preload.crews")}: <span className="font-semibold text-[var(--color-text-primary)]">{schedulingPreload.assignedCrewNames.join(", ") || "-"}</span></p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
