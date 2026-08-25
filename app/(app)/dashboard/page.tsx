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
  MapPin,
  MessageSquare,
  MoreVertical,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
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
      <header className="mb-4 flex min-h-[94px] flex-col justify-center gap-3 border-b border-[#e2e8f0] py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[27px] font-bold tracking-[-0.03em] text-[#111827]">{projectTitle}</h1>
            <Sparkles className="h-5 w-5 shrink-0 text-[#1769e0]" aria-hidden="true" />
          </div>
          <p className="mt-1 truncate text-[12px] font-medium text-[#64748b]">
            {primaryProject ? `${currentPhase} · ${companyName || "B.O.S."}` : "Live company project intelligence"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2 hidden items-center gap-2 xl:flex">
            <CloudSun className="h-9 w-9 text-[#f4b41b]" strokeWidth={1.4} />
            <div>
              <p className="text-[15px] font-bold leading-none text-[#172033]">{data.weather ? `${data.weather.temperatureF}°F` : "—"}</p>
              <p className="mt-1 text-[8px] font-medium text-[#69768a]">{data.weather?.location || "Weather unavailable"}</p>
            </div>
          </div>
          <Link href={primaryProject?.href || "/projects"} className="hidden items-center gap-2 rounded-xl border border-[#d9e1eb] bg-white px-4 py-3 text-[11px] font-semibold text-[#1f3b64] shadow-sm hover:bg-[#f8fbff] lg:flex">
            <MapPin className="h-4 w-4 text-[#1769e0]" /> View on Map
          </Link>
          <Link href={primaryProject?.href || "/projects"} className="rounded-lg border border-[#d9e1eb] bg-white px-4 py-2 text-[11px] font-semibold text-[#1f3b64] shadow-sm hover:bg-[#f8fbff] lg:hidden">
            View Project
          </Link>
          <Link href="/operations" className="rounded-xl bg-[#1463df] px-5 py-3 text-[11px] font-semibold text-white shadow-[0_7px_16px_rgba(20,99,223,0.22)] hover:bg-[#0f56c8]">
            + New
          </Link>
          <button type="button" aria-label="More dashboard actions" className="hidden h-10 w-10 items-center justify-center rounded-xl text-[#52647a] hover:bg-[#eef3f9] md:flex"><MoreVertical className="h-5 w-5" /></button>
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
            <div className="px-5 pb-4">
              {data.weather ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[34px] font-bold leading-none text-[#111827]">{data.weather.temperatureF}°</p>
                    <p className="mt-2 text-[10px] font-semibold text-[#4b5563]">{data.weather.location}</p>
                    <p className="mt-0.5 text-[9px] text-[#7b8492]">H {data.weather.highF}° · L {data.weather.lowF}°</p>
                  </div>
                  <CloudSun className="h-14 w-14 text-[#f3b51b]" strokeWidth={1.25} />
                </div>
              ) : (
                <div className="flex min-h-[92px] items-center justify-between rounded-xl bg-[linear-gradient(135deg,#f6f9ff,#eef6ff)] px-4">
                  <div>
                    <p className="text-[11px] font-bold text-[#1f3554]">Weather unavailable</p>
                    <p className="mt-1 max-w-[200px] text-[9px] leading-4 text-[#738097]">Live jobsite weather appears here when project location data is available.</p>
                  </div>
                  <CloudSun className="h-11 w-11 text-[#4a8ff0]" strokeWidth={1.25} />
                </div>
              )}
            </div>
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

      <section className="relative mt-4 overflow-hidden rounded-[16px] border border-[#0d2d52] bg-[linear-gradient(135deg,#06162b_0%,#071d37_55%,#09294a_100%)] px-5 py-5 text-white shadow-[0_16px_38px_rgba(3,19,40,0.22)]">
        <div className="absolute left-14 top-6 h-28 w-28 rounded-full bg-[#2b60ff]/20 blur-3xl" />
        <div className="relative grid items-center gap-5 lg:grid-cols-[130px_1.3fr_1fr]">
          <div className="mx-auto flex h-[112px] w-[112px] items-center justify-center rounded-full border border-[#235dff]/40 bg-[radial-gradient(circle_at_35%_30%,#32b9ff_0%,#3b5cff_34%,#5c2fd2_60%,#07182f_100%)] shadow-[0_0_35px_rgba(67,95,255,0.35)]"><Sparkles className="h-8 w-8 text-white" /></div>
          <div>
            <div className="flex items-center gap-2"><h2 className="text-[15px] font-bold text-white">Orion Project Intelligence</h2><TinyPill tone="blue">LIVE</TinyPill></div>
            <div className="mt-3 space-y-1.5 text-[10.5px] leading-5 text-slate-200">
              {topPriorities.length ? topPriorities.slice(0, 3).map((item) => <p key={item.id}>{item.title}.</p>) : <p>No priority issues require attention right now.</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {[
              ["Schedule", data.projectHealth.behindScheduleCount ? "Attention" : "On Track", data.projectHealth.behindScheduleCount ? "text-[#ffbf3f]" : "text-[#38e18a]"],
              ["Business", formatMetric(healthMetric, localeTag), "text-[#38e18a]"],
              ["Risks", `${riskCount} Active`, "text-[#ff6b73]"],
              ["Next Milestone", milestone, "text-white"],
            ].map(([label, value, color]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.045] p-3"><p className="text-[7.5px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p><p className={`mt-2 line-clamp-2 text-[10px] font-bold ${color}`}>{value}</p></div>)}
          </div>
        </div>
        <div className="relative mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-3"><p className="text-[8.5px] text-slate-400">Live intelligence from B.O.S. project, financial, scheduling, field and decision data.</p><Link href="/orion" className="rounded-lg bg-[#1463df] px-4 py-2 text-[10px] font-semibold text-white hover:bg-[#0f56c8]">Ask Orion Anything</Link></div>
      </section>
    </div>
  );
}
