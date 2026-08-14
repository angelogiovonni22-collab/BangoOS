import { Badge } from "@/components/ui";
import { readinessTone } from "@/lib/orion/executive-status";
import type { ExecutiveReadinessState } from "@/lib/orion/executive-brief-types";

type ExecutiveStatusProps = {
  state: ExecutiveReadinessState;
  generatedAt: string;
  localeTag: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ExecutiveStatus({ state, generatedAt, localeTag, t }: ExecutiveStatusProps) {
  const tone = readinessTone(state);
  const toneClass = tone === "success"
    ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
    : tone === "warning"
      ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]"
      : "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]";

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Badge className={toneClass}>{t(`orion.readiness${toTitle(state)}`)}</Badge>
      <p className="text-xs text-[var(--color-text-muted)]">
        {t("orion.generatedAt", {
          value: new Intl.DateTimeFormat(localeTag, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(generatedAt)),
        })}
      </p>
    </div>
  );
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}