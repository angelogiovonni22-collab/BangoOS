import type { ReactNode } from "react";
import { Building2, CircleUserRound, Users, UserCheck } from "lucide-react";
import { SummaryCard } from "@/components/ui";

type CustomerMetric = {
  label: string;
  value: number;
  context: string;
  tone: "brand" | "success" | "info" | "warning";
  icon: ReactNode;
};

type CustomerMetricsProps = {
  totalCustomers: number;
  activeCustomers: number;
  leadCustomers: number;
  commercialCustomers: number;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CustomerMetrics({
  totalCustomers,
  activeCustomers,
  leadCustomers,
  commercialCustomers,
  t,
}: CustomerMetricsProps) {
  const metrics: CustomerMetric[] = [
    {
      label: t("customers.summaryTotal"),
      value: totalCustomers,
      context: t("customers.metrics.allTime"),
      tone: "brand",
      icon: <Users size={16} aria-hidden="true" />,
    },
    {
      label: t("customers.summaryActive"),
      value: activeCustomers,
      context: t("customers.metrics.noChange"),
      tone: "success",
      icon: <UserCheck size={16} aria-hidden="true" />,
    },
    {
      label: t("customers.summaryLeads"),
      value: leadCustomers,
      context: t("customers.metrics.last30Days"),
      tone: "info",
      icon: <CircleUserRound size={16} aria-hidden="true" />,
    },
    {
      label: t("customers.summaryCommercial"),
      value: commercialCustomers,
      context: t("customers.metrics.allTime"),
      tone: "warning",
      icon: <Building2 size={16} aria-hidden="true" />,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("customers.metrics.section")}>
      {metrics.map((metric) => (
        <SummaryCard
          key={metric.label}
          icon={metric.icon}
          label={metric.label}
          value={String(metric.value)}
          context={metric.context}
          tone={metric.tone}
        />
      ))}
    </section>
  );
}
