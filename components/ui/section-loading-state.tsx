import { SkeletonLoader } from "./skeleton-loader";

type SectionLoadingStateProps = {
  rows?: number;
};

export function SectionLoadingState({ rows = 3 }: SectionLoadingStateProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonLoader key={`section-loading-${index}`} className="h-20 w-full rounded-[var(--radius-lg)]" />
      ))}
    </div>
  );
}