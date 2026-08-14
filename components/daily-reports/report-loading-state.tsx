import { SkeletonLoader } from "@/components/ui";

export function ReportLoadingState() {
  return (
    <div className="space-y-4">
      <SkeletonLoader className="h-24 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
      </div>
      <SkeletonLoader className="h-96 w-full" />
    </div>
  );
}
