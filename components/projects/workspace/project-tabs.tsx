import { PROJECT_WORKSPACE_TABS } from "./project-workspace-tabs";
import type { ProjectWorkspaceTabKey } from "./types";

type ProjectTabsProps = {
  activeTab: ProjectWorkspaceTabKey;
  onChange: (tab: ProjectWorkspaceTabKey) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectTabs({ activeTab, onChange, t }: ProjectTabsProps) {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-1.5 shadow-[var(--shadow-small)]">
      <nav className="flex gap-1.5 overflow-x-auto" aria-label={t("projects.workspaceNavigationLabel")}>
        {PROJECT_WORKSPACE_TABS.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`whitespace-nowrap rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
                active
                  ? "bg-[var(--color-brand-50)] text-[var(--color-brand-800)] shadow-[inset_0_0_0_1px_var(--color-brand-100)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
              }`}
              aria-pressed={active}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </nav>
    </section>
  );
}
