import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ScheduleConflict } from "@/lib/scheduling";
import { ConflictCard } from "./conflict-card";

type ConflictCenterProps = {
  items: ScheduleConflict[];
  onResolve: (conflictId: string, status: "acknowledged" | "dismissed" | "resolved") => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ConflictCenter({ items, onResolve, t }: ConflictCenterProps) {
  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("scheduling.conflicts.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("scheduling.empty.noConflicts")}
          </p>
        ) : (
          items.map((item) => (
            <ConflictCard key={item.id} conflict={item} onResolve={(status) => onResolve(item.id, status)} t={t} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
