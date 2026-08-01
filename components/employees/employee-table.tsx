import Link from "next/link";
import { EmployeeStatusPill } from "./employee-status-pill";
import { EmployeeAvatar } from "./employee-avatar";
import type { Employee } from "@/lib/employees";

type EmployeeTableProps = {
  items: Employee[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeTable({ items, t }: EmployeeTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-[var(--color-border-subtle)]">
          <thead className="bg-[var(--color-surface-subtle)]">
            <tr>
              <TableHeading>{t("employees.table.employee")}</TableHeading>
              <TableHeading>{t("employees.table.position")}</TableHeading>
              <TableHeading>{t("employees.table.crew")}</TableHeading>
              <TableHeading>Supervisor</TableHeading>
              <TableHeading>Project</TableHeading>
              <TableHeading>{t("employees.table.status")}</TableHeading>
              <TableHeading>{t("employees.table.assignment")}</TableHeading>
              <TableHeading align="right">{t("employees.table.actions")}</TableHeading>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
            {items.map((employee) => (
              <tr key={employee.id} className="transition duration-150 hover:bg-[var(--color-surface-subtle)]/70">
                <td className="whitespace-nowrap px-6 py-5">
                  <div className="flex items-center gap-3.5">
                    <EmployeeAvatar fullName={employee.fullName} avatarUrl={employee.avatarUrl ?? null} size="md" />
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{employee.fullName}</p>
                      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{employee.employeeNumber}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{employee.positionTitle}</td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{employee.primaryCrewName || t("employees.unassigned")}</td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{employee.supervisorName || "Unassigned"}</td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">{employee.currentProjectName || t("employees.unassigned")}</td>
                <td className="whitespace-nowrap px-6 py-5 align-top">
                  <EmployeeStatusPill
                    employmentStatus={employee.employmentStatus}
                    availabilityStatus={employee.availabilityStatus}
                    t={t}
                  />
                </td>
                <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-[var(--color-text-secondary)]">
                  {employee.currentAssignmentTitle || t("employees.unassigned")}
                </td>
                <td className="whitespace-nowrap px-6 py-5 text-right text-sm font-semibold">
                  <div className="inline-flex gap-2">
                    <Link href={`/employees/${employee.id}`} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-[var(--color-brand-700)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-brand-800)]">
                      {t("employees.actions.view")}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4 md:hidden">
        {items.map((employee) => (
          <article key={employee.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <EmployeeAvatar fullName={employee.fullName} avatarUrl={employee.avatarUrl ?? null} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--color-text-primary)]">{employee.fullName}</p>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">{employee.employeeNumber}</p>
                </div>
              </div>
              <EmployeeStatusPill
                employmentStatus={employee.employmentStatus}
                availabilityStatus={employee.availabilityStatus}
                t={t}
              />
            </div>

            <div className="mt-4 grid gap-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
              <InfoLine label={t("employees.table.position")} value={employee.positionTitle} />
              <InfoLine label={t("employees.table.crew")} value={employee.primaryCrewName || t("employees.unassigned")} />
              <InfoLine label="Supervisor" value={employee.supervisorName || "Unassigned"} />
              <InfoLine label={t("employees.table.assignment")} value={employee.currentAssignmentTitle || t("employees.unassigned")} />
            </div>

            <div className="mt-4 flex gap-2">
              <Link href={`/employees/${employee.id}`} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-sm font-semibold text-[var(--color-brand-700)]">
                {t("employees.actions.view")}
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
