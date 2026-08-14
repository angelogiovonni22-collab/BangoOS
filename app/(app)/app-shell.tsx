"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MotionProvider } from "@/components/motion";
import { OrionCommandCenterOverlay } from "@/components/orion/command-center";
import { PersistentOrion } from "@/components/orion/persistent";
import { GlobalOrionVoiceProvider, OrionUnifiedVoiceProvider } from "@/components/orion/voice";
import { DepartmentNavigator, LayerManager, NavigationBreadcrumb } from "@/components/bangoflow";
import { LanguageSelector, ProfileMenu } from "@/components/ui";
import { GlobalSearch } from "@/components/search/global-search";
import { useBodyScrollLock } from "@/components/ui/use-body-scroll-lock";
import { useI18n } from "@/lib/i18n/provider";
import { ORION_SIDEBAR_NAVIGATION_GROUPS } from "@/lib/orion/navigation";
import { shouldIgnoreGlobalShortcut } from "@/lib/ui/keyboard";

type AppShellProps = {
  children: ReactNode;
  userName: string | null;
  userEmail: string | null;
  companyName: string | null;
};

export function AppShell({ children, userName, userEmail, companyName }: AppShellProps) {
  return (
    <MotionProvider>
      <GlobalOrionVoiceProvider>
        <OrionUnifiedVoiceProvider>
          <AppShellFrame userName={userName} userEmail={userEmail} companyName={companyName}>
            {children}
          </AppShellFrame>
        </OrionUnifiedVoiceProvider>
      </GlobalOrionVoiceProvider>
    </MotionProvider>
  );
}

function AppShellFrame({ children, userName, userEmail, companyName }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const { t } = useI18n();

  useBodyScrollLock(mobileOpen);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreGlobalShortcut(event)) return;
      const isCommandKey = event.key.toLowerCase() === "k";
      if (!isCommandKey || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      setCommandCenterOpen(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const topNavigationItems = ORION_SIDEBAR_NAVIGATION_GROUPS.flatMap((group) => group.items);

  return (
    <div className="min-h-screen bg-[var(--bos-bg-root)] text-[var(--bos-text-primary)] enterprise-shell">
      <PersistentOrion />
      <div className="flex min-h-screen min-w-0">
        <LayerManager layer={mobileOpen ? "dialog" : "popover"}>
          <aside
            id="bangoos-sidebar"
            role={mobileOpen ? "dialog" : undefined}
            aria-modal={mobileOpen ? true : undefined}
            aria-label={mobileOpen ? t("common.openSidebar") : undefined}
            className={`fixed inset-y-0 left-0 z-[var(--z-popover)] flex min-h-0 w-72 flex-col overflow-hidden border-r border-[var(--bos-border-default)] bg-[var(--bos-bg-sidebar)] px-5 py-6 text-[var(--bos-text-primary)] shadow-[0_24px_50px_-24px_rgba(4,10,22,0.92)] transition-transform duration-300 [height:100dvh] lg:sticky lg:top-0 lg:h-screen lg:[height:100dvh] lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            <div className="shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2f5ec9] to-[#2d9ad4] text-lg font-semibold text-white shadow-lg shadow-blue-500/20">B</div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8ec3ff]">B.O.S.</p>
                  <p className="text-sm text-[var(--bos-text-muted)]">{t("common.constructionOs")}</p>
                </div>
              </div>
              <button type="button" aria-label={t("common.closeSidebar")} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)}>×</button>
            </div>

            <div className="mt-7 flex min-h-0 flex-1 flex-col overflow-hidden">
              <nav className="h-full min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain touch-pan-y pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                {ORION_SIDEBAR_NAVIGATION_GROUPS.map((group) => {
                  const isCollapsed = collapsedGroups[group.key] ?? false;
                  return (
                    <section key={group.key} className="space-y-2">
                      <button type="button" className="flex w-full items-center justify-between rounded-[var(--radius-lg)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--bos-text-muted)] transition hover:bg-[var(--bos-bg-hover)] hover:text-[var(--bos-text-primary)]" onClick={() => setCollapsedGroups((current) => ({ ...current, [group.key]: !isCollapsed }))} aria-expanded={!isCollapsed}>
                        <span>{group.label}</span><span>{isCollapsed ? "+" : "-"}</span>
                      </button>
                      {!isCollapsed ? (
                        <div className="space-y-1.5">
                          {group.items.map((item) => (
                            <SidebarItem key={item.key} label={t(`navigation.${item.key}`)} href={item.href} icon={item.icon} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} onNavigate={() => setMobileOpen(false)} />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </nav>
            </div>
          </aside>
        </LayerManager>

        {mobileOpen ? (
          <LayerManager layer="backdrop">
            <button type="button" aria-label={t("common.closeSidebar")} className="fixed inset-0 z-[var(--z-backdrop)] bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} />
          </LayerManager>
        ) : null}

        <div className="flex min-h-screen min-h-0 min-w-0 flex-1 flex-col">
          <LayerManager layer="header">
            <header data-bos-topbar="true" className="sticky top-0 z-20 border-b border-[var(--bos-border-subtle)] bg-[var(--bos-bg-panel)]/92 px-4 py-3.5 text-[var(--bos-text-primary)] backdrop-blur-sm sm:px-6 lg:px-8">
              <div className="bos-top-command-utility flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <button type="button" aria-label={t("common.openSidebar")} aria-controls="bangoos-sidebar" aria-expanded={mobileOpen} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--bos-bg-hover)] lg:hidden" onClick={() => setMobileOpen(true)}><span className="text-lg">☰</span></button>
                  <div className="min-w-0 space-y-1.5">
                    <p className="truncate text-sm font-medium text-[var(--bos-text-secondary)]">{companyName || t("common.operationsWorkspace")}</p>
                    <NavigationBreadcrumb />
                    <DepartmentNavigator t={t} />
                  </div>
                </div>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
                  <div className="hidden min-w-[220px] md:block"><GlobalSearch placeholder={t("common.search")} /></div>
                  <button type="button" className="hidden rounded-[var(--radius-md)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 py-2 text-sm font-semibold text-[var(--bos-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--bos-bg-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] md:inline-flex md:items-center md:gap-2" onClick={() => setCommandCenterOpen(true)} aria-label="Open Orion Command Center">
                    <span>Orion</span><span className="rounded border border-[var(--bos-border-subtle)] px-1.5 py-0.5 text-xs text-[var(--bos-text-secondary)]">Ctrl+K</span>
                  </button>
                  <LanguageSelector />
                  <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-primary)] transition hover:bg-[var(--bos-bg-hover)]" aria-label={t("common.notifications")}>🔔</button>
                  <ProfileMenu userName={userName} userEmail={userEmail} companyName={companyName} showSettingsAction />
                </div>
              </div>

              <nav className="bos-top-command-nav" aria-label="Top Command navigation">
                <Link href="/dashboard" className="bos-top-command-brand" aria-label="B.O.S. Dashboard">
                  <span className="bos-top-command-brand-mark">B</span>
                  <span><strong className="block text-xs tracking-[0.22em]">B.O.S.</strong><small className="block text-[9px] text-[var(--bos-text-muted)]">COMMAND WORKSPACE</small></span>
                </Link>
                {topNavigationItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link key={item.key} href={item.href} className="bos-top-command-link" data-active={active ? "true" : "false"}>
                      <span className="bos-top-command-link-icon" aria-hidden="true">{item.icon}</span>
                      <span>{t(`navigation.${item.key}`)}</span>
                    </Link>
                  );
                })}
              </nav>
            </header>
          </LayerManager>

          <main className="min-h-0 min-w-0 flex-1 bg-[radial-gradient(circle_at_15%_0%,rgba(59,130,246,0.08),transparent_26%)] p-4 sm:p-6 lg:p-7">{children}</main>
        </div>
      </div>

      <OrionCommandCenterOverlay open={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} currentPath={pathname || "/dashboard"} />
    </div>
  );
}

function SidebarItem({ label, href, icon, active, onNavigate }: { label: string; href: string; icon: string; active: boolean; onNavigate: () => void; }) {
  return (
    <Link href={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold motion-nav transition-colors duration-200 ${active ? "bg-[linear-gradient(135deg,rgba(56,116,227,0.42),rgba(40,72,140,0.62))] text-white shadow-[0_16px_26px_-18px_rgba(37,99,235,0.55)]" : "text-[var(--bos-text-secondary)] hover:bg-[rgba(82,130,210,0.16)] hover:text-[var(--bos-text-primary)]"}`}>
      <span className="text-base">{icon}</span><span>{label}</span>
    </Link>
  );
}
