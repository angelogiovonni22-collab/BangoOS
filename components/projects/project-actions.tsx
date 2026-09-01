"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  getButtonClassName,
  PortalHost,
  IconLink,
} from "@/components/ui";

export const PROJECT_HUB_SECTIONS = [
  "overview",
  "daily_reports",
  "scheduling",
  "employees",
  "crews",
  "equipment",
  "safety",
  "plans",
  "rfis",
  "submittals",
  "invoices",
  "estimates",
  "ai_insights",
] as const;

export type ProjectHubSection = (typeof PROJECT_HUB_SECTIONS)[number];

type ProjectActionsProps = {
  projectId: string;
  projectName: string;
  viewLabel: string;
  moreLabel: string;
};

const ACTION_MENU_WIDTH = 208;
const ACTION_MENU_HEIGHT = 132;
const ACTION_MENU_GAP = 8;
const VIEWPORT_PADDING = 12;

function getMenuPosition(rect: DOMRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - ACTION_MENU_WIDTH - VIEWPORT_PADDING);
  const left = Math.min(Math.max(VIEWPORT_PADDING, rect.right - ACTION_MENU_WIDTH), maxLeft);
  const belowTop = rect.bottom + ACTION_MENU_GAP;
  const top = belowTop + ACTION_MENU_HEIGHT <= viewportHeight - VIEWPORT_PADDING
    ? belowTop
    : Math.max(VIEWPORT_PADDING, rect.top - ACTION_MENU_HEIGHT - ACTION_MENU_GAP);

  return { left, top };
}

export function ProjectActions({ projectId, projectName, viewLabel, moreLabel }: ProjectActionsProps) {
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const closeMenu = () => setMenu(null);
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMenu();
      buttonRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [menu]);

  function toggleMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (menu) {
      setMenu(null);
      return;
    }

    buttonRef.current = event.currentTarget;
    setMenu(getMenuPosition(event.currentTarget.getBoundingClientRect()));
  }

  async function deleteProject() {
    setMenu(null);
    if (!window.confirm(`Delete ${projectName}? The project will be removed from the active Projects list, but its history will be preserved and it can be restored from Previously Deleted.`)) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/lifecycle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to delete project.");
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to delete project.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <IconLink href={`/projects/${projectId}`} icon={<Eye size={15} aria-hidden="true" />} label={viewLabel} variant="ghost" size="sm" />
        <button
          ref={buttonRef}
          type="button"
          className={`${getButtonClassName({ variant: "ghost", size: "icon" })} h-10 w-10`}
          disabled={busy}
          aria-label={moreLabel}
          aria-haspopup="menu"
          aria-expanded={Boolean(menu)}
          onClick={toggleMenu}
        >
          <MoreHorizontal size={15} aria-hidden="true" />
        </button>
      </div>

      {menu ? (
        <PortalHost>
          <div
            ref={menuRef}
            role="menu"
            aria-label={`${projectName} actions`}
            className="fixed z-[1000] w-52 overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-white p-1.5 text-left shadow-2xl"
            style={{ left: menu.left, top: menu.top }}
          >
            <MenuLink href={`/projects/${projectId}`} icon={<Eye size={14} />} onNavigate={() => setMenu(null)}>View Project</MenuLink>
            <MenuLink href={`/projects/${projectId}?edit=1`} icon={<Pencil size={14} />} onNavigate={() => setMenu(null)}>Edit Project</MenuLink>
            <div className="my-1 border-t border-[var(--color-border-subtle)]" />
            <MenuButton danger icon={<Trash2 size={14} />} onClick={() => void deleteProject()}>Delete Project</MenuButton>
          </div>
        </PortalHost>
      ) : null}
    </>
  );
}

function MenuLink({ href, icon, children, onNavigate }: { href: string; icon: ReactNode; children: ReactNode; onNavigate: () => void }) {
  return <Link href={href} role="menuitem" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{icon}<span>{children}</span></Link>;
}

function MenuButton({ icon, children, onClick, danger = false }: { icon: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" role="menuitem" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 ${danger ? "text-red-700" : "text-slate-700"}`}>{icon}<span>{children}</span></button>;
}
