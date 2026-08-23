import { Button, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";
import type { OpenShift } from "@/lib/scheduling";

type OpenShiftsPanelProps = {
  items: OpenShift[];
  employeeOptions: Array<{ id: string; name: string; trade: string }>;
  crewOptions: Array<{ id: string; name: string }>;
  onAssign: (openShiftId: string, employeeId: string | null, crewId: string | null) => void;
  onDismiss: (openShiftId: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function OpenShiftsPanel({ items, employeeOptions, crewOptions, onAssign, onDismiss, t }: OpenShiftsPanelProps) {
  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("scheduling.openShifts.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("scheduling.empty.noOpenShifts")}
          </p>
        ) : (
          items.map((item) => {
            const employeeCandidate = employeeOptions.find((option) => item.candidateEmployeeIds.includes(option.id));
            const crewCandidate = crewOptions.find((option) => item.candidateCrewIds.includes(option.id));

            return (
              <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{item.projectName}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {item.tradeRequired} · {item.workersNeeded} {t("scheduling.openShifts.workersNeeded")}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {item.date} · {item.startTime} - {item.endTime} · {item.location}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.urgency === "critical" ? "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]" : item.urgency === "high" ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]" : "bg-[var(--color-info-50)] text-[var(--color-info-700)]"}`}>
                    {t(`scheduling.priority.${item.urgency}`)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Select onChange={(event) => onAssign(item.id, event.target.value || null, null)} defaultValue="">
                    <option value="">{t("scheduling.openShifts.assignEmployee")}</option>
                    {item.candidateEmployeeIds.map((id) => {
                      const option = employeeOptions.find((employee) => employee.id === id);
                      if (!option) {
                        return null;
                      }

                      return (
                        <option key={option.id} value={option.id}>{option.name} - {option.trade}</option>
                      );
                    })}
                  </Select>
                  <Select onChange={(event) => onAssign(item.id, null, event.target.value || null)} defaultValue="">
                    <option value="">{t("scheduling.openShifts.assignCrew")}</option>
                    {item.candidateCrewIds.map((id) => {
                      const option = crewOptions.find((crew) => crew.id === id);
                      if (!option) {
                        return null;
                      }

                      return (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      );
                    })}
                  </Select>
                </div>

                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {t("scheduling.openShifts.recommended")}: {employeeCandidate?.name || crewCandidate?.name || t("scheduling.common.none")}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => onDismiss(item.id)}>{t("scheduling.openShifts.dismiss")}</Button>
                </div>
              </article>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
