"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CloudSun,
  FileText,
  MessageSquare,
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
    return new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(metric.value);
  }
  if (metric.valueKind === "score") return `${metric.value}/100`;
  return new Intl.NumberFormat(localeTag).format(metric.value);
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[18px] border border-[#d9e1eb] bg-white shadow-[0_8px_26px_rgba(31,51,82,0.08)] ${className}`}>
      {children}
    </section>
  );
}

function CardHeader({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        <h2 className="truncate text-[16px] font-bold tracking-[-0.01em] text-[#111827]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Pill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "amber" | "red" | "violet" }) {
  const tones = {
    blue: "bg-[#edf5ff] text-[#2563eb]",
    green: "bg-[#eafbf1] text-[#159447]",
    amber: "bg-[#fff5df] text-[#d97706]",
    red: "bg-[#fff0f1] text-[#dc3545]",
    violet: "bg-[#f4efff] text-[#7c3aed]",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export default function DashboardPage() {
  const { locale } = useI18n();
  const { data, companyName, isLoading, errorMessage } = useExecutiveDashboard();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(new Date()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
  const currentDate = now
    ? new Intl.DateTimeFormat(localeTag, { weekday: "short", month: "short", day: "numeric" }).format(now)
    : "";

  if (errorMessage) {
    return <ErrorState compact title="Dashboard unavailable" description={errorMessage} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1540px] overflow-x-hidden px-4 pb-8 pt-5 sm:px-5 lg:px-6">
      <header className="mb-5 flex flex-col gap-4 border-b border-[#e7ebf1] pb-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[28px] font-bold tracking-[-0.025em] text-[#111827] sm:text-[31px]">
              {primaryProject?.projectName || companyName || "B.O.S. Dashboard"}
            </h1>
            <Sparkles className="h-5 w-5 shrink-0 text-[#2167e8]" aria-hidden="true" />
          </div>
          <p className="mt-1 text-[13px] font-medium text-[#6b7280]">
            {primaryProject ? `Active project spotlight · ${companyName || "B.O.S."}` : "Live company command dashboard"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-[#d9e1eb] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#374151] shadow-sm">
            <CloudSun className="h-4 w-4 text-[#f59e0b]" />
            <span>{currentDate || "Today"}</span>
          </div>
          <Link href="/projects" className="rounded-xl border border-[#d9e1eb] bg-white px-4 py-2 text-[12px] font-semibold text-[#1f3b64] shadow-sm hover:bg-[#f8fbff]">
            View Projects
          </Link>
          <Link href="/operations" className="rounded-xl bg-[#1463df] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(20,99,223,0.22)] hover:bg-[#0f56c8]">
            + New
          </Link>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr_0.92fr]">
        <section className="relative overflow-hidden rounded-[18px] border border-[#0d2d52] bg-[linear-gradient(145deg,#06162c_0%,#08203d_55%,#0b3155_100%)] px-5 pb-5 pt-5 text-white shadow-[0_16px_38px_rgba(3,19,40,0.24)]">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#0aa6ff]/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-bold">Project Health</h2>
            <Link href={primaryProject?.href || "/projects"} className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10">
              View Details
            </Link>
          </div>
          <div className="relative mt-5 grid gap-5 sm:grid-cols-[150px_1fr] sm:items-center">
            <div className="mx-auto flex h-[142px] w-[142px] items-center justify-center rounded-full bg-[conic-gradient(#20cc74_var(--score),#1b3857_0)] p-[11px]" style={{ "--score": `${Math.max(0, Math.min(100, averageHealth)) * 3.6}deg` } as React.CSSProperties}>
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#071a31] shadow-inner">
                <span className="text-[39px] font-bold leading-none">{averageHealth}</span>
                <span className="mt-1 text-[12px] text-slate-300">/100</span>
              </div>
            </div>
            <div className="grid gap-2.5">
              {[
                ["Schedule", data.projectHealth.behindScheduleCount ? "Attention" : "On Track", data.projectHealth.behindScheduleCount ? "amber" : "green"],
                ["Budget", primaryProject?.budgetStatusKey ? "Healthy" : "Live", "green"],
                ["Quality", primaryProject ? "Good" : "Pending", "green"],
                ["Safety", riskCount ? "Attention" : "Clear", riskCount ? "amber" : "green"],
              ].map(([label, value, tone]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.055] px-3.5 py-2.5">
                  <span className="text-[12px] font-semibold text-slate-200">{label}</span>
                  <span className={`text-[12px] font-bold ${tone === "amber" ? "text-[#ffbf3f]" : "text-[#36dc82]"}`}>● {value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:grid-cols-4">
            {[
              ["Complete", `${averageHealth}%`, "text-[#38e18a]"],
              ["Active Projects", formatMetric(activeProjects, localeTag), "text-[#63a8ff]"],
              ["Health Score", formatMetric(healthMetric, localeTag), "text-[#d2f43a]"],
              ["Active Risks", String(riskCount), "text-[#ff6b73]"],
            ].map(([label, value, color]) => (
              <div key={label} className="text-center">
                <p className={`text-[18px] font-bold ${color}`}>{value}</p>
                <p className="mt-1 text-[10px] font-medium text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <Surface className="min-h-[365px]">
          <CardHeader title="Today's Priorities" action={<Link href="/operations" className="text-[11px] font-semibold text-[#2470e8]">View All</Link>} />
          <div className="px-5 pb-5">
            {isLoading ? <div className="h-56 animate-pulse rounded-xl bg-[#f1f4f8]" /> : topPriorities.length ? (
              <div className="divide-y divide-[#edf0f4]">
                {topPriorities.map((item, index) => {
                  const tones = ["red", "amber", "blue", "violet", "green"] as const;
                  const tone = tones[index % tones.length];
                  const iconClass = tone === "red" ? "bg-[#fff0f1] text-[#ef3d4f]" : tone === "amber" ? "bg-[#fff5df] text-[#e59400]" : tone === "violet" ? "bg-[#f4efff] text-[#7c3aed]" : tone === "green" ? "bg-[#eafbf1] text-[#13a05a]" : "bg-[#edf5ff] text-[#2470e8]";
                  return (
                    <Link key={item.id} href={item.actionHref || item.hrefFallback || "/operations"} className="flex items-start gap-3 py-3.5 first:pt-0">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}><AlertTriangle className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold text-[#192233]">{item.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[10.5px] text-[#7b8492]">{item.summary}</p>
                      </div>
                      <Pill tone={item.priority === "critical" ? "red" : item.priority === "high" ? "amber" : "blue"}>{item.priority}</Pill>
                    </Link>
                  );
                })}
              </div>
            ) : <div className="rounded-xl bg-[#f6f8fb] px-4 py-8 text-center text-[12px] text-[#7b8492]">No priority items need attention.</div>}
          </div>
        </Surface>

        <div className="grid gap-4">
          <Surface>
            <CardHeader title="Jobsite Weather" icon={<CloudSun className="h-4 w-4 text-[#f59e0b]" />} action={<span className="text-[10px] font-semibold text-[#2470e8]">Hourly</span>} />
            <div className="px-5 pb-5">
              {data.weather ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[37px] font-bold leading-none text-[#111827]">{data.weather.temperatureF}°</p>
                    <p className="mt-2 text-[12px] font-semibold text-[#4b5563]">{data.weather.location}</p>
                    <p className="mt-0.5 text-[10.5px] text-[#7b8492]">H {data.weather.highF}° · L {data.weather.lowF}°</p>
                  </div>
                  <CloudSun className="h-16 w-16 text-[#f3b51b]" strokeWidth={1.25} />
                </div>
              ) : (
                <div className="flex min-h-[105px] items-center justify-between rounded-xl bg-[linear-gradient(135deg,#f6f9ff,#eef6ff)] px-4">
                  <div>
                    <p className="text-[13px] font-bold text-[#1f3554]">Weather unavailable</p>
                    <p className="mt-1 max-w-[210px] text-[10.5px] leading-4 text-[#738097]">Live jobsite weather will appear here when a project location is available.</p>
                  </div>
                  <CloudSun className="h-12 w-12 text-[#4a8ff0]" strokeWidth={1.25} />
                </div>
              )}
            </div>
          </Surface>
          <Surface>
            <CardHeader title="Jobsite Photo" icon={<Camera className="h-4 w-4 text-[#2470e8]" />} action={<Link href={primaryProject?.href || "/projects"} className="text-[10px] font-semibold text-[#2470e8]">View All</Link>} />
            <div className="px-5 pb-5">
              <div className="flex min-h-[92px] items-center justify-center rounded-xl border border-dashed border-[#cdd7e4] bg-[linear-gradient(135deg,#f8fbff,#f1f5fa)] text-center">
                <div>
                  <Camera className="mx-auto h-6 w-6 text-[#8ba0b8]" />
                  <p className="mt-2 text-[11px] font-semibold text-[#53657b]">Latest jobsite photo</p>
                  <p className="mt-0.5 text-[10px] text-[#8a96a7]">Open the project to view field photos</p>
                </div>
              </div>
            </div>
          </Surface>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr_0.92fr]">
        <Surface className="min-h-[328px]">
          <CardHeader title="Project Progress / Schedule" icon={<CalendarDays className="h-4 w-4 text-[#2470e8]" />} action={<Link href="/schedule" className="text-[10px] font-semibold text-[#2470e8]">View Schedule</Link>} />
          <div className="px-5 pb-5">
            <div className="mb-5 flex items-center justify-between gap-3 text-[11px]">
              <span className="font-semibold text-[#53657b]">Current Phase: <strong className="text-[#2470e8]">{primaryProject?.currentPhase || "Not set"}</strong></span>
              <span className="font-bold text-[#2470e8]">{averageHealth}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#e9eef5]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#1767e8,#3197ff)]" style={{ width: `${Math.max(4, averageHealth)}%` }} /></div>
            <div className="mt-7 grid grid-cols-5 gap-2">
              {["Pre-Con", "Mobilize", "Execution", "Finishes", "Closeout"].map((phase, index) => {
                const completed = index < Math.max(1, Math.round((averageHealth / 100) * 5));
                return <div key={phase} className="text-center"><div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${completed ? "bg-[#21bd68] text-white" : "border border-[#cbd5e1] bg-white text-[#738097]"}`}>{completed ? "✓" : index + 1}</div><p className={`mt-2 text-[9.5px] font-semibold ${completed ? "text-[#1a9a58]" : "text-[#7b8492]"}`}>{phase}</p></div>;
              })}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[#f6f8fb] p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8792a2]">Next Milestone</p><p className="mt-2 text-[12px] font-bold text-[#26354a]">{scheduleItems[0]?.title || scheduleItems[0]?.titleKey || "No milestone scheduled"}</p><p className="mt-1 text-[10px] text-[#7b8492]">{scheduleItems[0]?.timeLabel || "Schedule is clear"}</p></div>
              <div className="rounded-xl bg-[#f6f8fb] p-3.5"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8792a2]">Project Status</p><p className="mt-2 text-[12px] font-bold text-[#26354a]">{primaryProject ? "Active" : "No active project"}</p><p className="mt-1 text-[10px] text-[#7b8492]">{data.projectHealth.onScheduleCount} on schedule</p></div>
            </div>
          </div>
        </Surface>

        <Surface className="min-h-[328px]">
          <CardHeader title="Financial Snapshot" icon={<CircleDollarSign className="h-4 w-4 text-[#2470e8]" />} action={<Link href="/invoices" className="text-[10px] font-semibold text-[#2470e8]">View Financials</Link>} />
          <div className="px-5 pb-5">
            <div className="space-y-3.5">
              {[
                ["Active Projects", formatMetric(activeProjects, localeTag)],
                ["Open Estimates", formatMetric(openEstimates, localeTag)],
                ["Open Invoices", formatMetric(openInvoices, localeTag)],
                ["Revenue This Month", formatMetric(revenue, localeTag)],
              ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4"><span className="text-[11px] font-medium text-[#697586]">{label}</span><span className="text-[12px] font-bold text-[#172033]">{value}</span></div>)}
            </div>
            <div className="my-4 border-t border-[#edf0f4]" />
            <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-[#179653]">Company Health</span><span className="text-[14px] font-bold text-[#179653]">{formatMetric(healthMetric, localeTag)}</span></div>
            <div className="mt-5 h-[72px] rounded-xl bg-[linear-gradient(180deg,#f3f8ff,#ffffff)] px-2 pt-2">
              <svg viewBox="0 0 320 70" className="h-full w-full" aria-label="Financial trend visualization">
                <path d="M8 56 C45 42 62 46 93 31 S145 46 176 27 S228 33 258 23 S292 37 312 29" fill="none" stroke="#2e7df0" strokeWidth="3" strokeLinecap="round" />
                <path d="M8 56 C45 42 62 46 93 31 S145 46 176 27 S228 33 258 23 S292 37 312 29 L312 70 L8 70 Z" fill="url(#fill)" opacity="0.35" />
                <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#66a9ff"/><stop offset="1" stopColor="#ffffff"/></linearGradient></defs>
              </svg>
            </div>
          </div>
        </Surface>

        <Surface className="min-h-[328px]">
          <CardHeader title="Field Activity" icon={<Users className="h-4 w-4 text-[#2470e8]" />} action={<Link href="/daily-reports" className="text-[10px] font-semibold text-[#2470e8]">View All</Link>} />
          <div className="px-5 pb-5">
            <div className="divide-y divide-[#edf0f4]">
              {[
                { icon: <Users className="h-4 w-4" />, label: "Crew On Site", value: formatMetric(employeesWorking, localeTag), tone: "bg-[#edf5ff] text-[#2470e8]" },
                { icon: <Clock3 className="h-4 w-4" />, label: "Today's Schedule", value: String(scheduleItems.length), tone: "bg-[#edf5ff] text-[#2470e8]" },
                { icon: <FileText className="h-4 w-4" />, label: "Recent Updates", value: String(activityItems.length), tone: "bg-[#eef8ff] text-[#2470e8]" },
                { icon: <Camera className="h-4 w-4" />, label: "Project Photos", value: primaryProject?.lastPhotoUpload || "—", tone: "bg-[#eafbf1] text-[#159447]" },
                { icon: <ShieldCheck className="h-4 w-4" />, label: "Active Risks", value: String(riskCount), tone: "bg-[#fff5df] text-[#d97706]" },
                { icon: <MessageSquare className="h-4 w-4" />, label: "Priority Items", value: String(data.topPriorities.length), tone: "bg-[#f4efff] text-[#7c3aed]" },
              ].map((row) => <div key={row.label} className="flex items-center gap-3 py-3 first:pt-0"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${row.tone}`}>{row.icon}</div><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-[#26354a]">{row.label}</p></div><span className="max-w-[110px] truncate text-[11px] font-bold text-[#53657b]">{row.value}</span><ArrowRight className="h-3.5 w-3.5 text-[#a2adbb]" /></div>)}
            </div>
          </div>
        </Surface>
      </div>

      <section className="relative mt-4 overflow-hidden rounded-[19px] border border-[#0e2b4b] bg-[linear-gradient(135deg,#061428_0%,#071b34_48%,#092b4c_100%)] px-5 py-5 text-white shadow-[0_18px_44px_rgba(3,17,38,0.22)]">
        <div className="absolute left-8 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full bg-[#1b72ff]/15 blur-2xl" />
        <div className="relative grid gap-5 lg:grid-cols-[150px_1fr] xl:grid-cols-[165px_1fr_1.15fr] xl:items-center">
          <div className="hidden xl:flex xl:justify-center">
            <div className="relative flex h-[118px] w-[118px] items-center justify-center rounded-full border border-[#2381ff]/40 bg-[radial-gradient(circle_at_35%_35%,#38bdf8_0%,#2147ff_28%,#6d28d9_48%,#08162d_72%)] shadow-[0_0_35px_rgba(32,110,255,0.5)]">
              <div className="absolute inset-3 rounded-full border border-white/20" />
              <Sparkles className="h-8 w-8 text-white/90" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h2 className="text-[16px] font-bold">Orion Project Intelligence</h2><Pill tone="blue">LIVE</Pill></div>
            <p className="mt-3 max-w-[620px] text-[12px] leading-5 text-slate-300">
              {data.morningBriefing.lines[0] || `${companyName || "B.O.S."} has ${formatMetric(activeProjects, localeTag)} active projects and ${data.topPriorities.length} priority items requiring attention.`}
            </p>
            <p className="mt-1.5 max-w-[620px] text-[12px] leading-5 text-slate-300">
              {data.morningBriefing.lines[1] || (primaryProject ? `${primaryProject.projectName} is currently the primary project spotlight with a health score of ${primaryProject.healthScore}.` : "Project intelligence will strengthen as more live project activity is recorded.")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-4">
            {[
              ["Schedule", data.projectHealth.behindScheduleCount ? "Attention" : "On Track", "text-[#31d97c]"],
              ["Business", formatMetric(healthMetric, localeTag), "text-[#31d97c]"],
              ["Risks", `${riskCount} Active`, riskCount ? "text-[#ff777f]" : "text-[#31d97c]"],
              ["Next Milestone", scheduleItems[0]?.timeLabel || "Clear", "text-[#dbeafe]"],
            ].map(([label, value, color]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className={`mt-1.5 text-[11px] font-bold ${color}`}>{value}</p></div>)}
          </div>
        </div>
        <div className="relative mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10.5px] text-slate-400">Live intelligence from B.O.S. project, financial, scheduling, field and decision data.</p>
          <button type="button" className="rounded-xl bg-[#1767e8] px-4 py-2.5 text-[11px] font-semibold text-white shadow-[0_8px_20px_rgba(23,103,232,0.28)]">Ask Orion Anything</button>
        </div>
      </section>
    </div>
  );
}
