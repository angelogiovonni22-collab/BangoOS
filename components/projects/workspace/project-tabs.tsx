"use client";

import { Activity, Briefcase, Camera, CircleDollarSign, ClipboardList, Files, FileText, LayoutGrid, ReceiptText, Ruler, ShieldCheck, Truck, Users, Wrench } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { PROJECT_WORKSPACE_TABS } from "./project-workspace-tabs";
import type { ProjectWorkspaceTabKey } from "./types";
import { WorkspaceTabs } from "@/components/workspace";

type ProjectTabsProps = {
  activeTab: ProjectWorkspaceTabKey;
  onChange: (tab: ProjectWorkspaceTabKey) => void;
  t: (key: string) => string;
};

const RECEIPTS_TAB_KEY = "receipts";

export function ProjectTabs({ activeTab, onChange, t }: ProjectTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const receiptsSelected = activeTab === "documents" && searchParams.get("section") === RECEIPTS_TAB_KEY;

  const tabIcon: Record<ProjectWorkspaceTabKey, ReactNode> = {
    overview: <LayoutGrid size={16} aria-hidden="true" />,
    tasks: <ClipboardList size={16} aria-hidden="true" />,
    daily_logs: <Briefcase size={16} aria-hidden="true" />,
    photos: <Camera size={16} aria-hidden="true" />,
    blueprints: <Ruler size={16} aria-hidden="true" />,
    documents: <Files size={16} aria-hidden="true" />,
    subcontractors: <Truck size={16} aria-hidden="true" />,
    crew: <Users size={16} aria-hidden="true" />,
    financials: <CircleDollarSign size={16} aria-hidden="true" />,
    change_orders: <Wrench size={16} aria-hidden="true" />,
    rfis: <FileText size={16} aria-hidden="true" />,
    submittals: <ClipboardList size={16} aria-hidden="true" />,
    inspections: <ShieldCheck size={16} aria-hidden="true" />,
    activity: <Activity size={16} aria-hidden="true" />,
  };

  const items = PROJECT_WORKSPACE_TABS.flatMap((tab) => {
    const item = { key: tab.key, label: t(tab.labelKey), icon: tabIcon[tab.key] };
    if (tab.key !== "documents") return [item];
    return [
      item,
      { key: RECEIPTS_TAB_KEY, label: "Receipts", icon: <ReceiptText size={16} aria-hidden="true" /> },
    ];
  });

  const handleChange = (key: string) => {
    if (key === RECEIPTS_TAB_KEY) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", "documents");
      nextParams.set("section", RECEIPTS_TAB_KEY);
      router.replace(`${pathname}?${nextParams.toString()}`);
      return;
    }

    if (searchParams.has("section")) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("section");
      if (key === "overview") nextParams.delete("tab");
      else nextParams.set("tab", key);
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
      return;
    }

    onChange(key as ProjectWorkspaceTabKey);
  };

  return (
    <WorkspaceTabs
      activeKey={receiptsSelected ? RECEIPTS_TAB_KEY : activeTab}
      items={items}
      onChange={handleChange}
      ariaLabel={t("projects.workspaceNavigationLabel")}
    />
  );
}
