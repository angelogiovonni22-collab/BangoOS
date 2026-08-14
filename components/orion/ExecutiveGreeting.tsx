import { CardDescription, CardTitle } from "@/components/ui";
import type { ExecutiveGreeting as ExecutiveGreetingModel } from "@/lib/orion/executive-brief-types";

type ExecutiveGreetingProps = {
  greeting: ExecutiveGreetingModel;
};

export function ExecutiveGreeting({ greeting }: ExecutiveGreetingProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{greeting.eyebrow}</p>
      <CardTitle className="mt-1 text-xl sm:text-2xl">{greeting.title}</CardTitle>
      <CardDescription className="mt-1.5 max-w-3xl">{greeting.description}</CardDescription>
    </div>
  );
}