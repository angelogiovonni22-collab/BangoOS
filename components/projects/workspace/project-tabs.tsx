"use client";

import {
  Activity,
  Briefcase,
  Camera,
  CircleDollarSign,
  ClipboardList,
  Files,
  FileText,
  LayoutGrid,
  ReceiptText,
  Ruler,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { PROJECT_WORKSPACE_TABS } from "./project-workspace-tabs";
import type { ProjectWorkspaceTabKey } from "./types";

type ProjectTabsProps = {
  activeTab: ProjectWorkspaceTabKey;
  onChange: (tab: ProjectWorkspaceTabKey) => void;
  t: (key: string) => string;
};

type ProjectNavKey = ProjectWorkspaceTabKey | "receipts";
type ProjectNavItem = { key: ProjectNavKey; label: string; icon: ReactNode };

const RECEIPTS_TAB_KEY = "receipts";
export function ProjectTabs({ activeTab, onChange, t }: ProjectTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const receiptsSelected = activeTab === "documents" && searchParams.get("section") === RECEIPTS_TAB_KEY;
  const activeKey: ProjectNavKey = receiptsSelected ? RECEIPTS_TAB_KEY : activeTab;

  const tabIcon: Record<ProjectWorkspaceTabKey, ReactNode> = {
    overview: <LayoutGrid size={17} aria-hidden="true" />,
    tasks: <ClipboardList size={17} aria-hidden="true" />,
    daily_logs: <Briefcase size={17} aria-hidden="true" />,
    photos: <Camera size={17} aria-hidden="true" />,
    blueprints: <Ruler size={17} aria-hidden="true" />,
    documents: <Files size={17} aria-hidden="true" />,
    subcontractors: <Truck size={17} aria-hidden="true" />,
    crew: <Users size={17} aria-hidden="true" />,
    financials: <CircleDollarSign size={17} aria-hidden="true" />,
    change_orders: <Wrench size={17} aria-hidden="true" />,
    rfis: <FileText size={17} aria-hidden="true" />,
    submittals: <ClipboardList size={17} aria-hidden="true" />,
    inspections: <ShieldCheck size={17} aria-hidden="true" />,
    activity: <Activity size={17} aria-hidden="true" />,
  };

  const items: ProjectNavItem[] = PROJECT_WORKSPACE_TABS.flatMap((tab) => {
    const item: ProjectNavItem = { key: tab.key, label: t(tab.labelKey), icon: tabIcon[tab.key] };
    if (tab.key !== "documents") return [item];
    return [item, { key: RECEIPTS_TAB_KEY, label: "Receipts", icon: <ReceiptText size={17} aria-hidden="true" /> }];
  });

  const handleChange = (key: ProjectNavKey) => {
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
    <section
      data-bos-surface="dark"
      className="relative min-w-0 max-w-full rounded-[18px] border border-[var(--workspace-tabs-border)] [background:var(--workspace-tabs-surface)] p-2.5 shadow-[0_14px_28px_-22px_rgba(3,7,18,0.72)]"
    >
      <nav className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5" aria-label={t("projects.workspaceNavigationLabel")}>
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleChange(item.key)}
              data-orion-action={`workspace-tab-${item.key}`}
              data-orion-role={`workspace tab: ${item.label}`}
              className={`group inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[11px] border px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
                active
                  ? "border-[var(--workspace-tab-active-border)] [background:var(--workspace-tab-active-surface)] text-white shadow-[0_7px_14px_-11px_rgba(30,120,255,0.72)]"
                  : "border-transparent text-[var(--workspace-tab-idle-text)] hover:border-[var(--workspace-tab-idle-border-hover)] hover:bg-[var(--workspace-tab-idle-bg-hover)] hover:text-white"
              }`}
              aria-selected={active}
              role="tab"
            >
              <span className={active ? "text-white" : "text-[var(--workspace-tab-idle-icon-text)] group-hover:text-white"}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </section>
  );
}
