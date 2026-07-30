type MetricTrendProps = {
  direction?: "up" | "down" | "flat";
  label: string;
  comparison?: string;
};

export function MetricTrend({ direction = "flat", label, comparison }: MetricTrendProps) {
  const toneClass =
    direction === "up"
      ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
      : direction === "down"
        ? "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
        : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]";

  const symbol = direction === "up" ? "▲" : direction === "down" ? "▼" : "•";

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${toneClass}`}>
        {symbol} {label}
      </span>
      {comparison ? <span className="text-xs text-[var(--color-text-muted)]">{comparison}</span> : null}
    </div>
  );
}