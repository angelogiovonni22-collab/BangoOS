import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ContractorVendorAvailability } from "@/lib/scheduling";

type AvailableResourcesPanelProps = {
  items: ContractorVendorAvailability[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function AvailableResourcesPanel({ items, t }: AvailableResourcesPanelProps) {
  return (
    <Card as="section">
      <CardHeader className="space-y-2">
        <CardTitle>{t("scheduling.availability.title")}</CardTitle>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("scheduling.availability.description")}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("scheduling.empty.noAvailability")}
          </p>
        ) : items.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.vendorCode} · {item.location}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.contact}</p>
              </div>
              <span className="rounded-full bg-[var(--color-success-50)] px-2 py-1 text-xs font-semibold text-[var(--color-success-700)]">
                {item.preferred ? t("scheduling.availability.preferred") : t("scheduling.availabilityStatus.available")}
              </span>
            </div>
            <div className="mt-2">
              <Link href={`/vendors/${item.vendorId}`} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-brand-700)]">
                {t("scheduling.availability.viewVendor")}
              </Link>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
