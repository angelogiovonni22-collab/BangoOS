import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, PartialDataNotice } from "@/components/ui";
import type { CrewProfile } from "@/lib/crews";
import { CrewStatusPill } from "./crew-status-pill";

type CrewProfileSectionsProps = {
  crew: CrewProfile;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewProfileSections({ crew, locale, t }: CrewProfileSectionsProps) {
  const { overview } = crew;

  return (
    <div className="space-y-5">
      {crew.partialNotices.map((notice) => (
        <PartialDataNotice key={notice} message={notice} />
      ))}

      <Card variant="elevated">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Crew code" value={overview.crewCode} />
          <Field label="Lead" value={overview.leadName || "Unassigned"} />
          <Field label="Supervisor" value={overview.supervisorName || "Unassigned"} />
          <Field label="Home location" value={overview.homeLocation || "Unassigned"} />
          <Field label="Active members" value={String(overview.activeMemberCount)} />
          <Field label="Primary members" value={String(overview.primaryMemberCount)} />
          <Field label="Current project" value={overview.currentProjectName || "Unassigned"} />
          <Field label="Current assignment" value={overview.currentAssignmentTitle || "Unassigned"} />
          <Field label="Next assignment" value={overview.nextAssignmentTitle || "None"} />
          <Field label="Updated" value={formatDateTime(overview.updatedAt, locale)} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Status</p>
            <div className="mt-1">
              <CrewStatusPill status={overview.status} availability={overview.availability} t={t} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MembershipGroup title="Active" items={crew.memberships.current} />
          <MembershipGroup title="Planned" items={crew.memberships.planned} />
          <MembershipGroup title="Ended" items={crew.memberships.ended} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AssignmentGroup title="Current" items={crew.assignments.current} locale={locale} />
          <AssignmentGroup title="Upcoming" items={crew.assignments.upcoming} locale={locale} />
          <AssignmentGroup title="Completed" items={crew.assignments.completed} locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EquipmentGroup title="Crew-assigned" items={crew.equipment.crew} />
          <EquipmentGroup title="Project-assigned" items={crew.equipment.project} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description and Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
          <p>{overview.description || "No description provided."}</p>
          <p>{overview.notes || "No notes provided."}</p>
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

function MembershipGroup({ title, items }: { title: string; items: CrewProfile["memberships"]["current"] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No records.</p>
      ) : (
        items.map((membership) => (
          <article key={membership.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/employees/${membership.employeeId}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]">
                {membership.employeeName}
              </Link>
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

function AssignmentGroup({ title, items, locale }: { title: string; items: CrewProfile["assignments"]["current"]; locale: string }) {
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

function EquipmentGroup({ title, items }: { title: string; items: CrewProfile["equipment"]["crew"] }) {
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

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
