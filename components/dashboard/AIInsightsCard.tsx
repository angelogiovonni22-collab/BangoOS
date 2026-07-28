import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type AIInsightsCardProps = {
  title: string;
  description: string;
  placeholder: string;
};

export function AIInsightsCard({ title, description, placeholder }: AIInsightsCardProps) {
  return (
    <Card as="section" className="overflow-hidden bg-[linear-gradient(135deg,_rgba(37,99,235,0.92),_rgba(14,116,144,0.92))] text-[var(--color-text-inverse)]">
      <CardHeader className="border-white/20">
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-blue-100">{description}</CardDescription>
      </CardHeader>

      <CardContent className="p-5">
        <p className="rounded-[var(--radius-xl)] border border-white/20 bg-white/10 px-4 py-4 text-sm leading-6 text-blue-50">
          {placeholder}
        </p>
      </CardContent>
    </Card>
  );
}
