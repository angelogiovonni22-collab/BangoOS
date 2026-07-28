import { SkeletonLoader } from "@/components/ui";

export function CrewLoadingState() {
  return (
    <div className="space-y-4">
      <SkeletonLoader className="h-24 w-full" />
      <SkeletonLoader className="h-44 w-full" />
      <SkeletonLoader className="h-96 w-full" />
    </div>
  );
}
