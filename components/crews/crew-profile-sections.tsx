"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";
import type { Crew } from "@/lib/crews";
import { CrewStatusPill } from "./crew-status-pill";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  Gauge,
  Hammer,
  HardHat,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "./crew-icons";

type CrewProfileSectionsProps = {
  crew: Crew;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewProfileSections({ crew, locale, t }: CrewProfileSectionsProps) {
  const [scheduleView, setScheduleView] = useState<"daily" | "weekly">("daily");

  const scheduleItems = useMemo(() => {
    if (scheduleView === "daily") {
      const first = crew.schedule[0];
      return first ? [first] : [];
    }

    return crew.schedule;
  }, [crew.schedule, scheduleView]);

  return (
    <div className="space-y-5">
      <Card variant="elevated">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-28 w-28 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">
                <HardHat className="h-12 w-12" />
              </span>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-brand-700)]">
                  {t("crews.profile.executiveSummary")}
                </p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{crew.name}</h2>
                <p className="mt-1 text-base font-semibold text-[var(--color-text-secondary)]">
                  {crew.primarySpecialty} - {crew.homeLocation}
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {t("crews.profile.lead")}: <span className="font-semibold text-[var(--color-text-primary)]">{crew.lead}</span>
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {t("crews.profile.supervisor")}: <span className="font-semibold text-[var(--color-text-primary)]">{crew.supervisor}</span>
                </p>

                <div className="mt-3">
                  <CrewStatusPill status={crew.status} availability={crew.availability} t={t} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Link
                href={`tel:+15125550101`}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
              >
                <Phone className="h-4 w-4" />
                {t("crews.actions.call")}
              </Link>
              <Link
                href={`mailto:ops@bangoos.dev`}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
              >
                <Mail className="h-4 w-4" />
                {t("crews.actions.email")}
              </Link>
              <Link
                href={`/crews/${crew.id}/edit`}
                className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
              >
                {t("crews.actions.edit")}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryItem label={t("crews.profile.memberCount")} value={String(crew.memberCount)} icon={<HardHat className="h-4 w-4" />} />
            <SummaryItem label={t("crews.profile.currentProject")} value={crew.currentProject || t("crews.unassigned")} icon={<Hammer className="h-4 w-4" />} />
            <SummaryItem label={t("crews.profile.utilization")} value={`${crew.utilization}%`} icon={<Gauge className="h-4 w-4" />} />
            <SummaryItem label={t("crews.profile.certificationCompliance")} value={`${crew.certificationCompliance}%`} icon={<ShieldCheck className="h-4 w-4" />} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("crews.sections.members")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {crew.members.map((member) => (
            <article key={member.employeeId} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{member.fullName}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{member.position}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{member.role}</p>
                </div>
                <Badge tone={member.primaryCrew ? "info" : "neutral"}>{member.primaryCrew ? t("crews.profile.primaryCrew") : t("crews.profile.secondaryCrew")}</Badge>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("crews.sections.assignments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {crew.assignments.length === 0 ? (
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("crews.empty.noAssignments")}</p>
          ) : (
            crew.assignments.map((assignment) => (
              <article key={assignment.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                <p className="font-semibold text-[var(--color-text-primary)]">{assignment.projectName}</p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{assignment.role}</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {t("crews.profile.assignmentDates", { start: formatDate(assignment.startDate, locale), end: assignment.endDate ? formatDate(assignment.endDate, locale) : t("crews.profile.present") })}
                </p>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("crews.sections.schedule")}</CardTitle>
          <Select value={scheduleView} onChange={(event) => setScheduleView(event.target.value as "daily" | "weekly")} className="w-40" aria-label={t("crews.sections.schedule")}
          >
            <option value="daily">{t("crews.schedule.daily")}</option>
            <option value="weekly">{t("crews.schedule.weekly")}</option>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduleItems.length === 0 ? (
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("crews.empty.noSchedule")}</p>
          ) : (
            scheduleItems.map((item) => (
              <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{formatDate(item.date, locale)}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{item.assignment || t("crews.unassigned")}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t(`crews.availability.${item.availabilityStatus}`)}</p>
                  </div>
                  {item.hasConflict ? (
                    <Badge tone="warning">{t("crews.schedule.conflict")}</Badge>
                  ) : (
                    <Badge tone="success">{t("crews.schedule.clear")}</Badge>
                  )}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("crews.sections.skills")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {crew.skills.map((skill) => (
              <Badge key={skill} tone="info">{skill}</Badge>
            ))}
            {crew.secondarySpecialties.map((skill) => (
              <Badge key={skill} tone="neutral">{skill}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("crews.sections.certifications")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {crew.certifications.map((certification) => (
            <article key={certification.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{certification.name}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{certification.validUntil ? t("crews.profile.validUntil", { date: formatDate(certification.validUntil, locale) }) : t("crews.profile.noExpiration")}</p>
                </div>
                <Badge tone={certification.compliant ? "success" : "warning"}>
                  {certification.compliant ? t("crews.profile.compliant") : t("crews.profile.nonCompliant")}
                </Badge>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("crews.sections.safety")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricLine icon={<ShieldAlert className="h-4 w-4" />} label={t("crews.analytics.safetyIncidents")} value={String(crew.safetyMetrics.incidents30d)} />
            <MetricLine icon={<AlertTriangle className="h-4 w-4" />} label={t("crews.profile.nearMisses")} value={String(crew.safetyMetrics.nearMisses30d)} />
            <MetricLine icon={<CalendarClock className="h-4 w-4" />} label={t("crews.profile.lastIncident")} value={crew.safetyMetrics.lastIncidentDate ? formatDate(crew.safetyMetrics.lastIncidentDate, locale) : t("crews.profile.none")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("crews.sections.productivity")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricLine icon={<ClipboardCheck className="h-4 w-4" />} label={t("crews.profile.completedTasks")} value={`${crew.productivityMetrics.completedTasks7d}/${crew.productivityMetrics.plannedTasks7d}`} />
            <MetricLine icon={<TrendingUp className="h-4 w-4" />} label={t("crews.analytics.productivity")} value={`${crew.productivityMetrics.onTimePercentage}%`} />
            <MetricLine icon={<Gauge className="h-4 w-4" />} label={t("crews.analytics.workload")} value={`${Math.min(100, crew.utilization + 5)}%`} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("crews.sections.equipment")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {crew.equipment.map((item) => (
            <article key={item.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <p className="font-medium text-[var(--color-text-primary)]">{item.name}</p>
              <Badge tone={item.status === "maintenance" ? "warning" : item.status === "in_use" ? "info" : "success"}>{t(`crews.equipmentStatus.${item.status}`)}</Badge>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("crews.sections.activity")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {crew.recentActivity.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex items-start gap-2">
                <Activity className="mt-0.5 h-4 w-4 text-[var(--color-brand-700)]" />
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.details}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{formatDateTime(item.happenedAt, locale)}</p>
                </div>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("crews.sections.notes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{crew.notes || t("crews.empty.noNotes")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryItem({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
        {icon}
        <span>{value}</span>
      </p>
    </article>
  );
}

function MetricLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        {icon}
        <span>{label}</span>
      </p>
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
