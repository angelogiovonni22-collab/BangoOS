import type { QuantumMetricData } from "@/lib/labs/quantum/types";
import { QuantumMetric } from "./QuantumMetric";

type QuantumMetricStripProps = {
  metrics: QuantumMetricData[];
};

export function QuantumMetricStrip({ metrics }: QuantumMetricStripProps) {
  return (
    <section aria-label="Supporting metrics" className="rounded-2xl bg-[color:color-mix(in_oklab,var(--q-surface)_62%,black)] p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.11em] text-[var(--q-text-muted)]">Supporting Metrics</h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <QuantumMetric key={metric.id} metric={metric} />
        ))}
      </div>
    </section>
  );
}
