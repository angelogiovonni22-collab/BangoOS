import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import type { WorkspaceBadgeTone } from "./workspace-shell";

export type WorkspaceBreadcrumbItem = {
  label: string;
  href?: string;
};

export function WorkspaceHeader({
  breadcrumbs,
  title,
  subtitle,
  badgeLabel,
  badgeTone = "neutral",
  actions,
  className = "",
}: {
  breadcrumbs: WorkspaceBreadcrumbItem[];
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  badgeTone?: WorkspaceBadgeTone;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <Card as="section" variant="elevated" className={["min-w-0 max-w-full overflow-hidden rounded-[20px] border-[var(--workspace-header-border)] [background:var(--workspace-header-surface)] shadow-[0_28px_52px_-30px_rgba(2,6,17,0.88)]", className].filter(Boolean).join(" ")}>
      <CardContent className="space-y-6 p-6 lg:p-7">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-body-secondary font-medium text-[var(--workspace-header-text)]">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="flex items-center gap-2">
                {item.href ? <Link href={item.href} className="font-semibold text-[var(--workspace-header-text-strong)] transition hover:text-white">{item.label}</Link> : <span className="font-semibold text-[var(--workspace-header-text-strong)]">{item.label}</span>}
                {index < breadcrumbs.length - 1 ? <span aria-hidden="true">/</span> : null}
              </span>
            ))}
          </div>
          {actions ? <div className="flex min-w-0 w-full flex-wrap items-center justify-end gap-2 sm:w-auto">{actions}</div> : null}
        </div>

        <div className="space-y-3">
          <div className="flex min-w-0 flex-wrap items-start gap-3">
            <div className="min-w-0 space-y-2">
              <h1 className="text-h1 break-words text-[var(--workspace-header-title)] sm:text-[2.4rem]">{title}</h1>
            </div>
            {badgeLabel ? <Badge tone={badgeTone} className="mt-2 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.05em]">{badgeLabel}</Badge> : null}
          </div>
          {subtitle ? <p className="text-body-secondary font-semibold text-[var(--workspace-header-subtitle)]">{subtitle}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceHero({
  title,
  subtitle,
  badgeLabel,
  badgeTone = "neutral",
  media,
  details,
  actions,
  footer,
  className = "",
}: {
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  badgeTone?: WorkspaceBadgeTone;
  media: ReactNode;
  details: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card as="section" variant="elevated" className={["group min-w-0 max-w-full overflow-hidden rounded-[20px] border-[var(--workspace-hero-border)] [background:var(--workspace-hero-surface)] shadow-[0_26px_56px_-30px_rgba(2,6,17,0.88)]", className].filter(Boolean).join(" ")}>
      <CardContent className="grid min-w-0 gap-6 p-5 lg:grid-cols-[1.3fr_minmax(0,1fr)] lg:p-7">
        <div>{media}</div>
        <section className="flex min-w-0 h-full flex-col justify-between rounded-[18px] border border-[var(--workspace-hero-panel-border)] [background:var(--workspace-hero-panel-surface)] p-5 text-[var(--workspace-hero-panel-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:p-6">
          <div className="space-y-5">
            {badgeLabel ? <Badge tone={badgeTone} className="border border-[var(--workspace-hero-badge-border)] [background:var(--workspace-hero-badge-surface)] px-3 py-1 text-xs font-bold tracking-[0.05em] text-white">{badgeLabel}</Badge> : null}
            <div className="space-y-2">
              <h2 className="text-h2 max-w-[90%] break-words text-[var(--workspace-hero-title)] md:text-[2.06rem]">{title}</h2>
              {subtitle ? <p className="text-body-secondary font-semibold text-[var(--workspace-hero-subtitle)]">{subtitle}</p> : null}
            </div>
            {details}
          </div>
          {actions ? <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--workspace-hero-divider)] pt-4">{actions}</div> : null}
          {footer ? <div className="mt-5 border-t border-[var(--workspace-hero-divider)] pt-4">{footer}</div> : null}
        </section>
      </CardContent>
    </Card>
  );
}

export function WorkspaceTabs({
  activeKey,
  items,
  onChange,
  ariaLabel,
}: {
  activeKey: string;
  items: Array<{ key: string; label: string; icon: ReactNode }>;
  onChange: (key: string) => void;
  ariaLabel: string;
}) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[20px] border border-[var(--workspace-tabs-border)] [background:var(--workspace-tabs-surface)] p-2.5 shadow-[0_18px_32px_-22px_rgba(3,7,18,0.72)]">
      <nav className="flex w-full min-w-0 max-w-full gap-1 overflow-x-auto pb-0.5" aria-label={ariaLabel}>
        {items.map((tab) => {
          const active = tab.key === activeKey;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`group whitespace-nowrap rounded-[12px] border px-3.5 py-2.5 text-[0.82rem] font-semibold tracking-[0.01em] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
                active
                  ? "border-[var(--workspace-tab-active-border)] [background:var(--workspace-tab-active-surface)] text-white shadow-[0_8px_16px_-12px_rgba(30,120,255,0.7)]"
                  : "border-transparent text-[var(--workspace-tab-idle-text)] hover:border-[var(--workspace-tab-idle-border-hover)] hover:bg-[var(--workspace-tab-idle-bg-hover)] hover:text-white"
              }`}
              aria-selected={active}
              role="tab"
            >
              <span className="flex items-center gap-2">
                <span className={`rounded-full p-0.5 transition ${active ? "bg-[var(--workspace-tab-active-icon-bg)] text-[var(--workspace-tab-active-icon-text)]" : "text-[var(--workspace-tab-idle-icon-text)] group-hover:bg-[var(--workspace-tab-idle-icon-bg-hover)] group-hover:text-[var(--workspace-tab-idle-icon-text-hover)]"}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}

export function WorkspaceActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function WorkspaceQuickActions({ actions }: { actions: Array<{ id: string; label: string; href?: string; disabled?: boolean; title?: string }> }) {
  return (
    <div className="grid gap-2.5">
      {actions.map((action) => {
        if (action.href && !action.disabled) {
          return (
            <Link key={action.id} href={action.href} className="inline-flex items-center justify-between rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--bos-text-strong-on-light)] hover:bg-[var(--color-neutral-50)]">
              <span>{action.label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          );
        }

        return (
          <Button key={action.id} variant="outline" disabled={action.disabled} title={action.title} className="justify-between rounded-[11px] border-[var(--bos-border-light)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--bos-text-strong-on-light)] hover:bg-[var(--color-neutral-50)]">
            <span>{action.label}</span>
            <span aria-hidden="true">→</span>
          </Button>
        );
      })}
    </div>
  );
}
