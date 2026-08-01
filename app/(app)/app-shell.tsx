"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MotionProvider } from "@/components/motion";
import { DepartmentNavigator, LayerManager, NavigationBreadcrumb } from "@/components/bangoflow";
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
      <AppShellFrame userName={userName} userEmail={userEmail} companyName={companyName}>
        {children}
      </AppShellFrame>
    </MotionProvider>
  );
}

function AppShellFrame({ children, userName, userEmail, companyName }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const { t } = useI18n();

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

  return (
    <div className="min-h-screen bg-[var(--color-surface-app)] text-[var(--color-text-primary)] enterprise-shell">
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
                    <span>{isCollapsed ? "+" : "-"}</span>
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
            <header className="sticky top-0 z-20 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]/95 px-4 py-3.5 backdrop-blur-sm sm:px-6 lg:px-8">
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

          <main className="flex-1 p-4 sm:p-6 lg:p-7">{children}</main>
        </div>
      </div>
    </div>
  );
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
      className={`flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold motion-nav transition-colors duration-200 ${
        active
          ? "bg-[var(--color-brand-600)] text-white shadow-[0_16px_26px_-18px_rgba(37,99,235,0.75)]"
          : "text-slate-300 hover:bg-white/8 hover:text-white"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
