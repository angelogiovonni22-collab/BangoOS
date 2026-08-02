import type { QuantumMetricData } from "@/lib/labs/quantum/types";
import { QuantumStatus } from "./QuantumStatus";

type QuantumMetricProps = {
  metric: QuantumMetricData;
};

export function QuantumMetric({ metric }: QuantumMetricProps) {
  return (
    <article className="rounded-xl bg-[color:color-mix(in_oklab,var(--q-surface)_72%,black)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--q-text-muted)]">{metric.label}</p>
        <div className="flex items-center gap-1.5">
          <QuantumStatus tone={metric.status} label={metric.status} />
          <span className="text-[10px] uppercase tracking-[0.09em] text-[var(--q-text-muted)]">{metric.freshness}</span>
        </div>
      </div>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--q-text)]">{metric.value}</p>
      <p className="mt-0.5 text-xs text-[var(--q-text-muted)]">{metric.trend}</p>
    </article>
  );
}
