import { Card, CardContent, SkeletonLoader } from "@/components/ui";

export default function ProjectDetailsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonLoader className="h-8 w-64" />
        <SkeletonLoader className="h-6 w-80" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
      </div>

      <SkeletonLoader className="h-96 w-full" />
    </div>
  );
}
