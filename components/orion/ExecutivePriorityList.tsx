import Link from "next/link";
import { StatusPulse } from "@/components/motion";
import type { ExecutivePriorityItem } from "@/lib/orion/executive-brief-types";

type ExecutivePriorityListProps = {
  items: ExecutivePriorityItem[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ExecutivePriorityList({ items, t }: ExecutivePriorityListProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t("orion.priorityTitle")}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">{t("orion.priorityDescription")}</p>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const content = (
            <article className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.08em] ${severityTone(item.severity)}`}>
                    {t(`dashboard.priority${toTitle(item.severity)}`)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
                </div>
                {item.affectedCount !== null ? (
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">{item.affectedCount}</span>
                ) : null}
              </div>
            </article>
          );

          return (
            <StatusPulse key={item.id} triggerKey={`${item.id}:${item.severity}:${item.score}`} tone={item.severity === "critical" || item.severity === "high" ? "warning" : "neutral"}>
              {item.href ? <Link href={item.href} className="block focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] rounded-[var(--radius-lg)]">{content}</Link> : content}
            </StatusPulse>
          );
        })}
      </div>
    </section>
  );
}

function severityTone(severity: ExecutivePriorityItem["severity"]) {
  if (severity === "critical") return "text-[var(--color-danger-700)]";
  if (severity === "high") return "text-[var(--color-warning-700)]";
  if (severity === "medium") return "text-[var(--color-brand-700)]";
  return "text-[var(--color-text-muted)]";
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}