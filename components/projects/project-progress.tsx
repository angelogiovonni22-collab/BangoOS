type ProjectProgressProps = {
  value: number;
};

export function ProjectProgress({ value }: ProjectProgressProps) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="min-w-[140px]">
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>{normalized}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)]">
        <div
          className="h-2 rounded-full bg-[var(--color-brand-600)] transition-all"
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}
