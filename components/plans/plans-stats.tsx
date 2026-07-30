import { AlertCircle, Clock3, FileText, GitCompareArrows, MessageSquareWarning } from "lucide-react";
import { SummaryCard } from "@/components/ui";

type PlansStatsProps = {
  totalDocuments: number;
  latestRevision: string;
  pendingReviews: number;
  openRfis: number;
  openSubmittals: number;
};

export function PlansStats({
  totalDocuments,
  latestRevision,
  pendingReviews,
  openRfis,
  openSubmittals,
}: PlansStatsProps) {
  const items = [
    {
      label: "Total Documents",
      value: String(totalDocuments),
      context: "Active files",
      icon: <FileText size={17} aria-hidden="true" />,
      tone: "info" as const,
    },
    {
      label: "Latest Revision",
      value: latestRevision,
      context: "Most recent set",
      icon: <GitCompareArrows size={17} aria-hidden="true" />,
      tone: "brand" as const,
    },
    {
      label: "Pending Reviews",
      value: String(pendingReviews),
      context: "Awaiting approval",
      icon: <Clock3 size={17} aria-hidden="true" />,
      tone: "warning" as const,
    },
    {
      label: "Open RFIs",
      value: String(openRfis),
      context: "Linked questions",
      icon: <MessageSquareWarning size={17} aria-hidden="true" />,
      tone: "danger" as const,
    },
    {
      label: "Open Submittals",
      value: String(openSubmittals),
      context: "Pending packages",
      icon: <AlertCircle size={17} aria-hidden="true" />,
      tone: "neutral" as const,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Plans quick stats">
      {items.map((item) => (
        <SummaryCard
          key={item.label}
          icon={item.icon}
          label={item.label}
          value={item.value}
          context={item.context}
          compact
          tone={item.tone}
        />
      ))}
    </section>
  );
}
