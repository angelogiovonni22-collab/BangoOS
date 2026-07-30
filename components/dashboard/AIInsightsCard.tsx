import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type AIInsightsCardProps = {
  title: string;
  description: string;
  placeholder: string;
};

export function AIInsightsCard({ title, description, placeholder }: AIInsightsCardProps) {
  return (
    <Card as="section" className="overflow-hidden">
      <CardHeader className="bg-[var(--color-analytics-50)]/60">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="p-5">
        <p className="rounded-[var(--radius-xl)] border border-[var(--color-analytics-100)] bg-[var(--color-analytics-50)] px-4 py-4 text-sm leading-6 text-[var(--color-text-secondary)]">
          {placeholder}
        </p>
      </CardContent>
    </Card>
  );
}
