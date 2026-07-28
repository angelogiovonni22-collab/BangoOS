import { SkeletonLoader } from "@/components/ui";

export function OperationsLoadingState() {
  return (
    <div className="space-y-5">
      <SkeletonLoader className="h-28 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
      </div>
      <SkeletonLoader className="h-96 w-full" />
      <SkeletonLoader className="h-96 w-full" />
    </div>
  );
}
