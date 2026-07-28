import { Card, CardContent, SkeletonLoader } from "@/components/ui";

export function ProjectTimelineSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-4">
          <SkeletonLoader className="h-16 w-full" />
          <SkeletonLoader className="h-16 w-full" />
          <SkeletonLoader className="h-16 w-full" />
          <SkeletonLoader className="h-16 w-full" />
        </CardContent>
      </Card>

      <SkeletonLoader className="h-24 w-full" />
      <SkeletonLoader className="h-40 w-full" />
      <SkeletonLoader className="h-40 w-full" />
    </div>
  );
}
