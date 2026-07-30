import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Select, SkeletonLoader } from "@/components/ui";
import type { DashboardActivityItem } from "@/lib/dashboard/types";

type ActivityFeedProps = {
  items: DashboardActivityItem[];
  isLoading?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ActivityFeed({ items, isLoading = false, t }: ActivityFeedProps) {
  const [filterValue, setFilterValue] = useState<"all" | DashboardActivityItem["category"]>("all");
  const [visibleCount, setVisibleCount] = useState(6);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filteredItems = useMemo(() => {
    if (filterValue === "all") {
      return items;
    }

    return items.filter((item) => item.category === filterValue);
  }, [filterValue, items]);

  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);

  useEffect(() => {
    if (!sentinelRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((current) => Math.min(current + 4, filteredItems.length));
      },
      { threshold: 0.2 },
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [filteredItems.length]);

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
            <CardDescription>{t("dashboard.recentActivityDescription")}</CardDescription>
          </div>

          <label className="sr-only" htmlFor="activity-filter">{t("dashboard.activityFilter")}</label>
          <Select
            id="activity-filter"
            value={filterValue}
            onChange={(event) => {
              setFilterValue(event.target.value as "all" | DashboardActivityItem["category"]);
              setVisibleCount(6);
            }}
            className="w-full sm:w-56"
          >
            <option value="all">{t("dashboard.activityFilterAll")}</option>
            <option value="customer">{t("dashboard.activityFilterCustomer")}</option>
            <option value="project">{t("dashboard.activityFilterProject")}</option>
            <option value="sitecam">{t("dashboard.activityFilterSitecam")}</option>
            <option value="estimate">{t("dashboard.activityFilterEstimate")}</option>
            <option value="invoice">{t("dashboard.activityFilterInvoice")}</option>
            <option value="team">{t("dashboard.activityFilterTeam")}</option>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        {isLoading ? (
          <FeedLoadingState />
        ) : filteredItems.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.activityEmpty")}
          </p>
        ) : (
          visibleItems.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)] transition hover:shadow-[var(--shadow-medium)]">
              <div className="flex items-start gap-3">
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${getAvatarTone(item.category)}`}>
                  {item.avatarLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.user}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{t(item.actionLabelKey)}</p>
                  {item.projectName ? (
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{item.projectName}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{formatRelativeMinutes(item.timestampMinutesAgo, t)}</span>
              </div>
            </article>
          ))
        )}

        {filteredItems.length > visibleItems.length ? (
          <>
            <div ref={sentinelRef} aria-hidden="true" className="h-1" />
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setVisibleCount((current) => Math.min(current + 4, filteredItems.length))}
            >
              {t("dashboard.activityLoadMore")}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FeedLoadingState() {
  return (
    <div className="space-y-3">
      <SkeletonLoader className="h-16 w-full" />
      <SkeletonLoader className="h-16 w-full" />
      <SkeletonLoader className="h-16 w-full" />
    </div>
  );
}

function getAvatarTone(category: DashboardActivityItem["category"]) {
  if (category === "customer") {
    return "bg-cyan-50 text-cyan-700";
  }

  if (category === "project") {
    return "bg-blue-50 text-blue-700";
  }

  if (category === "sitecam") {
    return "bg-violet-50 text-violet-700";
  }

  if (category === "estimate") {
    return "bg-amber-50 text-amber-700";
  }

  if (category === "invoice") {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatRelativeMinutes(minutesAgo: number, t: (key: string, params?: Record<string, string | number>) => string) {
  if (minutesAgo < 60) {
    return `${minutesAgo}m ${t("dashboard.activityAgo")}`;
  }

  const hours = Math.floor(minutesAgo / 60);

  if (hours < 24) {
    return `${hours}h ${t("dashboard.activityAgo")}`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ${t("dashboard.activityAgo")}`;
}
