import { CircleDollarSign, Clock3, FileText, HardHat, Package, ReceiptText, ShieldAlert } from "lucide-react";
import { SummaryCard } from "@/components/ui";
import type { WorkspaceSummaryCardItem } from "./types";

type ProjectSummaryCardsProps = {
  budget: string;
  scheduleHealth: string;
  crewAssigned: string;
  openDailyReports: string;
  openSafetyItems: string;
  equipmentAssigned: string;
  invoicesOutstanding: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectSummaryCards({
  budget,
  scheduleHealth,
  crewAssigned,
  openDailyReports,
  openSafetyItems,
  equipmentAssigned,
  invoicesOutstanding,
  t,
}: ProjectSummaryCardsProps) {
  const cards: WorkspaceSummaryCardItem[] = [
    {
      label: t("projects.workspaceBudgetCard"),
      value: budget,
      context: t("projects.workspaceBudgetContext"),
      icon: <CircleDollarSign size={18} aria-hidden="true" />,
      tone: "analytics",
    },
    {
      label: t("projects.workspaceScheduleHealthCard"),
      value: scheduleHealth,
      context: t("projects.workspaceScheduleHealthContext"),
      icon: <Clock3 size={18} aria-hidden="true" />,
      tone: "blue",
    },
    {
      label: t("projects.workspaceCrewCard"),
      value: crewAssigned,
      context: t("projects.workspaceCrewContext"),
      icon: <HardHat size={18} aria-hidden="true" />,
      tone: "green",
    },
    {
      label: t("projects.workspaceDailyReportsCard"),
      value: openDailyReports,
      context: t("projects.workspaceDailyReportsContext"),
      icon: <FileText size={18} aria-hidden="true" />,
      tone: "slate",
    },
    {
      label: t("projects.workspaceSafetyCard"),
      value: openSafetyItems,
      context: t("projects.workspaceSafetyContext"),
      icon: <ShieldAlert size={18} aria-hidden="true" />,
      tone: "amber",
    },
    {
      label: t("projects.workspaceEquipmentCard"),
      value: equipmentAssigned,
      context: t("projects.workspaceEquipmentContext"),
      icon: <Package size={18} aria-hidden="true" />,
      tone: "blue",
    },
    {
      label: t("projects.workspaceInvoicesCard"),
      value: invoicesOutstanding,
      context: t("projects.workspaceInvoicesContext"),
      icon: <ReceiptText size={18} aria-hidden="true" />,
      tone: "analytics",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7" aria-label={t("projects.workspaceSummarySection")}>
      {cards.map((card) => (
        <SummaryCard
          key={card.label}
          icon={card.icon}
          label={card.label}
          value={card.value}
          context={card.context}
          compact
          tone={
            card.tone === "green"
              ? "success"
              : card.tone === "amber"
                ? "warning"
                : card.tone === "slate"
                  ? "neutral"
                  : card.tone === "indigo"
                    ? "analytics"
                    : card.tone === "analytics"
                      ? "analytics"
                      : "brand"
          }
        />
      ))}
    </section>
  );
}
