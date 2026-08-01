import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, PartialDataNotice } from "@/components/ui";
import type { EmployeeProfile } from "@/lib/employees";
import { EmployeeStatusPill } from "./employee-status-pill";

type EmployeeProfileSectionsProps = {
  employee: EmployeeProfile;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeProfileSections({ employee, locale, t }: EmployeeProfileSectionsProps) {
  const { overview } = employee;

  return (
    <div className="space-y-5">
      {employee.partialNotices.map((notice) => (
        <PartialDataNotice key={notice} message={notice} />
      ))}

      <Card variant="elevated">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Employee #" value={overview.employeeNumber} />
          <Field label="Position" value={overview.positionTitle} />
          <Field label="Trade" value={overview.trade || "Not provided"} />
          <Field label="Supervisor" value={overview.supervisorName || "Unassigned"} />
          <Field label="Primary crew" value={overview.primaryCrewName || "Unassigned"} />
          <Field label="Current assignment" value={overview.currentAssignmentTitle || "Unassigned"} />
          <Field label="Current project" value={overview.currentProjectName || "Unassigned"} />
          <Field label="Phase / task" value={overview.currentPhaseOrTask || "Unavailable"} />
          <Field label="Hire date" value={formatDate(overview.hireDate, locale)} />
          <Field label="Termination date" value={overview.terminationDate ? formatDate(overview.terminationDate, locale) : "Not terminated"} />
          <Field label="Updated" value={formatDateTime(overview.updatedAt, locale)} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Status</p>
            <div className="mt-1">
              <EmployeeStatusPill employmentStatus={overview.employmentStatus} availabilityStatus={overview.availabilityStatus} t={t} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memberships</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MembershipGroup title="Current" items={employee.memberships.current} />
          <MembershipGroup title="Planned" items={employee.memberships.planned} />
          <MembershipGroup title="Ended" items={employee.memberships.ended} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AssignmentGroup title="Current" items={employee.assignments.current} locale={locale} />
          <AssignmentGroup title="Upcoming" items={employee.assignments.upcoming} locale={locale} />
          <AssignmentGroup title="Completed" items={employee.assignments.completed} locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipment Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EquipmentGroup title="Directly assigned" items={employee.equipment.direct} />
          <EquipmentGroup title="Crew-linked" items={employee.equipment.crew} />
          <EquipmentGroup title="Project-linked" items={employee.equipment.project} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)]">{overview.notes || "No notes recorded."}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function MembershipGroup({ title, items }: { title: string; items: EmployeeProfile["memberships"]["current"] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No records.</p>
      ) : (
        items.map((membership) => (
          <article key={membership.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[var(--color-text-primary)]">{membership.crewName}</p>
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">{membership.isPrimary ? "Primary" : "Secondary"}</p>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{membership.role}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{membership.startsOn} - {membership.endsOn || "Present"}</p>
          </article>
        ))
      )}
    </section>
  );
}

function AssignmentGroup({ title, items, locale }: { title: string; items: EmployeeProfile["assignments"]["current"]; locale: string }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No records.</p>
      ) : (
        items.map((assignment) => (
          <article key={assignment.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
            <p className="font-semibold text-[var(--color-text-primary)]">{assignment.title}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{assignment.projectName}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{assignment.phaseName || assignment.taskName || "No phase/task"}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{formatDateTime(assignment.startsAt, locale)} - {formatDateTime(assignment.endsAt, locale)}</p>
          </article>
        ))
      )}
    </section>
  );
}

function EquipmentGroup({ title, items }: { title: string; items: EmployeeProfile["equipment"]["direct"] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No linked equipment.</p>
      ) : (
        items.map((equipment) => (
          <Link
            key={equipment.id}
            href={equipment.href}
            className="block rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3"
          >
            <p className="font-semibold text-[var(--color-text-primary)]">{equipment.name}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{equipment.equipmentNumber} · {equipment.status}</p>
          </Link>
        ))
      )}
    </section>
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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
