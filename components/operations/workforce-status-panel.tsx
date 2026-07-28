import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import type { WorkforceStatus } from "@/lib/operations";
import { UserCheck, UserCog } from "./operations-icons";

type WorkforceStatusPanelProps = {
  data: WorkforceStatus;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function WorkforceStatusPanel({ data, t }: WorkforceStatusPanelProps) {
  const stats = [
    { key: "scheduled", value: data.scheduled },
    { key: "checkedIn", value: data.checkedIn },
    { key: "available", value: data.available },
    { key: "absent", value: data.absent },
    { key: "pto", value: data.pto },
    { key: "training", value: data.training },
    { key: "overtimeRisk", value: data.overtimeRisk },
    { key: "certificationRisk", value: data.certificationRisk },
  ] as const;

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("operations.sections.workforce")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <article key={item.key} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                {t(`operations.workforce.${item.key}`)}
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{item.value}</p>
            </article>
          ))}
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t("operations.workforce.attentionTitle")}</p>
          <div className="mt-3 space-y-2">
            {data.attention.map((item) => (
              <article key={item.employeeId} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/employees/${item.employeeId}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]">
                      {item.fullName}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.reason}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.type === "certification_issue" || item.type === "overtime_risk" ? "warning" : "info"}>
                      {t(`operations.workforceAttention.${item.type}`)}
                    </Badge>
                    <p className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)]">
                      <UserCog className="h-3.5 w-3.5" />
                      {item.owner}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
          <UserCheck className="h-3.5 w-3.5" />
          {t("operations.workforce.checkInNote")}
        </p>
      </CardContent>
    </Card>
  );
}
