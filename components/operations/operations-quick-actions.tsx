import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  CalendarClock,
  ClipboardList,
  ShieldAlert,
  Users,
  Wrench,
  Camera,
} from "./operations-icons";

type OperationsQuickActionsProps = {
  onCreateNote: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const links = [
  { key: "assignCrew", href: "/crews", icon: Wrench },
  { key: "viewSchedule", href: "/schedule", icon: CalendarClock },
  { key: "addDailyReport", href: "/projects", icon: ClipboardList },
  { key: "reviewSafety", href: "/operations", icon: ShieldAlert },
  { key: "openSitecam", href: "/projects", icon: Camera },
  { key: "availableEmployees", href: "/employees", icon: Users },
] as const;

export function OperationsQuickActions({ onCreateNote, t }: OperationsQuickActionsProps) {
  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("operations.sections.quickActions")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-card)] hover:shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            >
              <Icon className="h-4 w-4 text-[var(--color-brand-700)]" />
              {t(`operations.quickActions.${item.key}`)}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onCreateNote}
          className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-brand-300)] bg-[var(--color-brand-50)] px-3 py-2.5 text-sm font-semibold text-[var(--color-brand-700)] transition hover:bg-[var(--color-brand-100)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
        >
          <ClipboardList className="h-4 w-4" />
          {t("operations.quickActions.createOperationsNote")}
        </button>
      </CardContent>
    </Card>
  );
}
