"use client";

import Image from "next/image";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MotionProvider } from "@/components/motion";
import { OrionCommandCenterOverlay } from "@/components/orion/command-center";
import { PersistentOrion } from "@/components/orion/persistent";
import { GlobalOrionVoiceProvider, OrionUnifiedVoiceProvider } from "@/components/orion/voice";
import { DepartmentNavigator, LayerManager, NavigationBreadcrumb } from "@/components/bangoflow";
import { LanguageSelector, ProfileMenu } from "@/components/ui";
import { AutomaticWritingEditor } from "@/components/ui/automatic-writing-editor";
import { GlobalSearch } from "@/components/search/global-search";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { useBodyScrollLock } from "@/components/ui/use-body-scroll-lock";
import { useI18n } from "@/lib/i18n/provider";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";
import type { AdaptiveBosModuleKey } from "@/lib/adaptive-bos/config";
import { ORION_SIDEBAR_NAVIGATION_GROUPS } from "@/lib/orion/navigation";
import { canAccessPath, getRoleHomePath, hasBosPermission, normalizeCompanyRole } from "@/lib/access-control/permissions";
import { shouldIgnoreGlobalShortcut } from "@/lib/ui/keyboard";

type AppShellProps = {
  children: ReactNode;
  userName: string | null;
  userEmail: string | null;
  companyName: string | null;
  role: string | null;
  orionEnabled: boolean;
  platformAdmin: boolean;
};

const NAV_MODULE_BY_KEY: Partial<Record<string, AdaptiveBosModuleKey>> = {
  dashboard: "dashboard",
  dispatch: "scheduling",
  schedule: "scheduling",
  projects: "projects",
  blueprints: "projects",
  estimates: "estimates",
  invoices: "finance",
  payroll: "payroll",
  changeOrders: "projects",
  laborRates: "finance",
  customers: "customers",
  materials: "materials",
  unitsOfMeasure: "materials",
  equipment: "equipment",
  vendors: "vendors",
  employees: "workforce",
  crew: "workforce",
};

const ADAPTIVE_TERM_BY_NAV_KEY: Partial<Record<string, string>> = {
  projects: "projects",
  estimates: "estimates",
  customers: "customers",
  materials: "materials",
  equipment: "equipment",
  vendors: "vendors",
};

function moduleForNavigation(key: string): AdaptiveBosModuleKey | null {
  return NAV_MODULE_BY_KEY[key] ?? null;
}

function moduleForPath(pathname: string | null): AdaptiveBosModuleKey | null {
  if (!pathname) return null;
  const match = ORION_SIDEBAR_NAVIGATION_GROUPS.flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0];
  return match ? moduleForNavigation(match.key) : null;
}

export function AppShell({ children, userName, userEmail, companyName, role, orionEnabled, platformAdmin }: AppShellProps) {
  const frame = (
    <AppShellFrame userName={userName} userEmail={userEmail} companyName={companyName} role={role} orionEnabled={orionEnabled} platformAdmin={platformAdmin}>
      {children}
    </AppShellFrame>
  );
  return <MotionProvider>{orionEnabled ? <GlobalOrionVoiceProvider><OrionUnifiedVoiceProvider>{frame}</OrionUnifiedVoiceProvider></GlobalOrionVoiceProvider> : frame}</MotionProvider>;
}

function AppShellFrame({ children, userName, userEmail, companyName, role, orionEnabled, platformAdmin }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);
  const [orionVisible, setOrionVisible] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const mobileHistoryRef = useRef<string[]>([]);
  const pullStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const pullEligibleRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);
  const mobileBackNavigationRef = useRef(false);
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const router = useRouter();
  const { t } = useI18n();
  const { hasModule, term } = useAdaptiveBos();
  const normalizedRole = normalizeCompanyRole(role);
  const homePath = getRoleHomePath(normalizedRole);

  useBodyScrollLock(mobileOpen);

  const visibleNavigationGroups = useMemo(() => {
    const groups = ORION_SIDEBAR_NAVIGATION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const moduleKey = moduleForNavigation(item.key);
        return canAccessPath(normalizedRole, item.href) && (!moduleKey || hasModule(moduleKey));
      }),
    })).filter((group) => group.items.length > 0);
    if (normalizedRole === "subcontractor") return [{ key: "partner", label: "Trade Partner", items: [{ key: "partnerHome", href: "/partner", icon: "◇" }] }, ...groups];
    if (normalizedRole === "customer") return [{ key: "customer", label: "Customer", items: [{ key: "customerPortal", href: "/customer-portal", icon: "◉" }] }];
    if (hasBosPermission(normalizedRole, "communications.view")) {
      const companyGroups = [...groups, { key: "communications", label: "Communications", items: [{ key: "tradePartnerMessages", href: "/trade-partner-messages", icon: "✉" }] }];
      return platformAdmin ? [...companyGroups, { key: "platform", label: "B.O.S. Platform", items: [{ key: "platformAdmin", href: "/platform-admin", icon: "◆" }] }] : companyGroups;
    }
    return platformAdmin ? [...groups, { key: "platform", label: "B.O.S. Platform", items: [{ key: "platformAdmin", href: "/platform-admin", icon: "◆" }] }] : groups;
  }, [hasModule, normalizedRole, platformAdmin]);

  useEffect(() => {
    if (!pathname) return;
    const previousPath = lastPathRef.current;
    if (!previousPath) {
      lastPathRef.current = pathname;
      return;
    }
    if (previousPath === pathname) return;
    if (mobileBackNavigationRef.current) {
      mobileBackNavigationRef.current = false;
      lastPathRef.current = pathname;
      return;
    }
    if (mobileHistoryRef.current[mobileHistoryRef.current.length - 1] !== previousPath) {
      mobileHistoryRef.current.push(previousPath);
      if (mobileHistoryRef.current.length > 24) mobileHistoryRef.current.shift();
    }
    lastPathRef.current = pathname;
  }, [pathname]);

  const handleMobileBack = () => {
    const previousPath = mobileHistoryRef.current.pop();
    if (previousPath && previousPath !== pathname) {
      mobileBackNavigationRef.current = true;
      router.push(previousPath);
      return;
    }
    router.push(homePath);
  };

  const refreshCurrentPage = () => {
    if (refreshing || typeof window === "undefined") return;
    setRefreshing(true);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      window.sessionStorage.setItem("bos-mobile-refresh-url", currentUrl);
      window.sessionStorage.setItem("bos-mobile-refresh-scroll-y", String(window.scrollY));
    } catch {
      // Refresh still works when session storage is unavailable.
    }
    window.setTimeout(() => window.location.reload(), 120);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedUrl = window.sessionStorage.getItem("bos-mobile-refresh-url");
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (savedUrl !== currentUrl) return;
      const savedScrollY = Number(window.sessionStorage.getItem("bos-mobile-refresh-scroll-y") || "0");
      window.sessionStorage.removeItem("bos-mobile-refresh-url");
      window.sessionStorage.removeItem("bos-mobile-refresh-scroll-y");
      if (Number.isFinite(savedScrollY) && savedScrollY > 0) {
        window.requestAnimationFrame(() => window.scrollTo({ top: savedScrollY, behavior: "auto" }));
      }
    } catch {
      // Scroll restoration is best-effort only.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const resetPull = () => {
      pullStartYRef.current = null;
      pullEligibleRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (window.innerWidth >= 1024 || mobileOpen || refreshing || window.scrollY > 1 || event.touches.length !== 1) {
        resetPull();
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [data-disable-pull-refresh]")) {
        resetPull();
        return;
      }
      pullStartYRef.current = event.touches[0].clientY;
      pullEligibleRef.current = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!pullEligibleRef.current || pullStartYRef.current === null || event.touches.length !== 1) return;
      const rawDistance = event.touches[0].clientY - pullStartYRef.current;
      if (rawDistance <= 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      const resistedDistance = Math.min(96, rawDistance * 0.55);
      pullDistanceRef.current = resistedDistance;
      setPullDistance(resistedDistance);
      if (rawDistance > 4 && event.cancelable) event.preventDefault();
    };

    const handleTouchEnd = () => {
      const shouldRefresh = pullEligibleRef.current && pullDistanceRef.current >= 68;
      resetPull();
      if (shouldRefresh) refreshCurrentPage();
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", resetPull, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", resetPull);
    };
  }, [mobileOpen, refreshing]);

  useEffect(() => { if (pathname && !canAccessPath(normalizedRole, pathname)) router.replace(homePath); }, [homePath, normalizedRole, pathname, router]);
  useEffect(() => {
    const moduleKey = moduleForPath(pathname);
    if (moduleKey && !hasModule(moduleKey)) router.replace(homePath);
  }, [hasModule, homePath, pathname, router]);
  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);
  useEffect(() => {
    if (!orionEnabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreGlobalShortcut(event)) return;
      if (event.key.toLowerCase() !== "k" || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault(); setCommandCenterOpen(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [orionEnabled]);

  const topNavigationItems = visibleNavigationGroups.flatMap((group) => group.items);
  const activeNavigationHref = topNavigationItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;
  const activeModule = moduleForPath(pathname);
  const routeAllowed = (!pathname || canAccessPath(normalizedRole, pathname)) && (!activeModule || hasModule(activeModule));

  return (
    <div className="min-h-screen bg-[var(--bos-bg-root)] text-[var(--bos-text-primary)] enterprise-shell">
      <AutomaticWritingEditor />
      {(pullDistance > 0 || refreshing) ? (
        <div
          data-bos-mobile-refresh-indicator="true"
          className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+10px)] z-[100] -translate-x-1/2 lg:hidden"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)]/95 px-3 py-2 text-xs font-bold text-[var(--bos-text-primary)] shadow-[var(--shadow-card)] backdrop-blur">
            <RefreshCw size={15} className={refreshing ? "animate-spin text-sky-300" : pullDistance >= 68 ? "rotate-180 text-emerald-300 transition-transform" : "text-sky-300 transition-transform"} aria-hidden="true" />
            <span>{refreshing ? "Refreshing…" : pullDistance >= 68 ? "Release to refresh" : "Pull to refresh"}</span>
          </div>
        </div>
      ) : null}
      {orionEnabled && orionVisible ? <PersistentOrion onOpenCommandCenter={() => setCommandCenterOpen(true)} onHide={() => { setCommandCenterOpen(false); setOrionVisible(false); }} /> : null}
      <div className="flex min-h-screen min-w-0">
        <LayerManager layer={mobileOpen ? "dialog" : "popover"}>
          <aside id="bangoos-sidebar" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen ? true : undefined} aria-label={mobileOpen ? t("common.openSidebar") : undefined} className={`fixed inset-y-0 left-0 z-[var(--z-popover)] flex min-h-0 w-72 flex-col overflow-hidden border-r border-[var(--bos-border-default)] bg-[var(--bos-bg-sidebar)] px-3 py-5 text-[var(--bos-text-primary)] shadow-[0_24px_50px_-24px_rgba(4,10,22,0.92)] transition-transform duration-300 [height:100dvh] lg:sticky lg:top-0 lg:h-screen lg:w-[184px] lg:[height:100dvh] lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="relative flex h-[132px] shrink-0 items-center justify-center">
              <Link href={homePath} className="flex h-full w-full items-center justify-center" onClick={() => setMobileOpen(false)} aria-label="B.O.S. home">
                <Image src="/branding/bos-operating-system-logo.png" alt="B.O.S. — Bango Operating System" width={720} height={672} priority sizes="(min-width: 1024px) 168px, 240px" className="h-full w-full object-contain" />
              </Link>
              <button type="button" aria-label={t("common.closeSidebar")} className="absolute right-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)}>×</button>
            </div>

            {orionEnabled ? <button type="button" onClick={() => { if (orionVisible) setCommandCenterOpen(false); setOrionVisible((current) => !current); }} className={`mb-1 inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[var(--radius-lg)] border px-3 text-xs font-bold shadow-[var(--shadow-small)] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] lg:hidden ${orionVisible ? "border-white/15 bg-white/5 text-[var(--bos-text-secondary)] hover:border-[var(--orion-cyan)]/60 hover:text-[var(--orion-cyan)]" : "border-[var(--orion-cyan)]/50 bg-[color-mix(in_srgb,var(--orion-cyan)_12%,transparent)] text-[var(--orion-cyan)] hover:border-[var(--orion-cyan)] hover:bg-[color-mix(in_srgb,var(--orion-cyan)_20%,transparent)]"}`} aria-label={orionVisible ? "Hide Orion" : "Activate Orion"} aria-pressed={orionVisible}>
              <span className={`h-2 w-2 rounded-full ${orionVisible ? "bg-[var(--color-success-500)] shadow-[0_0_8px_var(--color-success-500)]" : "bg-[var(--orion-cyan)] shadow-[0_0_8px_var(--orion-cyan)]"}`} aria-hidden="true" />{orionVisible ? "Hide Orion" : "Activate Orion"}
            </button> : null}

            <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
              <nav data-orion-scroll-region="sidebar" data-orion-scroll-label="Sidebar navigation" tabIndex={-1} className="h-full min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain touch-pan-y pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                {visibleNavigationGroups.map((group) => {
                  const isCollapsed = collapsedGroups[group.key] ?? false;
                  return <section key={group.key} className="space-y-2">
                    {group.key !== "dashboard" ? <button type="button" data-sidebar-section-finish="blue-chrome" className="group flex min-h-11 w-full items-center justify-between rounded-[14px] border px-3 py-3 text-left text-xs font-extrabold uppercase tracking-[0.18em] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071528]" onClick={() => setCollapsedGroups((current) => ({ ...current, [group.key]: !isCollapsed }))} aria-expanded={!isCollapsed}>
                      <span>{group.label}</span><span className="transition group-hover:text-white">{isCollapsed ? "+" : "−"}</span>
                    </button> : null}
                    {!isCollapsed ? <div className="space-y-1.5">{group.items.map((item) => <SidebarItem key={`${group.key}-${item.href}`} label={getNavigationLabel(item.key, t, term)} href={item.href} active={item.href === activeNavigationHref} onNavigate={() => setMobileOpen(false)} />)}</div> : null}
                  </section>;
                })}
              </nav>
            </div>
          </aside>
        </LayerManager>

        {mobileOpen ? <LayerManager layer="backdrop"><button type="button" aria-label={t("common.closeSidebar")} className="fixed inset-0 z-[var(--z-backdrop)] bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} /></LayerManager> : null}

        <div className="flex min-h-screen min-h-0 min-w-0 flex-1 flex-col">
          <LayerManager layer="header">
            <header data-bos-topbar="true" className="sticky top-0 z-20 border-b border-[var(--bos-border-subtle)] bg-[var(--bos-bg-panel)]/92 px-4 py-3.5 text-[var(--bos-text-primary)] backdrop-blur-sm sm:px-6 lg:px-8">
              <div className="bos-top-command-utility flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  {pathname && pathname !== homePath ? <button type="button" aria-label={t("common.back")} title={t("common.back")} onClick={handleMobileBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--bos-bg-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] lg:hidden"><ArrowLeft size={20} aria-hidden="true" /></button> : null}
                  <button type="button" aria-label={t("common.openSidebar")} aria-controls="bangoos-sidebar" aria-expanded={mobileOpen} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--bos-bg-hover)] lg:hidden" onClick={() => setMobileOpen(true)}><span className="text-lg">☰</span></button>
                  <button type="button" aria-label="Refresh current page" title="Refresh current page" data-bos-mobile-refresh-button="true" disabled={refreshing} onClick={refreshCurrentPage} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--bos-bg-hover)] disabled:opacity-60 lg:hidden"><RefreshCw size={19} className={refreshing ? "animate-spin" : ""} aria-hidden="true" /></button>
                  {isDashboard ? <p className="truncate text-sm font-medium uppercase tracking-[0.28em] text-[var(--bos-text-primary)] sm:text-base">Bango Operating System</p> : <div className="min-w-0 space-y-1.5">
                    <p className="truncate text-sm font-medium text-[var(--bos-text-secondary)]">{companyName || t("common.operationsWorkspace")}</p><NavigationBreadcrumb />
                    {!['subcontractor', 'customer'].includes(normalizedRole) ? <DepartmentNavigator t={t} /> : <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">{formatRole(normalizedRole)}</p>}
                  </div>}
                </div>
                <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
                  {orionEnabled ? <div className="hidden shrink-0 items-center gap-2 lg:flex">
                    {orionVisible ? <button type="button" onClick={() => setCommandCenterOpen(true)} aria-label="Open Orion" title="Open Orion" className="group inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] shadow-[var(--shadow-small)] transition hover:border-[var(--orion-cyan)]/70 hover:bg-[var(--bos-bg-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]">
                      <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[radial-gradient(circle_at_38%_34%,#f4fbff_0%,#8bdcff_12%,#2196ff_34%,#0b3b84_62%,#06162f_78%,transparent_79%)] shadow-[0_0_16px_rgba(51,179,255,0.7)] transition group-hover:shadow-[0_0_22px_rgba(51,179,255,0.9)]" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_4px_rgba(126,220,255,0.85)]" /></span>
                    </button> : null}
                    <button type="button" onClick={() => { if (orionVisible) setCommandCenterOpen(false); setOrionVisible((current) => !current); }} className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-lg)] border px-4 text-sm font-bold shadow-[var(--shadow-small)] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${orionVisible ? "border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-primary)] hover:border-[var(--orion-cyan)]/60 hover:bg-[var(--bos-bg-hover)]" : "border-[var(--orion-cyan)]/50 bg-[color-mix(in_srgb,var(--orion-cyan)_12%,transparent)] text-[var(--orion-cyan)] hover:border-[var(--orion-cyan)]"}`} aria-label={orionVisible ? "Hide Orion" : "Activate Orion"} aria-pressed={orionVisible}>
                      <span className={`h-2 w-2 rounded-full ${orionVisible ? "bg-[var(--color-success-500)] shadow-[0_0_8px_var(--color-success-500)]" : "bg-[var(--orion-cyan)] shadow-[0_0_8px_var(--orion-cyan)]"}`} aria-hidden="true" />{orionVisible ? "Hide Orion" : "Activate Orion"}
                    </button>
                  </div> : null}
                  {!['subcontractor', 'customer'].includes(normalizedRole) ? <div className="order-last w-full min-w-0 sm:order-none sm:min-w-[220px] sm:flex-1 md:flex-initial"><GlobalSearch placeholder={t("common.search")} /></div> : null}
                  <NotificationCenter /><LanguageSelector /><ProfileMenu userName={userName} userEmail={userEmail} companyName={companyName} showSettingsAction={canAccessPath(normalizedRole, "/settings")} />
                </div>
              </div>

              {!isDashboard && topNavigationItems.length > 0 ? <nav className="bos-top-command-nav" aria-label="Top Command navigation">
                <Link href={homePath} className="bos-top-command-brand" aria-label="B.O.S. Home"><span className="bos-top-command-brand-mark">B</span><span><strong className="block text-xs tracking-[0.22em]">B.O.S.</strong><small className="block text-[9px] text-[var(--bos-text-muted)]">{formatRole(normalizedRole).toUpperCase()}</small></span></Link>
                {topNavigationItems.map((item) => <Link key={`${item.key}-${item.href}`} href={item.href} className="bos-top-command-link" data-active={item.href === activeNavigationHref ? "true" : "false"}><span className="bos-top-command-link-icon" aria-hidden="true">{item.icon}</span><span>{getNavigationLabel(item.key, t, term)}</span></Link>)}
              </nav> : null}
            </header>
          </LayerManager>

          <main className={`min-h-0 min-w-0 flex-1 bg-[radial-gradient(circle_at_15%_0%,rgba(59,130,246,0.08),transparent_26%)] ${isDashboard ? "p-0" : "p-4 sm:p-6 lg:p-7"}`}>{routeAllowed ? children : <AccessRedirect role={normalizedRole} />}</main>
        </div>
      </div>

      {orionEnabled && orionVisible ? <OrionCommandCenterOverlay open={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} onHide={() => { setCommandCenterOpen(false); setOrionVisible(false); }} currentPath={pathname || homePath} /> : null}
    </div>
  );
}

function SidebarItem({ label, href, active, onNavigate }: { label: string; href: string; active: boolean; onNavigate: () => void; }) {
  const blueChromeDashboard = active && href === "/dashboard";
  return <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} data-sidebar-active-finish={blueChromeDashboard ? "blue-chrome" : undefined} className={`relative flex min-h-11 items-center rounded-[var(--radius-lg)] px-4 py-3 text-[15px] font-semibold leading-5 motion-nav transition-colors duration-200 ${active ? "bg-[rgba(82,130,210,0.12)] text-white before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[var(--orion-cyan)] before:shadow-[0_0_8px_rgba(52,183,255,0.55)]" : "text-[var(--bos-text-secondary)] hover:bg-[rgba(82,130,210,0.10)] hover:text-[var(--bos-text-primary)]"}`}><span className="truncate">{label}</span></Link>;
}

function AccessRedirect({ role }: { role: string }) {
  return <div className="mx-auto max-w-xl rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-6 shadow-[var(--shadow-card)]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bos-text-muted)]">B.O.S. ACCESS CONTROL</p><h1 className="mt-2 text-xl font-semibold">Opening your authorized workspace…</h1><p className="mt-2 text-sm text-[var(--bos-text-secondary)]">Your {formatRole(role)} account does not have permission to view this area.</p></div>;
}

function getNavigationLabel(key: string, t: (key: string) => string, term: (key: string, fallback?: string) => string) {
  if (key === "partnerHome") return "My Projects";
  if (key === "customerPortal") return "My Project";
  if (key === "tradePartnerMessages") return "Trade Partner Messages";
  if (key === "platformAdmin") return "Customer Administration";
  const adaptiveTerm = ADAPTIVE_TERM_BY_NAV_KEY[key];
  return adaptiveTerm ? term(adaptiveTerm, t(`navigation.${key}`)) : t(`navigation.${key}`);
}

function formatRole(role: string) { return role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
