import { Card, CardContent } from "@/components/ui";

type DashboardHeaderProps = {
  greeting: string;
  companyName: string;
  currentDate: string;
  subtitle: string;
};

export function DashboardHeader({ greeting, companyName, currentDate, subtitle }: DashboardHeaderProps) {
  return (
    <Card as="section" className="overflow-hidden border-white/60 bg-white/85 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-700)]">
              {companyName}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
              {greeting}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)] sm:text-base">
              {subtitle}
            </p>
          </div>

          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">
            {currentDate}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
