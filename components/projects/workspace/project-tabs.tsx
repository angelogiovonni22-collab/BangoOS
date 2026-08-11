import { Activity, Briefcase, Camera, CircleDollarSign, ClipboardList, Files, FileText, LayoutGrid, Ruler, ShieldCheck, Truck, Users, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { PROJECT_WORKSPACE_TABS } from "./project-workspace-tabs";
import type { ProjectWorkspaceTabKey } from "./types";
import { WorkspaceTabs } from "@/components/workspace";

type ProjectTabsProps = {
  activeTab: ProjectWorkspaceTabKey;
  onChange: (tab: ProjectWorkspaceTabKey) => void;
  t: (key: string) => string;
};

export function ProjectTabs({ activeTab, onChange, t }: ProjectTabsProps) {
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
    inspections: <ShieldCheck size={16} aria-hidden="true" />,
    activity: <Activity size={16} aria-hidden="true" />,
  };

  return (
    <WorkspaceTabs
      activeKey={activeTab}
      items={PROJECT_WORKSPACE_TABS.map((tab) => ({ key: tab.key, label: t(tab.labelKey), icon: tabIcon[tab.key] }))}
      onChange={(key) => onChange(key as ProjectWorkspaceTabKey)}
      ariaLabel={t("projects.workspaceNavigationLabel")}
    />
  );
}
