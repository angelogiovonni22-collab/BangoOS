import { Card, CardContent, SkeletonLoader } from "@/components/ui";

export default function ProjectDetailsLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <SkeletonLoader className="h-4 w-28" />
            <SkeletonLoader className="h-10 w-80" />
            <SkeletonLoader className="h-5 w-64" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SkeletonLoader className="h-20 w-full" />
            <SkeletonLoader className="h-20 w-full" />
            <SkeletonLoader className="h-20 w-full" />
            <SkeletonLoader className="h-20 w-full" />
            <SkeletonLoader className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>

      <SkeletonLoader className="h-16 w-full" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SkeletonLoader className="h-24 w-full" />
          <SkeletonLoader className="h-72 w-full" />
          <SkeletonLoader className="h-72 w-full" />
        </div>

        <div className="space-y-4">
          <SkeletonLoader className="h-52 w-full" />
          <SkeletonLoader className="h-52 w-full" />
          <SkeletonLoader className="h-52 w-full" />
        </div>
      </div>
    </div>
  );
}
