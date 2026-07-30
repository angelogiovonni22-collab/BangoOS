import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

type ProjectBudgetProps = {
  title: string;
  budget: string;
  estimatedCost: string;
  profit: string;
  outstandingInvoices: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectBudget({ title, budget, estimatedCost, profit, outstandingInvoices, t }: ProjectBudgetProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/50">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <BudgetRow label={t("projects.workspaceBudgetBudget")} value={budget} />
        <BudgetRow label={t("projects.workspaceBudgetEstimatedCost")} value={estimatedCost} />
        <BudgetRow label={t("projects.workspaceBudgetProfit")} value={profit} />
        <BudgetRow label={t("projects.workspaceBudgetOutstandingInvoices")} value={outstandingInvoices} />
      </CardContent>
    </Card>
  );
}

function BudgetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white px-4 py-3">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}
