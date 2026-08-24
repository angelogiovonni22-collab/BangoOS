"use client";

import {
  Activity,
  Briefcase,
  Camera,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Files,
  FileText,
  LayoutGrid,
  MoreHorizontal,
  ReceiptText,
  Ruler,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
const PRIMARY_TABS: ProjectNavKey[] = [
  "overview",
  "tasks",
  "photos",
  "blueprints",
  "documents",
  RECEIPTS_TAB_KEY,
];

export function ProjectTabs({ activeTab, onChange, t }: ProjectTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuId = useId();
  const receiptsSelected = activeTab === "documents" && searchParams.get("section") === RECEIPTS_TAB_KEY;
  const activeKey: ProjectNavKey = receiptsSelected ? RECEIPTS_TAB_KEY : activeTab;

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

  const items: ProjectNavItem[] = PROJECT_WORKSPACE_TABS.flatMap((tab) => {
    const item: ProjectNavItem = { key: tab.key, label: t(tab.labelKey), icon: tabIcon[tab.key] };
    if (tab.key !== "documents") return [item];
    return [item, { key: RECEIPTS_TAB_KEY, label: "Receipts", icon: <ReceiptText size={16} aria-hidden="true" /> }];
  });

  const primaryItems = PRIMARY_TABS.map((key) => items.find((item) => item.key === key)).filter(Boolean) as ProjectNavItem[];
  const secondaryItems = items.filter((item) => !PRIMARY_TABS.includes(item.key));
  const secondaryActiveItem = secondaryItems.find((item) => item.key === activeKey) || null;

  useEffect(() => {
    if (!moreOpen) return;

    const closeMenu = (event?: Event) => {
      const target = event?.target;
      if (target instanceof Node && (moreButtonRef.current?.contains(target) || (target instanceof Element && target.closest("[data-project-more-menu]")))) return;
      setMoreOpen(false);
      setMenuPosition(null);
    };
    const closeOnViewportChange = () => closeMenu();

    document.addEventListener("pointerdown", closeMenu);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMoreOpen(false);
      setMenuPosition(null);
      moreButtonRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [moreOpen]);

  const toggleMoreMenu = () => {
    if (moreOpen) {
      setMoreOpen(false);
      setMenuPosition(null);
      return;
    }

    const rect = moreButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 224;
    setMenuPosition({
      left: Math.min(window.innerWidth - menuWidth - 16, Math.max(16, rect.right - menuWidth)),
      top: rect.bottom + 8,
    });
    setMoreOpen(true);
  };

  const handleChange = (key: ProjectNavKey) => {
    setMoreOpen(false);

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
      className="relative min-w-0 max-w-full rounded-[18px] border border-[var(--workspace-tabs-border)] [background:var(--workspace-tabs-surface)] p-2 shadow-[0_14px_28px_-22px_rgba(3,7,18,0.72)]"
    >
      <nav className="flex min-w-0 items-center gap-1.5 overflow-visible" aria-label={t("projects.workspaceNavigationLabel")}>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {primaryItems.map((item) => {
            const active = item.key === activeKey;
            return (
              <button
              key={item.key}
              type="button"
              onClick={() => handleChange(item.key)}
              data-orion-action={`workspace-tab-${item.key}`}
              data-orion-role={`workspace tab: ${item.label}`}
              className={`group inline-flex shrink-0 items-center gap-2 rounded-[11px] border px-3 py-2 text-[0.8rem] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
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
        </div>

        <div className="relative ml-auto shrink-0">
          <button
            ref={moreButtonRef}
            type="button"
            onClick={toggleMoreMenu}
            data-orion-action="workspace-tab-more"
            data-orion-role="workspace tab menu: More"
            aria-expanded={moreOpen}
            aria-controls={moreMenuId}
            aria-haspopup="menu"
            className={`inline-flex items-center gap-2 rounded-[11px] border px-3 py-2 text-[0.8rem] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
              secondaryActiveItem
                ? "border-[var(--workspace-tab-active-border)] [background:var(--workspace-tab-active-surface)] text-white"
                : "border-transparent text-[var(--workspace-tab-idle-text)] hover:border-[var(--workspace-tab-idle-border-hover)] hover:bg-[var(--workspace-tab-idle-bg-hover)] hover:text-white"
            }`}
          >
            {secondaryActiveItem ? secondaryActiveItem.icon : <MoreHorizontal size={16} aria-hidden="true" />}
            <span>{secondaryActiveItem?.label || "More"}</span>
            <ChevronDown size={14} aria-hidden="true" className={moreOpen ? "rotate-180 transition" : "transition"} />
          </button>

        </div>
      </nav>
      {moreOpen && menuPosition ? createPortal(
        <div
          data-project-more-menu="true"
          id={moreMenuId}
          role="menu"
          className="fixed z-[2147483647] w-56 overflow-hidden rounded-[14px] border border-[var(--bos-border-light)] bg-white p-1.5 shadow-[0_22px_42px_-16px_rgba(2,6,17,0.55)]"
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          {secondaryItems.map((item) => {
            const active = item.key === activeKey;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleChange(item.key)}
                data-orion-action={`workspace-tab-${item.key}`}
                data-orion-role={`workspace tab: ${item.label}`}
                role="menuitem"
                className={`flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                    : "text-[var(--bos-text-strong-on-light)] hover:bg-[var(--color-neutral-50)]"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
