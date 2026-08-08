import type { ReactNode } from "react";
import { Badge, EmptyState } from "@/components/ui";
import { WorkspaceSection } from "./workspace-shell";

export function WorkspaceSummaryCards({
  title,
  items,
  columnsClassName = "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
}: {
  title?: string;
  items: Array<{ id: string; label: string; value: string; context?: string; tone: "brand" | "success" | "warning" | "danger" | "info" | "neutral" | "analytics"; icon?: ReactNode }>;
  columnsClassName?: string;
}) {
  return (
    <div className="space-y-3">
      {title ? <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{title}</p> : null}
      <div className={columnsClassName}>
        {items.map((item) => (
          <article key={item.id} className="rounded-[12px] border border-[var(--bos-border-light)] bg-white p-3.5">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{item.icon}{item.label}</p>
            <p className="mt-1 text-[1.1rem] font-extrabold text-[var(--bos-text-strong-on-light)]">{item.value}</p>
            {item.context ? <p className="text-xs text-[var(--bos-text-medium-on-light)]">{item.context}</p> : null}
            <div className="mt-3"><Badge tone={item.tone}>{item.tone}</Badge></div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceActivityFeed({
  title,
  items,
  emptyLabel,
  maxHeightClassName = "max-h-[560px]",
}: {
  title: string;
  items: Array<{ id: string; title: string; detail: string; timestamp: string; tone: "brand" | "success" | "warning" | "danger" | "info" | "neutral" | "analytics"; href?: string }>;
  emptyLabel: string;
  maxHeightClassName?: string;
}) {
  return (
    <WorkspaceSection title={title} className="rounded-[18px] border border-[var(--bos-border-light)]">
      <div className={["space-y-2.5", maxHeightClassName, "overflow-y-auto pr-1"].filter(Boolean).join(" ")}>
        {items.length === 0 ? (
          <EmptyState compact icon="A" title={title} description={emptyLabel} />
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{item.title}</p>
                <Badge tone={item.tone}>{item.tone}</Badge>
              </div>
              <p className="text-sm text-[var(--bos-text-medium-on-light)]">{item.detail}</p>
              <p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">{item.timestamp}</p>
            </article>
          ))
        )}
      </div>
    </WorkspaceSection>
  );
}

export function WorkspaceTimeline({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ id: string; title: string; detail: string; timestamp: string; tone: "brand" | "success" | "warning" | "danger" | "info" | "neutral" | "analytics"; href?: string }>;
  emptyLabel: string;
}) {
  return (
    <WorkspaceSection title={title} className="rounded-[18px] border border-[var(--bos-border-light)]">
      <div className="space-y-2.5">
        {items.length === 0 ? (
          <EmptyState compact icon="T" title={title} description={emptyLabel} />
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">{item.title}</p>
                <Badge tone={item.tone}>{item.tone}</Badge>
              </div>
              <p className="text-sm text-[var(--bos-text-medium-on-light)]">{item.detail}</p>
              <p className="mt-1 text-xs font-medium text-[var(--bos-text-medium-on-light)]">{item.timestamp}</p>
              {item.href ? <p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">{item.href}</p> : null}
            </article>
          ))
        )}
      </div>
    </WorkspaceSection>
  );
}
