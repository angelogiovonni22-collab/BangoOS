type PhaseProgressBarProps = {
  percentage: number;
};

export function PhaseProgressBar({ percentage }: PhaseProgressBarProps) {
  const normalized = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
}
