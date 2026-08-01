import { Briefcase, Clock3, Files, LayoutGrid, PiggyBank, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { PROJECT_WORKSPACE_TABS } from "./project-workspace-tabs";
import type { ProjectWorkspaceTabKey } from "./types";

type ProjectTabsProps = {
  activeTab: ProjectWorkspaceTabKey;
  onChange: (tab: ProjectWorkspaceTabKey) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectTabs({ activeTab, onChange, t }: ProjectTabsProps) {
  const tabIcon: Record<ProjectWorkspaceTabKey, ReactNode> = {
    overview: <LayoutGrid size={15} aria-hidden="true" />,
    work: <Briefcase size={15} aria-hidden="true" />,
    financial: <PiggyBank size={15} aria-hidden="true" />,
    resources: <Wrench size={15} aria-hidden="true" />,
    documents: <Files size={15} aria-hidden="true" />,
    timeline: <Clock3 size={15} aria-hidden="true" />,
  };

  return (
    <section className="bf-depth-surface rounded-[16px] border border-[var(--color-border-subtle)] bg-white px-2 py-1.5 shadow-[var(--shadow-small)]">
      <nav className="flex gap-1 overflow-x-auto" aria-label={t("projects.workspaceNavigationLabel")}>
        {PROJECT_WORKSPACE_TABS.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`bf-selection-sync group whitespace-nowrap border-b-[3px] px-4 py-3.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
                active
                  ? "border-[var(--color-brand-600)] text-[var(--color-brand-700)] shadow-[inset_0_-1px_0_var(--color-brand-600)]"
                  : "border-transparent text-[var(--color-neutral-700)] hover:text-[var(--color-text-primary)]"
              }`}
              aria-selected={active}
              role="tab"
            >
              <span className="flex items-center gap-2">
                <span className={`transition ${active ? "text-[var(--color-brand-700)]" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"}`}>
                  {tabIcon[tab.key]}
                </span>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}
