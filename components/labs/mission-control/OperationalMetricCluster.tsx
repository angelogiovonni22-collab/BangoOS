import type { MissionMetric } from "@/lib/labs/mission-control/types";
import { CountUp } from "@/components/motion";
import { MissionStatusPill } from "./MissionStatusPill";

type OperationalMetricClusterProps = {
  metrics: MissionMetric[];
};

export function OperationalMetricCluster({ metrics }: OperationalMetricClusterProps) {
  return (
    <section aria-label="Supporting metrics" className="rounded-2xl bg-[color:color-mix(in_oklab,var(--mc-surface)_66%,black)] p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.11em] text-[var(--mc-text-muted)]">Supporting Metrics</h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const numericValue = Number(metric.value.replace(/[^0-9.]/g, ""));
          const hasNumeric = Number.isFinite(numericValue) && numericValue > 0;

          return (
            <article key={metric.id} className="rounded-xl bg-[color:color-mix(in_oklab,var(--mc-surface-2)_72%,black)] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--mc-text-muted)]">{metric.label}</p>
                <MissionStatusPill label={metric.status} severity={metric.status} />
              </div>
              <p className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--mc-text)]">
                {hasNumeric ? <CountUp value={numericValue} /> : metric.value}
                {metric.value.includes("%") ? "%" : ""}
              </p>
              <p className="mt-0.5 text-xs text-[var(--mc-text-muted)]">{metric.trend} • Freshness: {metric.freshness}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
