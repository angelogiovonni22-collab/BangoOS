import { Card, CardContent, SkeletonLoader } from "@/components/ui";

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonLoader className="h-6 w-40" />
        <SkeletonLoader className="h-8 w-72" />
      </div>

      <Card variant="elevated">
        <CardContent className="space-y-4 p-6">
          <SkeletonLoader className="h-14 w-full" />
          <SkeletonLoader className="h-14 w-full" />
          <SkeletonLoader className="h-14 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
