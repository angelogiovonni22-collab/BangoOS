import { SkeletonLoader } from "@/components/ui";

export default function CustomerDetailsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonLoader className="h-7 w-40" />
      <SkeletonLoader className="h-10 w-80" />

      <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonLoader className="h-20 w-full" />
          <SkeletonLoader className="h-20 w-full" />
          <SkeletonLoader className="h-20 w-full" />
          <SkeletonLoader className="h-20 w-full" />
          <SkeletonLoader className="h-20 w-full" />
          <SkeletonLoader className="h-20 w-full" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonLoader className="h-40 w-full" />
        <SkeletonLoader className="h-40 w-full" />
      </div>
    </div>
  );
}
