import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";
import type { ResourceAvailability } from "@/lib/scheduling";

type AvailableResourcesPanelProps = {
  items: ResourceAvailability[];
  onQuickAssign: (resourceId: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function AvailableResourcesPanel({ items, onQuickAssign, t }: AvailableResourcesPanelProps) {
  return (
    <Card as="section">
      <CardHeader className="space-y-3">
        <CardTitle>{t("scheduling.availability.title")}</CardTitle>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Select defaultValue="all">
            <option value="all">{t("scheduling.filters.allTrades")}</option>
          </Select>
          <Select defaultValue="all">
            <option value="all">{t("scheduling.filters.allLocations")}</option>
          </Select>
          <Select defaultValue="all">
            <option value="all">{t("scheduling.filters.allShifts")}</option>
          </Select>
          <Select defaultValue="all">
            <option value="all">{t("scheduling.filters.allCertifications")}</option>
          </Select>
          <Select defaultValue="all">
            <option value="all">{t("scheduling.filters.allCrews")}</option>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("scheduling.empty.noAvailability")}
          </p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{item.trade} · {item.location}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{item.availableFrom} - {item.availableTo}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.availability === "available" ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]" : item.availability === "partial" ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]" : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]"}`}>
                  {t(`scheduling.availabilityStatus.${item.availability}`)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => onQuickAssign(item.resourceId)}>{t("scheduling.actions.quickAssign")}</Button>
                {item.resourceType === "employee" ? (
                  <Link href={`/employees/${item.resourceId}`} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-brand-700)]">
                    {t("scheduling.actions.viewProfile")}
                  </Link>
                ) : (
                  <Link href={`/crews/${item.resourceId}`} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-brand-700)]">
                    {t("scheduling.actions.viewCrew")}
                  </Link>
                )}
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
