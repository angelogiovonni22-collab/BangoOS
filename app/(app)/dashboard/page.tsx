"use client";

import Link from "next/link";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CloudSun,
  FileText,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DashboardLiveWeather } from "@/components/dashboard/DashboardLiveWeather";
import { ErrorState } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { useExecutiveDashboard } from "@/lib/dashboard/use-executive-dashboard";
import type { DashboardMetric } from "@/lib/dashboard/types";

function formatMetric(metric: DashboardMetric | undefined, localeTag: string) {
  if (!metric) return "—";
  if (metric.valueKind === "currency") {
    return new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(metric.value);
  }
  if (metric.valueKind === "score") return `${metric.value}/100`;
  return new Intl.NumberFormat(localeTag).format(metric.value);
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[16px] border border-[#dfe5ee] bg-white shadow-[0_6px_20px_rgba(31,51,82,0.07)] ${className}`}>
      {children}
    </section>
  );
}

function CardHeader({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <h2 className="truncate text-[15px] font-bold tracking-[-0.01em] text-[#111827]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function TinyPill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "amber" | "red" | "violet" }) {
  const toneClass = {
    blue: "bg-[#edf5ff] text-[#2563eb]",
    green: "bg-[#eafbf1] text-[#159447]",
    amber: "bg-[#fff5df] text-[#d97706]",
    red: "bg-[#fff0f1] text-[#dc3545]",
    violet: "bg-[#f4efff] text-[#7c3aed]",
  }[tone];
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${toneClass}`}>{children}</span>;
}

export default function DashboardPage() {
  const { locale } = useI18n();
  const { data, companyName, isLoading, errorMessage } = useExecutiveDashboard();
  const localeTag = locale === "es" ? "es-ES" : "en-US";

  const metricById = useMemo(() => new Map(data.metrics.map((metric) => [metric.id, metric])), [data.metrics]);
  const primaryProject = data.projectHealth.projects[0] ?? null;
  const averageHealth = data.projectHealth.projects.length
    ? Math.round(data.projectHealth.projects.reduce((sum, project) => sum + project.healthScore, 0) / data.projectHealth.projects.length)
    : 0;
  const activeProjects = metricById.get("active-projects");
  const employeesWorking = metricById.get("employees-working");
  const openEstimates = metricById.get("open-estimates");
  const openInvoices = metricById.get("open-invoices");
  const revenue = metricById.get("revenue-this-month");
  const healthMetric = metricById.get("health-score");
  const topPriorities = data.topPriorities.slice(0, 5);
  const scheduleItems = data.schedule.slice(0, 5);
  const activityItems = data.activities.slice(0, 5);
  const riskCount = data.riskSummary.critical + data.riskSummary.high + data.riskSummary.medium + data.riskSummary.low;
  const completion = Math.max(0, Math.min(100, averageHealth));
  const milestone = scheduleItems[0]?.title || scheduleItems[0]?.projectName || "No milestone scheduled";
  const projectTitle = primaryProject?.projectName || companyName || "B.O.S. Dashboard";
  const currentPhase = primaryProject?.currentPhase || "Pre-Construction";

  if (errorMessage) {
    return <ErrorState compact title="Dashboard unavailable" description={errorMessage} />;
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_55%,#f8fbff_100%)] px-4 pb-7 sm:px-5 lg:px-[22px]">
      <header className="relative mb-4 min-h-[124px] overflow-hidden rounded-b-[20px] border border-t-0 border-[#164477] bg-[linear-gradient(118deg,#06172d_0%,#0a2a50_56%,#0c3d70_100%)] px-5 py-5 text-white shadow-[0_18px_38px_-26px_rgba(4,25,51,0.8)] md:flex md:items-center md:justify-between md:px-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(28,132,255,0.34),transparent_26%),linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.035)_50%,transparent_100%)]" />
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-[#4ea7ff]/20" />
        <div className="relative min-w-0">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.28em] text-[#65b5ff]">Bango Operating System</p>
          <h1 className="mt-2 truncate text-[29px] font-bold tracking-[-0.03em] text-white">{projectTitle}</h1>
          <p className="mt-1 truncate text-[11px] font-semibold text-[#b8cce2]">
            {primaryProject ? `${currentPhase} · ${companyName || "B.O.S."}` : "Live company project intelligence"}
          </p>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2 md:mt-0">
          <Link href={primaryProject?.href || "/projects"} className="rounded-lg border border-[#d9e1eb] bg-white px-4 py-2 text-[11px] font-semibold text-[#1f3b64] shadow-sm hover:bg-[#f8fbff] lg:hidden">
            View Project
          </Link>
          <Link href="/operations" className="rounded-xl border border-[#60b0ff]/40 bg-[#1475ed] px-5 py-3 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(14,99,214,0.36)] hover:bg-[#2182f4]">
            + New
          </Link>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.93fr_0.92fr]">
        <section className="relative min-h-[362px] overflow-hidden rounded-[16px] border border-[#0c2b4d] bg-[linear-gradient(145deg,#06162c_0%,#08203d_56%,#0b3155_100%)] px-5 py-4 text-white shadow-[0_14px_34px_rgba(3,19,40,0.23)]">
          <div className="absolute -right-14 -top-20 h-52 w-52 rounded-full bg-[#0aa6ff]/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold text-white">Project Health</h2>
            <Link href={primaryProject?.href || "/projects"} className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-white/10">
              View Details
            </Link>
          </div>
          <div className="relative mt-4 grid grid-cols-[148px_1fr] items-center gap-5">
            <div className="mx-auto flex h-[136px] w-[136px] items-center justify-center rounded-full bg-[conic-gradient(#20cc74_var(--score),#1b3857_0)] p-[10px]" style={{ "--score": `${completion * 3.6}deg` } as CSSProperties}>
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#071a31]">
                <span className="text-[37px] font-bold leading-none text-white">{completion}</span>
                <span className="mt-1 text-[11px] text-slate-300">/100</span>
              </div>
            </div>
            <div className="grid gap-2">
              {[
                ["Schedule", data.projectHealth.behindScheduleCount ? "Attention" : "On Track", data.projectHealth.behindScheduleCount ? "amber" : "green"],
                ["Budget", primaryProject?.budgetStatusKey ? "On Track" : "Healthy", "green"],
                ["Quality", primaryProject ? "Good" : "Pending", "green"],
                ["Safety", riskCount ? "Attention" : "Clear", riskCount ? "amber" : "green"],
              ].map(([label, value, tone]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-slate-200">{label}</span>
                  <span className={`text-[11px] font-bold ${tone === "amber" ? "text-[#ffbf3f]" : "text-[#36dc82]"}`}>● {value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-4 gap-2 border-t border-white/10 pt-4">
            {[
              ["Complete", `${completion}%`, "text-[#38e18a]"],
              ["Active Projects", formatMetric(activeProjects, localeTag), "text-[#63a8ff]"],
              ["Health Score", formatMetric(healthMetric, localeTag), "text-[#d2f43a]"],
              ["Active Risks", String(riskCount), "text-[#ff6b73]"],
            ].map(([label, value, color]) => (
              <div key={label} className="text-center">
                <p className={`text-[17px] font-bold ${color}`}>{value}</p>
                <p className="mt-0.5 text-[9px] font-medium text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <Surface className="min-h-[362px]">
          <CardHeader title="Today's Priorities" action={<Link href="/operations" className="text-[10px] font-semibold text-[#2470e8]">View All</Link>} />
          <div className="px-5 pb-4">
            {isLoading ? <div className="h-52 animate-pulse rounded-xl bg-[#f1f4f8]" /> : topPriorities.length ? (
              <div className="divide-y divide-[#edf0f4]">
                {topPriorities.map((item, index) => {
                  const tones = ["red", "amber", "blue", "violet", "green"] as const;
                  const tone = tones[index % tones.length];
                  const iconClass = tone === "red" ? "bg-[#fff0f1] text-[#ef3d4f]" : tone === "amber" ? "bg-[#fff5df] text-[#e59400]" : tone === "violet" ? "bg-[#f4efff] text-[#7c3aed]" : tone === "green" ? "bg-[#eafbf1] text-[#13a05a]" : "bg-[#edf5ff] text-[#2470e8]";
                  return (
                    <Link key={item.id} href={item.actionHref || item.hrefFallback || "/operations"} className="flex items-start gap-3 py-2.5 first:pt-0">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}><AlertTriangle className="h-3.5 w-3.5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-[#192233]">{item.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[9.5px] text-[#7b8492]">{item.summary}</p>
                      </div>
                      <TinyPill tone={item.priority === "critical" ? "red" : item.priority === "high" ? "amber" : "blue"}>{item.priority}</TinyPill>
                    </Link>
                  );
                })}
              </div>
            ) : <div className="rounded-xl bg-[#f6f8fb] px-4 py-8 text-center text-[11px] text-[#7b8492]">No priority items need attention.</div>}
          </div>
        </Surface>

        <div className="grid min-h-[362px] grid-rows-2 gap-4">
          <Surface>
            <CardHeader title="Jobsite Weather" icon={<CloudSun className="h-4 w-4 text-[#f59e0b]" />} action={<span className="text-[9px] font-semibold text-[#2470e8]">Hourly</span>} />
            <DashboardLiveWeather projectId={primaryProject?.id ?? null} />
          </Surface>
          <Surface>
            <CardHeader title="Jobsite Photo" icon={<Camera className="h-4 w-4 text-[#2470e8]" />} action={<Link href={primaryProject?.href || "/projects"} className="text-[9px] font-semibold text-[#2470e8]">View All</Link>} />
            <div className="px-5 pb-4">
              <Link href={primaryProject?.href || "/projects"} className="flex min-h-[84px] items-center justify-center rounded-xl border border-dashed border-[#cdd7e4] bg-[linear-gradient(135deg,#f8fbff,#f1f5fa)] text-center">
                <div>
                  <Camera className="mx-auto h-5 w-5 text-[#8ba0b8]" />
                  <p className="mt-1.5 text-[10px] font-semibold text-[#53657b]">Latest jobsite photo</p>
                  <p className="mt-0.5 text-[8.5px] text-[#8a96a7]">Open the project to view field photos</p>
                </div>
              </Link>
            </div>
          </Surface>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.93fr_0.92fr]">
        <Surface className="min-h-[330px]">
          <CardHeader title="Project Progress / Schedule" icon={<CalendarDays className="h-4 w-4 text-[#2470e8]" />} action={<Link href="/schedule" className="text-[9px] font-semibold text-[#2470e8]">View Schedule</Link>} />
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between text-[10px] font-medium text-[#53657b]"><span>Current Phase: <strong className="text-[#2470e8]">{currentPhase}</strong></span><strong className="text-[#2470e8]">{completion}%</strong></div>
            <div className="mt-3 h-2 rounded-full bg-[#e8edf4]"><div className="h-2 rounded-full bg-[#2470e8]" style={{ width: `${completion}%` }} /></div>
            <div className="mt-7 grid grid-cols-5 gap-2 text-center">
              {["Pre-Con", "Mobilize", "Execution", "Finishes", "Closeout"].map((phase, index) => {
                const done = index === 0 || completion >= (index + 1) * 20;
                return <div key={phase}><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-bold ${done ? "border-[#25c76f] bg-[#25c76f] text-white" : index === 1 ? "border-[#2470e8] bg-[#2470e8] text-white" : "border-[#cad4e1] bg-white text-[#42526a]"}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</div><p className={`mt-2 text-[8.5px] font-medium ${done ? "text-[#16a357]" : "text-[#7b8492]"}`}>{phase}</p></div>;
              })}
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f6f8fb] p-4"><p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#8492a6]">Next Milestone</p><p className="mt-2 line-clamp-2 text-[11px] font-bold text-[#172033]">{milestone}</p><p className="mt-1 text-[9px] text-[#7c8797]">{scheduleItems[0]?.timeLabel || "Schedule is clear"}</p></div>
              <div className="rounded-xl bg-[#f6f8fb] p-4"><p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#8492a6]">Project Status</p><p className="mt-2 text-[11px] font-bold text-[#172033]">{primaryProject ? "Active" : "No active project"}</p><p className="mt-1 text-[9px] text-[#7c8797]">{formatMetric(activeProjects, localeTag)} active projects</p></div>
            </div>
          </div>
        </Surface>

        <Surface className="min-h-[330px]">
          <CardHeader title="Financial Snapshot" icon={<CircleDollarSign className="h-4 w-4 text-[#2470e8]" />} action={<Link href="/invoices" className="text-[9px] font-semibold text-[#2470e8]">View Financials</Link>} />
          <div className="px-5 pb-5">
            <div className="space-y-3 text-[10px]">
              {[ ["Active Projects", formatMetric(activeProjects, localeTag)], ["Open Estimates", formatMetric(openEstimates, localeTag)], ["Open Invoices", formatMetric(openInvoices, localeTag)], ["Revenue This Month", formatMetric(revenue, localeTag)] ].map(([label, value]) => <div key={label} className="flex items-center justify-between"><span className="text-[#66748a]">{label}</span><strong className="text-[#111827]">{value}</strong></div>)}
            </div>
            <div className="mt-4 border-t border-[#edf0f4] pt-4"><div className="flex items-center justify-between text-[11px]"><span className="font-semibold text-[#159447]">Company Health</span><strong className="text-[#159447]">{formatMetric(healthMetric, localeTag)}</strong></div></div>
            <div className="mt-5 h-[86px] rounded-xl bg-[linear-gradient(180deg,#f4f8ff,#ffffff)] px-3 pt-4">
              <svg viewBox="0 0 260 58" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.20"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs><path d="M0 47 C30 38 48 35 68 27 S101 35 119 24 S151 29 171 22 S207 29 227 20 S247 28 260 24 L260 58 L0 58 Z" fill="url(#chartFill)"/><path d="M0 47 C30 38 48 35 68 27 S101 35 119 24 S151 29 171 22 S207 29 227 20 S247 28 260 24" fill="none" stroke="#3b82f6" strokeWidth="2.2"/></svg>
            </div>
          </div>
        </Surface>

        <Surface className="min-h-[330px]">
          <CardHeader title="Field Activity" icon={<Users className="h-4 w-4 text-[#2470e8]" />} action={<Link href="/operations" className="text-[9px] font-semibold text-[#2470e8]">View All</Link>} />
          <div className="divide-y divide-[#edf0f4] px-5 pb-4">
            {[
              [<Users key="u" className="h-4 w-4" />, "Crew On Site", formatMetric(employeesWorking, localeTag), "blue"],
              [<Clock3 key="c" className="h-4 w-4" />, "Today's Schedule", String(scheduleItems.length), "blue"],
              [<FileText key="f" className="h-4 w-4" />, "Recent Updates", String(activityItems.length), "blue"],
              [<Camera key="ca" className="h-4 w-4" />, "Project Photos", "—", "green"],
              [<ShieldCheck key="s" className="h-4 w-4" />, "Active Risks", String(riskCount), "amber"],
              [<MessageSquare key="m" className="h-4 w-4" />, "Priority Items", String(data.topPriorities.length), "violet"],
            ].map(([icon, label, value, tone]) => {
              const toneClass = tone === "green" ? "bg-[#eafbf1] text-[#13a05a]" : tone === "amber" ? "bg-[#fff5df] text-[#e59400]" : tone === "violet" ? "bg-[#f4efff] text-[#7c3aed]" : "bg-[#edf5ff] text-[#2470e8]";
              return <div key={String(label)} className="flex items-center gap-3 py-3 first:pt-1"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</div><span className="flex-1 text-[10px] font-semibold text-[#253148]">{label}</span><span className="text-[10px] font-semibold text-[#5f6b7d]">{value}</span><ArrowRight className="h-3.5 w-3.5 text-[#9aa7b7]" /></div>;
            })}
          </div>
        </Surface>
      </div>

    </div>
  );
}
