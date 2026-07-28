import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { SiteCamActivity } from "@/lib/operations";

type SiteCamActivityPanelProps = {
  items: SiteCamActivity[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function SiteCamActivityPanel({ items, t }: SiteCamActivityPanelProps) {
  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("operations.sections.sitecam")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm font-medium text-[var(--color-text-secondary)]">
            {t("operations.empty.sitecam")}
          </p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.project}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {formatDateTime(item.timestamp)} · {item.uploader} · {item.photoCount} {t("operations.sitecam.photos")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{t(`operations.sitecamCategory.${item.category}`)}</Badge>
                  {item.flagged ? <Badge tone="warning">{t("operations.sitecam.flagged")}</Badge> : null}
                  <Link href={`/projects/${item.projectId}`} className="text-xs font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                    {t("operations.sitecam.openProject")}
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
