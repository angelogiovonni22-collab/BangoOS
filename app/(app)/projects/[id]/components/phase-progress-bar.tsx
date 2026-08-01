import { AnimatedProgress } from "@/components/motion";

type PhaseProgressBarProps = {
  percentage: number;
};

export function PhaseProgressBar({ percentage }: PhaseProgressBarProps) {
  const normalized = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <AnimatedProgress
      value={normalized}
      className="h-2"
      trackClassName="bg-slate-200"
      fillClassName="bg-blue-600"
      durationMs={220}
    />
  );
}
