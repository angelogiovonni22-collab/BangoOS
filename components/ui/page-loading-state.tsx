import { SkeletonLoader } from "./skeleton-loader";

type PageLoadingStateProps = {
  sections?: number;
};

export function PageLoadingState({ sections = 3 }: PageLoadingStateProps) {
  return (
    <div className="space-y-[var(--space-section)]">
      <div className="space-y-[var(--space-form-gap)]">
        <SkeletonLoader className="h-10 w-64" />
        <SkeletonLoader className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-[var(--grid-gap-base)] lg:grid-cols-2">
        {Array.from({ length: sections }).map((_, index) => (
          <SkeletonLoader key={`page-loading-${index}`} className="h-40 w-full rounded-[var(--radius-xl)]" />
        ))}
      </div>
    </div>
  );
}