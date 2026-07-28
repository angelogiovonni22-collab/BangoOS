import { SkeletonLoader } from "@/components/ui";

export default function ProjectsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <SkeletonLoader className="h-8 w-44" />
        <SkeletonLoader className="h-6 w-96" />
      </div>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
      </section>

      <div className="space-y-4 rounded-3xl border border-[var(--color-border-subtle)] bg-white p-6">
        <SkeletonLoader className="h-12 w-full" />
        <SkeletonLoader className="h-14 w-full" />
        <SkeletonLoader className="h-14 w-full" />
        <SkeletonLoader className="h-14 w-full" />
      </div>
    </div>
  );
}
