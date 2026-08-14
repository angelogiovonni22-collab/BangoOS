import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type {
  DashboardAutomationQueueItem,
  DashboardEstimatePipeline,
  DashboardPendingFollowupItem,
  DashboardRecentAutomationItem,
} from "@/lib/dashboard/types";

type Translator = (key: string, params?: Record<string, string | number>) => string;

type PendingFollowupsWidgetProps = {
  items: DashboardPendingFollowupItem[];
  errorMessage?: string | null;
  t: Translator;
};

export function PendingFollowupsWidget({ items, errorMessage = null, t }: PendingFollowupsWidgetProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.pendingFollowupsTitle")}</CardTitle>
        <CardDescription>{t("dashboard.pendingFollowupsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {errorMessage ? (
          <WidgetError message={errorMessage} />
        ) : items.length === 0 ? (
          <WidgetEmpty label={t("dashboard.pendingFollowupsEmpty")} />
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{item.estimateNumber}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {t("dashboard.followupDue")} {formatTimestamp(item.dueAt)} - {t("dashboard.followupDaysOverdue", { count: item.daysOverdue })}
              </p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

type AutomationQueueWidgetProps = {
  items: DashboardAutomationQueueItem[];
  errorMessage?: string | null;
  t: Translator;
};

export function AutomationQueueWidget({ items, errorMessage = null, t }: AutomationQueueWidgetProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.automationQueueTitle")}</CardTitle>
        <CardDescription>{t("dashboard.automationQueueDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {errorMessage ? (
          <WidgetError message={errorMessage} />
        ) : items.length === 0 ? (
          <WidgetEmpty label={t("dashboard.automationQueueEmpty")} />
        ) : (
          items.map((item) => (
            <article key={item.runId} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.ruleId}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === "failed" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                  {item.status === "failed" ? t("dashboard.automationFailed") : t("dashboard.automationRunning")}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.triggerEvent}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatTimestamp(item.startedAt)}</p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

type RecentAutomationsWidgetProps = {
  items: DashboardRecentAutomationItem[];
  errorMessage?: string | null;
  t: Translator;
};

export function RecentAutomationsWidget({ items, errorMessage = null, t }: RecentAutomationsWidgetProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.recentAutomationsTitle")}</CardTitle>
        <CardDescription>{t("dashboard.recentAutomationsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {errorMessage ? (
          <WidgetError message={errorMessage} />
        ) : items.length === 0 ? (
          <WidgetEmpty label={t("dashboard.recentAutomationsEmpty")} />
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.ruleId}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === "failed" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {item.status === "failed" ? t("dashboard.automationFailed") : t("dashboard.automationCompleted")}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.triggerEvent}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {formatTimestamp(item.completedAt)}{item.durationMs ? ` - ${item.durationMs}ms` : ""}
              </p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

type EstimatePipelineWidgetProps = {
  pipeline: DashboardEstimatePipeline;
  errorMessage?: string | null;
  t: Translator;
};

export function EstimatePipelineWidget({ pipeline, errorMessage = null, t }: EstimatePipelineWidgetProps) {
  const items = [
    { key: "draft", label: t("dashboard.pipelineDraft"), value: pipeline.draft },
    { key: "sent", label: t("dashboard.pipelineSent"), value: pipeline.sent },
    { key: "viewed", label: t("dashboard.pipelineViewed"), value: pipeline.viewed },
    { key: "revision", label: t("dashboard.pipelineRevisionRequested"), value: pipeline.revisionRequested },
    { key: "approved", label: t("dashboard.pipelineApproved"), value: pipeline.approved },
    { key: "rejected", label: t("dashboard.pipelineRejected"), value: pipeline.rejected },
  ];

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.estimatePipelineTitle")}</CardTitle>
        <CardDescription>{t("dashboard.estimatePipelineDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {errorMessage ? (
          <WidgetError message={errorMessage} />
        ) : (
          <>
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">
              {t("dashboard.pipelineTotal", { count: pipeline.total })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <div key={item.key} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
                  <p className="text-xs text-[var(--color-text-secondary)]">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{item.value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WidgetError({ message }: { message: string }) {
  return (
    <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
      {message}
    </p>
  );
}

function WidgetEmpty({ label }: { label: string }) {
  return (
    <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
      {label}
    </p>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
