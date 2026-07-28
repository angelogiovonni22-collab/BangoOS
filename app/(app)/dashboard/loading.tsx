import { Card, CardContent, SkeletonLoader } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="space-y-4 p-6">
          <SkeletonLoader className="h-6 w-44" />
          <SkeletonLoader className="h-10 w-72" />
          <SkeletonLoader className="h-10 w-full" />
        </CardContent>
      </Card>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
        <SkeletonLoader className="h-36 w-full" />
      </section>

      <SkeletonLoader className="h-80 w-full" />
    </div>
  );
}
