"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type {
  DashboardDecisionHealthItem,
  DashboardDecisionItem,
  DashboardDecisionRiskSummary,
  DashboardMorningBriefing,
} from "@/lib/dashboard/types";

type Translator = (key: string, params?: Record<string, string | number>) => string;

type DecisionListWidgetProps = {
  title: string;
  description: string;
  items: DashboardDecisionItem[];
  emptyKey: string;
  t: Translator;
};

function DecisionListWidget(props: DecisionListWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleItems = isExpanded ? props.items : props.items.slice(0, 4);

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {props.items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {props.t(props.emptyKey)}
          </p>
        ) : visibleItems.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityTone(item.priority)}`}>
                {item.priority}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.summary}</p>
            <a href={item.actionHref} className="mt-2 inline-block text-xs font-semibold text-[var(--color-action-primary)] hover:underline">
              {item.actionLabel}
            </a>
          </article>
        ))}
        {props.items.length > 4 ? (
          <Button type="button" variant="secondary" fullWidth onClick={() => setIsExpanded((current) => !current)}>
            {isExpanded ? props.t("dashboard.collapse") : `${props.t("dashboard.viewAll")} (${props.items.length})`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TopPrioritiesWidget({ items, t }: { items: DashboardDecisionItem[]; t: Translator }) {
  return (
    <DecisionListWidget
      title={t("dashboard.topPrioritiesTitle")}
      description={t("dashboard.topPrioritiesDescription")}
      items={items}
      emptyKey="dashboard.topPrioritiesEmpty"
      t={t}
    />
  );
}

export function DecisionRecommendationsWidget({ items, t }: { items: DashboardDecisionItem[]; t: Translator }) {
  return (
    <DecisionListWidget
      title={t("dashboard.decisionRecommendationsTitle")}
      description={t("dashboard.decisionRecommendationsDescription")}
      items={items}
      emptyKey="dashboard.decisionRecommendationsEmpty"
      t={t}
    />
  );
}

export function TodaysDecisionsWidget({ items, t }: { items: DashboardDecisionItem[]; t: Translator }) {
  return (
    <DecisionListWidget
      title={t("dashboard.todaysDecisionsTitle")}
      description={t("dashboard.todaysDecisionsDescription")}
      items={items}
      emptyKey="dashboard.todaysDecisionsEmpty"
      t={t}
    />
  );
}

export function CriticalAlertsWidget({ items, t }: { items: DashboardDecisionItem[]; t: Translator }) {
  return (
    <DecisionListWidget
      title={t("dashboard.criticalAlertsTitle")}
      description={t("dashboard.criticalAlertsDescription")}
      items={items}
      emptyKey="dashboard.criticalAlertsEmpty"
      t={t}
    />
  );
}

export function BusinessHealthWidget({
  items,
  briefing,
  t,
}: {
  items: DashboardDecisionHealthItem[];
  briefing: DashboardMorningBriefing;
  t: Translator;
}) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.businessHealthTitle")}</CardTitle>
        <CardDescription>{t("dashboard.businessHealthDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{briefing.greeting}</p>
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
              <p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">{item.id}</p>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">{item.score}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.rating}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1 text-xs text-[var(--color-text-secondary)]">
          {briefing.lines.slice(0, 5).map((line) => (
            <li key={line}>- {line}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function RiskSummaryWidget({ summary, t }: { summary: DashboardDecisionRiskSummary; t: Translator }) {
  const items = [
    { key: "critical", value: summary.critical },
    { key: "high", value: summary.high },
    { key: "medium", value: summary.medium },
    { key: "low", value: summary.low },
  ] as const;

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.riskSummaryTitle")}</CardTitle>
        <CardDescription>{t("dashboard.riskSummaryDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 p-5">
        {items.map((item) => (
          <div key={item.key} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
            <p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">{item.key}</p>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">{item.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function priorityTone(priority: DashboardDecisionItem["priority"]) {
  if (priority === "critical") {
    return "bg-rose-100 text-rose-700";
  }

  if (priority === "high") {
    return "bg-amber-100 text-amber-700";
  }

  if (priority === "medium") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-100 text-slate-700";
}
