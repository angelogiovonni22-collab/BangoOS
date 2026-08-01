"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MotionProvider, useMotionPreferences } from "@/components/motion";
import {
  CameraController,
  DepartmentNavigator,
  LayerManager,
  LiveHeader,
  ModuleTransition,
  NavigationBreadcrumb,
  ProjectEntranceTransition,
  SharedSurface,
  SpatialNavigationProvider,
  type WorkspaceIdentity,
  WorkspaceEnvironment,
  useSpatialNavigation,
} from "@/components/bangoflow";
import { LanguageSelector, ProfileMenu, SearchBar } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

type AppShellProps = {
  children: ReactNode;
  userName: string | null;
  userEmail: string | null;
  companyName: string | null;
};

const navigationGroups = [
  {
    key: "dashboard",
    label: "Dashboard",
    items: [{ key: "dashboard", href: "/dashboard", icon: "◉" }],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { key: "operations", href: "/operations", icon: "◈" },
      { key: "scheduling", href: "/scheduling", icon: "◧" },
      { key: "dailyReports", href: "/daily-reports", icon: "◨" },
      { key: "schedule", href: "/schedule", icon: "◑" },
      { key: "projects", href: "/projects", icon: "◍" },
    ],
  },
  {
    key: "financial",
    label: "Financial",
    items: [
      { key: "estimates", href: "/estimates", icon: "◎" },
      { key: "invoices", href: "/invoices", icon: "◐" },
      { key: "changeOrders", href: "/change-orders", icon: "◔" },
      { key: "laborRates", href: "/labor-rates", icon: "◈" },
    ],
  },
  {
    key: "resources",
    label: "Resources",
    items: [
      { key: "customers", href: "/customers", icon: "◌" },
      { key: "materials", href: "/materials", icon: "◉" },
      { key: "unitsOfMeasure", href: "/units-of-measure", icon: "◍" },
      { key: "equipment", href: "/equipment", icon: "◍" },
      { key: "vendors", href: "/vendors", icon: "◇" },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    items: [
      { key: "employees", href: "/employees", icon: "◒" },
      { key: "crew", href: "/crews", icon: "◒" },
      { key: "settings", href: "/settings", icon: "◓" },
    ],
  },
];

export function AppShell({ children, userName, userEmail, companyName }: AppShellProps) {
  return (
    <MotionProvider>
      <SpatialNavigationProvider>
        <AppShellFrame userName={userName} userEmail={userEmail} companyName={companyName}>
          {children}
        </AppShellFrame>
      </SpatialNavigationProvider>
    </MotionProvider>
  );
}

function AppShellFrame({ children, userName, userEmail, companyName }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [transitionDirection, setTransitionDirection] = useState<"initial" | "deeper" | "shallower" | "lateral">("initial");
  const previousRouteRef = useRef<ReturnType<typeof useSpatialNavigation> | null>(null);
  const pathname = usePathname();
  const { t } = useI18n();
  const { reducedMotion } = useMotionPreferences();
  const route = useSpatialNavigation();
  const workspace = resolveWorkspaceIdentity(route.moduleKey, pathname);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const previousRoute = previousRouteRef.current;

    if (!previousRoute) {
      previousRouteRef.current = route;
      return;
    }

    if (previousRoute.transitionKey === route.transitionKey) {
      previousRouteRef.current = route;
      return;
    }

    const previousDepth = getSurfaceDepth(previousRoute.surfaceKind);
    const nextDepth = getSurfaceDepth(route.surfaceKind);

    if (route.department !== previousRoute.department || route.moduleKey !== previousRoute.moduleKey) {
      setTransitionDirection("lateral");
    } else if (nextDepth > previousDepth) {
      setTransitionDirection("deeper");
    } else if (nextDepth < previousDepth) {
      setTransitionDirection("shallower");
    } else {
      setTransitionDirection("lateral");
    }

    previousRouteRef.current = route;
  }, [route]);

  return (
    <CameraController>
      <div className="bf-spatial-shell min-h-screen bg-[var(--color-surface-app)] text-[var(--color-text-primary)] enterprise-shell">
        <div className="flex min-h-screen">
          <LayerManager layer="dialog">
            <aside
          id="bangoos-sidebar"
          role={mobileOpen ? "dialog" : undefined}
          aria-modal={mobileOpen ? true : undefined}
          aria-label={mobileOpen ? t("common.openSidebar") : undefined}
          className={`fixed inset-y-0 left-0 flex w-72 flex-col border-r border-[#1e2b45] bg-[var(--color-sidebar)] px-5 py-6 text-white shadow-[0_24px_50px_-24px_rgba(15,23,42,0.85)] transition-transform duration-300 lg:static lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-lg font-semibold text-white shadow-lg shadow-blue-500/20">
                B
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-300">
                  BangoOS
                </p>
                <p className="text-sm text-slate-400">{t("common.constructionOs")}</p>
              </div>
            </div>

            <button
              type="button"
              aria-label={t("common.closeSidebar")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white/10 lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              ×
            </button>
          </div>

          <nav className="mt-7 space-y-3">
            {navigationGroups.map((group) => {
              const isCollapsed = collapsedGroups[group.key] ?? false;

              return (
                <section key={group.key} className="space-y-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[var(--radius-lg)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/5 hover:text-white"
                    onClick={() => setCollapsedGroups((current) => ({ ...current, [group.key]: !isCollapsed }))}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{group.label}</span>
                    <span>{isCollapsed ? "+" : "–"}</span>
                  </button>

                  {!isCollapsed ? (
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <SidebarItem
                          key={item.key}
                          label={t(`navigation.${item.key}`)}
                          href={item.href}
                          icon={item.icon}
                          active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                          onNavigate={() => setMobileOpen(false)}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[var(--radius-xl)] border border-white/10 bg-white/5 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-white">{t("common.projectPulse")}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {t("common.projectPulseDescription")}
            </p>
          </div>
            </aside>
          </LayerManager>

        {mobileOpen ? (
          <LayerManager layer="overlay">
            <button
              type="button"
              aria-label={t("common.closeSidebar")}
              className="fixed inset-0 bg-slate-950/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
          </LayerManager>
        ) : null}

        <div className="flex min-h-screen flex-1 flex-col">
          <LayerManager layer="header">
            <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]/95 px-4 py-3.5 backdrop-blur-sm sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={t("common.openSidebar")}
                  aria-controls="bangoos-sidebar"
                  aria-expanded={mobileOpen}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--color-surface-subtle)] lg:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  <span className="text-lg">☰</span>
                </button>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {companyName || t("common.operationsWorkspace")}
                  </p>
                  <NavigationBreadcrumb />
                  <DepartmentNavigator t={t} />
                  <LiveHeader
                    workspace={workspace}
                    moduleLabel={route.moduleLabel}
                    departmentLabel={route.departmentLabel}
                    phase={transitionDirection === "initial" ? "idle" : "navigation"}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden min-w-[220px] md:block">
                  <SearchBar placeholder={t("common.search")} />
                </div>
                <LanguageSelector />
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-subtle)]"
                  aria-label={t("common.notifications")}
                >
                  🔔
                </button>
                <ProfileMenu
                  userName={userName}
                  userEmail={userEmail}
                  companyName={companyName}
                  showSettingsAction
                />
              </div>
              </div>
            </header>
          </LayerManager>

          <main className="flex-1 p-5 sm:p-6 lg:p-6">
            <LayerManager layer="surface">
              <SharedSurface>
                <WorkspaceEnvironment workspace={workspace} routeKey={route.transitionKey}>
                  {route.surfaceKind === "workspace" ? (
                    <ProjectEntranceTransition>{children}</ProjectEntranceTransition>
                  ) : (
                    <ModuleTransition surfaceKind={route.surfaceKind === "mission-control" ? "mission-control" : "module"}>{children}</ModuleTransition>
                  )}
                </WorkspaceEnvironment>
              </SharedSurface>
            </LayerManager>
          </main>

          {process.env.NODE_ENV !== "production" ? (
            <div className="pointer-events-none fixed bottom-4 right-4 z-[80] rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[rgb(15_23_42_/_0.92)] px-3 py-2 text-xs font-semibold tracking-[0.02em] text-white shadow-[var(--shadow-large)]">
              <div>surface: {route.surfaceKind}</div>
              <div>department: {route.department}</div>
              <div>direction: {transitionDirection}</div>
              <div>reduced-motion: {reducedMotion ? "true" : "false"}</div>
            </div>
          ) : null}
        </div>
      </div>
      </div>
    </CameraController>
  );
}

function getSurfaceDepth(surfaceKind: ReturnType<typeof useSpatialNavigation>["surfaceKind"]) {
  if (surfaceKind === "mission-control") {
    return 0;
  }

  if (surfaceKind === "module") {
    return 1;
  }

  return 2;
}

function resolveWorkspaceIdentity(moduleKey: string, pathname: string): WorkspaceIdentity {
  if (moduleKey === "dashboard" || pathname === "/dashboard") {
    return "mission-control";
  }

  if (pathname.includes("sitecam")) {
    return "camera";
  }

  if (["projects", "operations", "scheduling", "daily-reports", "schedule"].includes(moduleKey)) {
    return "blueprint";
  }

  if (["estimates", "invoices", "change-orders", "labor-rates"].includes(moduleKey)) {
    return "executive";
  }

  if (moduleKey === "customers" || pathname.startsWith("/crm")) {
    return "relationship";
  }

  return "blueprint";
}

function SidebarItem({
  label,
  href,
  icon,
  active,
  onNavigate,
}: {
  label: string;
  href: string;
  icon: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold motion-nav transition-all duration-200 ${
        active
          ? "bg-[var(--color-brand-600)] text-white shadow-[0_16px_26px_-18px_rgba(37,99,235,0.75)]"
          : "text-slate-300 hover:-translate-y-px hover:bg-white/8 hover:text-white"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
