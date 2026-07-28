import { SkeletonLoader } from "@/components/ui";

export function EmployeeLoadingState() {
  return (
    <div className="space-y-4">
      <SkeletonLoader className="h-24 w-full" />
      <SkeletonLoader className="h-40 w-full" />
      <SkeletonLoader className="h-80 w-full" />
    </div>
  );
}
