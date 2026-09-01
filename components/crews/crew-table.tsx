import Link from "next/link";
import { CrewStatusPill } from "./crew-status-pill";
import { HardHat } from "./crew-icons";
import type { Crew } from "@/lib/crews";

type CrewTableProps = {
  items: Crew[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewTable({ items, t }: CrewTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-[var(--color-border-subtle)]">
          <thead className="bg-[var(--color-surface-subtle)]">
            <tr>
              <TableHeading>{t("crews.table.crew")}</TableHeading>
              <TableHeading>{t("crews.table.lead")}</TableHeading>
              <TableHeading>Supervisor</TableHeading>
              <TableHeading>{t("crews.table.members")}</TableHeading>
              <TableHeading>{t("crews.table.currentProject")}</TableHeading>
              <TableHeading>Assignment</TableHeading>
              <TableHeading>{t("crews.table.status")}</TableHeading>
              <TableHeading>Next assignment</TableHeading>
              <TableHeading>{t("crews.table.updated")}</TableHeading>
              <TableHeading align="right">{t("crews.table.actions")}</TableHeading>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
            {items.map((crew) => (
              <tr key={crew.id} className="transition duration-150 hover:bg-[var(--color-surface-subtle)]/70">
                <td className="whitespace-nowrap px-6 py-5">
                  <div className="flex items-center gap-3.5">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">
                      <HardHat className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{crew.name}</p>
                      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{crew.crewCode}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{crew.leadName || "Unassigned"}</td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{crew.supervisorName || "Unassigned"}</td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{crew.activeMemberCount}</td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{crew.currentProjectName || t("crews.unassigned")}</td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{crew.currentAssignmentTitle || t("crews.unassigned")}</td>
                <td className="whitespace-nowrap px-6 py-5 align-top">
                  <CrewStatusPill status={crew.status} availability={crew.availability} t={t} />
                </td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{crew.nextAssignmentTitle || "None"}</td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{formatDate(crew.updatedAt)}</td>
                <td className="whitespace-nowrap px-6 py-5 text-right text-sm font-semibold">
                  <div className="inline-flex gap-2">
                    <Link href={`/crews/${crew.id}`} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-[var(--color-brand-700)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-brand-800)]">
                      {t("crews.actions.view")}
                    </Link>
                    <Link href={`/crews/${crew.id}/edit`} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-[var(--color-brand-700)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-brand-800)]">
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4 md:hidden">
        {items.map((crew) => (
          <article key={crew.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">
                  <HardHat className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--color-text-primary)]">{crew.name}</p>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">{crew.crewCode}</p>
                </div>
              </div>
              <CrewStatusPill status={crew.status} availability={crew.availability} t={t} />
            </div>

            <div className="mt-4 grid gap-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
              <InfoLine label={t("crews.table.lead")} value={crew.leadName || "Unassigned"} />
              <InfoLine label="Supervisor" value={crew.supervisorName || "Unassigned"} />
              <InfoLine label={t("crews.table.members")} value={String(crew.activeMemberCount)} />
              <InfoLine label={t("crews.table.currentProject")} value={crew.currentProjectName || t("crews.unassigned")} />
              <InfoLine label="Assignment" value={crew.currentAssignmentTitle || t("crews.unassigned")} />
              <InfoLine label="Next assignment" value={crew.nextAssignmentTitle || "None"} />
            </div>

            <div className="mt-4 flex gap-2">
              <Link href={`/crews/${crew.id}`} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-sm font-semibold text-[var(--color-brand-700)]">
                {t("crews.actions.view")}
              </Link>
              <Link href={`/crews/${crew.id}/edit`} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-sm font-semibold text-[var(--color-brand-700)]">
                Edit
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function TableHeading({ children, align = "left" }: { children: string; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`px-6 py-3 text-xs font-semibold uppercase tracking-[0.09em] text-[var(--color-text-secondary)] ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
