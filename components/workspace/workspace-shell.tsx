import type { ReactNode } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, SkeletonLoader } from "@/components/ui";

export type WorkspaceBadgeTone = "brand" | "success" | "warning" | "danger" | "neutral" | "info" | "analytics";

export function WorkspaceShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={["container-page min-w-0 w-full space-y-[var(--space-section)] overflow-x-clip rounded-[20px] bg-[var(--workspace-shell-surface)] p-4 md:p-5 lg:p-6", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function WorkspaceGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function WorkspaceSection({
  title,
  description,
  icon,
  action,
  children,
  className = "",
  contentClassName = "",
  headerClassName = "",
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
}) {
  return (
    <Card as="section" variant="elevated" className={["rounded-[18px] border border-[var(--bos-border-light)]", className].filter(Boolean).join(" ")}>
      <CardHeader className={["border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]", headerClassName].filter(Boolean).join(" ")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--bos-border-light)] bg-white text-[var(--bos-text-medium-on-light)]">{icon}</span> : null}
            <div className="min-w-0">
              <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">{title}</CardTitle>
              {description ? <p className="mt-1 text-sm text-[var(--bos-text-medium-on-light)]">{description}</p> : null}
            </div>
          </div>
          {action ? <div className="w-full sm:w-auto sm:shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={["p-4", contentClassName].filter(Boolean).join(" ")}>{children}</CardContent>
    </Card>
  );
}

export function WorkspaceStatusPanel({
  title,
  status,
  description,
  tone = "neutral",
  children,
}: {
  title: string;
  status: string;
  description?: string;
  tone?: WorkspaceBadgeTone;
  children?: ReactNode;
}) {
  return (
    <Card as="section" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
      <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
        <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="text-sm font-semibold text-[var(--bos-text-medium-on-light)]">Status</p>
          <Badge tone={tone}>{status}</Badge>
        </div>
        {description ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">{description}</p> : null}
        {children}
      </CardContent>
    </Card>
  );
}

export function WorkspaceInfoCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <article className="rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</p>
        {icon ? <span className="text-[var(--bos-text-medium-on-light)]">{icon}</span> : null}
      </div>
    </article>
  );
}

export function WorkspaceWidget({ label, value, context, icon }: { label: string; value: string; context?: string; icon?: ReactNode }) {
  return (
    <article className="rounded-[12px] border border-[var(--bos-border-light)] bg-white p-3.5">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{icon}{label}</p>
      <p className="mt-1 text-[1.1rem] font-extrabold text-[var(--bos-text-strong-on-light)]">{value}</p>
      {context ? <p className="text-xs text-[var(--bos-text-medium-on-light)]">{context}</p> : null}
    </article>
  );
}

export function WorkspaceLoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-[var(--workspace-shell-border)] bg-[var(--workspace-loading-surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="space-y-2">
          <SkeletonLoader className="h-8 w-72" />
          <SkeletonLoader className="h-5 w-96" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonLoader className="h-24 w-full" />
          <SkeletonLoader className="h-24 w-full" />
          <SkeletonLoader className="h-24 w-full" />
          <SkeletonLoader className="h-24 w-full" />
        </div>
      </div>
      <SkeletonLoader className="h-64 w-full" />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: rows }).map((_, index) => <SkeletonLoader key={`workspace-loading-${index}`} className="h-36 w-full" />)}
      </section>
      <SkeletonLoader className="h-14 w-full" />
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr_1fr]">
        <SkeletonLoader className="h-72 w-full" />
        <SkeletonLoader className="h-72 w-full" />
        <SkeletonLoader className="h-72 w-full" />
      </div>
    </div>
  );
}

export function WorkspaceEmptyState({ icon, title, description, action, compact = false }: { icon: string; title: string; description: string; action?: ReactNode; compact?: boolean }) {
  return <EmptyState compact={compact} icon={icon} title={title} description={description} action={action} />;
}

export function WorkspaceFooter({ children }: { children: ReactNode }) {
  return <div className="rounded-[12px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5 text-xs text-[var(--bos-text-medium-on-light)]">{children}</div>;
}
