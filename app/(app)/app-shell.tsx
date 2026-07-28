"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LanguageSelector, ProfileMenu, SearchBar } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

type AppShellProps = {
  children: ReactNode;
  userName: string | null;
  userEmail: string | null;
  companyName: string | null;
};

const navigationItems = [
  { key: "dashboard", href: "/dashboard", icon: "◉" },
  { key: "customers", href: "/customers", icon: "◌" },
  { key: "projects", href: "/projects", icon: "◍" },
  { key: "estimates", href: "/estimates", icon: "◎" },
  { key: "invoices", href: "/invoices", icon: "◐" },
  { key: "schedule", href: "/schedule", icon: "◑" },
  { key: "crew", href: "/team", icon: "◒" },
  { key: "settings", href: "/settings", icon: "◓" },
];

export function AppShell({ children, userName, userEmail, companyName }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_25%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200/80 bg-slate-950 px-5 py-6 text-slate-100 shadow-[0_30px_70px_-22px_rgba(15,23,42,0.8)] transition-transform duration-300 lg:static lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-lg font-semibold text-white">
              B
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-300">
                BangoOS
              </p>
              <p className="text-sm text-slate-400">{t("common.constructionOs")}</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1.5">
            {navigationItems.map((item) => (
              <SidebarItem
                key={item.key}
                label={t(`navigation.${item.key}`)}
                href={item.href}
                icon={item.icon}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-white">{t("common.projectPulse")}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {t("common.projectPulseDescription")}
            </p>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            aria-label={t("common.closeSidebar")}
            className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={t("common.openSidebar")}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 shadow-sm transition hover:bg-slate-100 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  <span className="text-lg">☰</span>
                </button>
                <div>
                  <p className="text-sm font-medium text-slate-500">{t("common.operationsWorkspace")}</p>
                  <h2 className="text-lg font-semibold text-slate-950">BangoOS</h2>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden min-w-[220px] md:block">
                  <SearchBar placeholder={t("common.search")} />
                </div>
                <LanguageSelector />
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
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

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
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
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
