import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { Employee } from "@/lib/employees";
import { EmployeeAvatar } from "./employee-avatar";
import { CalendarIcon, MailIcon, PhoneIcon } from "./employee-icons";
import { EmployeeStatusPill } from "./employee-status-pill";

type EmployeeProfileSectionsProps = {
  employee: Employee;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeProfileSections({ employee, locale, t }: EmployeeProfileSectionsProps) {
  return (
    <div className="space-y-5">
      <Card variant="elevated">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <EmployeeAvatar fullName={employee.fullName} avatarUrl={employee.avatarUrl} size="xl" />

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-brand-700)]">
                  {t("employees.profile.executiveSummary")}
                </p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{employee.fullName}</h2>
                <p className="mt-1 text-base font-semibold text-[var(--color-text-secondary)]">
                  {employee.position} • {employee.crew}
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {t("employees.profile.supervisor")}: <span className="font-semibold text-[var(--color-text-primary)]">{employee.supervisor}</span>
                </p>

                <div className="mt-3">
                  <EmployeeStatusPill
                    employmentStatus={employee.employmentStatus}
                    availabilityStatus={employee.availabilityStatus}
                    t={t}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Link
                href={`tel:${employee.phone.replace(/[^+\d]/g, "")}`}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
              >
                <PhoneIcon className="h-4 w-4" />
                {t("employees.actions.call")}
              </Link>
              <Link
                href={`mailto:${employee.email}`}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
              >
                <MailIcon className="h-4 w-4" />
                {t("employees.actions.email")}
              </Link>
              <Link
                href={`/employees/${employee.id}/edit`}
                className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]"
              >
                {t("employees.actions.edit")}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryItem
              label={t("employees.table.assignment")}
              value={employee.currentAssignment || t("employees.unassigned")}
            />
            <SummaryItem
              label={t("employees.profile.currentCrew")}
              value={employee.primaryCrew || employee.crew || t("employees.unassigned")}
            />
            <SummaryItem
              label={t("employees.profile.crewRole")}
              value={employee.crewRole || employee.position}
            />
            <SummaryItem label={t("employees.form.phone")} value={employee.phone} />
            <SummaryItem label={t("employees.form.email")} value={employee.email} />
            <SummaryItem
              label={t("employees.form.hiredOn")}
              value={formatDate(employee.hiredOn, locale)}
              icon={<CalendarIcon className="h-4 w-4" />}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("employees.profile.contactInformation")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t("employees.form.phone")} value={employee.phone} />
          <Field label={t("employees.form.email")} value={employee.email} />
          <Field label={t("employees.form.address")} value={employee.address} fullWidth />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("employees.profile.emergencyContact")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label={t("employees.form.emergencyName")} value={employee.emergencyContact.name} />
          <Field label={t("employees.form.emergencyRelationship")} value={employee.emergencyContact.relationship} />
          <Field label={t("employees.form.emergencyPhone")} value={employee.emergencyContact.phone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("employees.profile.certifications")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {employee.certifications.length === 0 ? (
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("employees.empty.noCertifications")}</p>
          ) : (
            employee.certifications.map((certification) => (
              <article
                key={certification.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3"
              >
                <p className="font-semibold text-[var(--color-text-primary)]">{certification.name}</p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{certification.issuer}</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {certification.expiresAt
                    ? t("employees.profile.expiresOn", { date: formatDate(certification.expiresAt, locale) })
                    : t("employees.profile.noExpiration")}
                </p>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("employees.profile.skills")}</CardTitle>
        </CardHeader>
        <CardContent>
          {employee.skills.length === 0 ? (
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("employees.empty.noSkills")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {employee.skills.map((skill) => (
                <Badge key={skill} tone="info">{skill}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("employees.profile.assignedProjects")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {employee.assignedProjects.length === 0 ? (
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("employees.empty.noProjects")}</p>
          ) : (
            employee.assignedProjects.map((project) => (
              <article
                key={project.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{project.projectName}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{project.role}</p>
                  </div>
                  <Badge tone={project.status === "active" ? "success" : project.status === "upcoming" ? "info" : "neutral"}>
                    {t(`employees.projectStatus.${project.status}`)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {t("employees.profile.projectStart", { date: formatDate(project.startDate, locale) })}
                </p>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("employees.profile.employmentHistory")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {employee.employmentHistory.map((item) => (
            <article
              key={item.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3"
            >
              <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
              <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{item.crew}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {formatDate(item.startedOn, locale)} - {item.endedOn ? formatDate(item.endedOn, locale) : t("employees.profile.present")}
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">{item.summary}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("employees.profile.notes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{employee.notes || t("employees.empty.noNotes")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, fullWidth = false }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function SummaryItem({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
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

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
