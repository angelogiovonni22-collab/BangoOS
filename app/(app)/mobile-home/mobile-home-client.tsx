"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  FolderKanban,
  Home,
  ListTodo,
  MessageCircle,
  MoreHorizontal,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { CompanyRole } from "@/lib/access-control/permissions";
import { getRoleHomePath, hasBosPermission } from "@/lib/access-control/permissions";
import type { DashboardActivityItem, DashboardMetric, ExecutiveDashboardData, ProjectHealthRow } from "@/lib/dashboard/types";

export type TradePartnerMobileJob = {
  assignment_id: string;
  project_id: string;
  project_name: string;
  project_status: string;
  trade_name: string;
  scope_of_work: string | null;
  assignment_status: string;
  contract_status: string;
};

type MobileHomeClientProps = {
  role: CompanyRole;
  userName: string;
  companyName: string;
  dashboardData: ExecutiveDashboardData | null;
  tradePartnerJobs: TradePartnerMobileJob[];
};

type OverviewCard = {
  label: string;
  value: string | number;
  status: string;
  tone: "blue" | "green" | "orange" | "purple";
  icon: ReactNode;
};

export function MobileHomeClient({ role, userName, companyName, dashboardData, tradePartnerJobs }: MobileHomeClientProps) {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const roleGroup = getRoleGroup(role);
  const currentDate = useMemo(
    () => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()),
    [],
  );

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      router.replace(getRoleHomePath(role));
      return;
    }

    const timer = window.setTimeout(() => setCheckingAccess(false), 950);
    return () => window.clearTimeout(timer);
  }, [role, router]);

  if (checkingAccess) {
    return <MobileSecurityCheck role={role} />;
  }

  const overviewCards = buildOverviewCards(roleGroup, dashboardData, tradePartnerJobs);
  const projects = dashboardData?.projectHealth.projects.slice(0, 4) ?? [];
  const activities = dashboardData?.activities.slice(0, 4) ?? [];

  return (
    <div className="bos-mobile-only bos-mobile-home">
      <header className="bos-mobile-home-header">
        <div>
          <p className="bos-mobile-wordmark" title={companyName}>B.O.S.</p>
          <p className="bos-mobile-greeting">Good Morning,</p>
          <h1>{firstName}</h1>
          <p className="bos-mobile-date">{currentDate}</p>
        </div>
        <div className="bos-mobile-header-actions">
          <Link href="/notifications" className="bos-mobile-icon-button" aria-label="Notifications"><Bell size={18} /></Link>
          <div className="bos-mobile-avatar" aria-label={`${userName} profile`}>{getInitials(userName)}</div>
        </div>
      </header>

      <section className="bos-mobile-section">
        <div className="bos-mobile-section-heading">
          <h2>Overview</h2>
          <Link href={getPrimaryViewAllHref(role)}>{getPrimaryViewAllLabel(role)}</Link>
        </div>
        <div className="bos-mobile-overview-grid">
          {overviewCards.map((card) => (
            <article key={card.label} className="bos-mobile-stat-card" data-tone={card.tone}>
              <div className="bos-mobile-stat-top"><span>{card.label}</span><span className="bos-mobile-stat-icon">{card.icon}</span></div>
              <div className="bos-mobile-stat-bottom"><strong>{card.value}</strong><small>{card.status}</small></div>
            </article>
          ))}
        </div>
      </section>

      {roleGroup === "owner" ? (
        <OwnerMobileBody dashboardData={dashboardData} projects={projects} activities={activities} />
      ) : roleGroup === "manager" ? (
        <ManagerMobileBody projects={projects} activities={activities} />
      ) : roleGroup === "employee" ? (
        <EmployeeMobileBody projects={projects} activities={activities} />
      ) : roleGroup === "subcontractor" ? (
        <TradePartnerMobileBody jobs={tradePartnerJobs} />
      ) : (
        <CustomerMobileBody />
      )}

      <MobileBottomNav role={role} />
    </div>
  );
}

function MobileSecurityCheck({ role }: { role: CompanyRole }) {
  return (
    <div className="bos-mobile-only bos-mobile-security-screen">
      <div className="bos-mobile-security-orb"><ShieldCheck size={58} strokeWidth={1.7} /></div>
      <h1>B.O.S. Security Check</h1>
      <div className="bos-mobile-security-list">
        <p><CheckCircle2 size={16} /> Verifying identity</p>
        <p><CheckCircle2 size={16} /> Loading user role</p>
        <p><CheckCircle2 size={16} /> Applying permissions</p>
        <p><CheckCircle2 size={16} /> Preparing workspace</p>
      </div>
      <div className="bos-mobile-security-role">{formatRole(role)}</div>
      <div className="bos-mobile-launch-track"><i className="is-loading" /></div>
    </div>
  );
}

function OwnerMobileBody({ dashboardData, projects, activities }: { dashboardData: ExecutiveDashboardData | null; projects: ProjectHealthRow[]; activities: DashboardActivityItem[] }) {
  const currencyMetrics = (dashboardData?.metrics ?? []).filter((metric) => metric.valueKind === "currency").slice(0, 4);
  return (
    <>
      <section className="bos-mobile-section">
        <div className="bos-mobile-section-heading"><h2>Financial Overview</h2><Link href="/invoices">This Month</Link></div>
        <div className="bos-mobile-finance-grid">
          {(currencyMetrics.length > 0 ? currencyMetrics : defaultCurrencyMetrics()).map((metric) => (
            <div key={metric.id} className="bos-mobile-finance-cell">
              <span>{metricTitle(metric)}</span>
              <strong>{formatCurrency(metric.value)}</strong>
              <small>+{Math.max(1, Math.round(Math.abs(metric.trendPercent ?? 8.7)))}%</small>
            </div>
          ))}
        </div>
      </section>
      <ProjectList title="Top Projects" projects={projects} />
      <ActivityList title="Recent Activity" activities={activities} />
    </>
  );
}

function ManagerMobileBody({ projects, activities }: { projects: ProjectHealthRow[]; activities: DashboardActivityItem[] }) {
  return (
    <>
      <ProjectList title="My Projects" projects={projects} />
      <ActivityList title="Team Activity" activities={activities} />
    </>
  );
}

function EmployeeMobileBody({ projects, activities }: { projects: ProjectHealthRow[]; activities: DashboardActivityItem[] }) {
  return (
    <>
      <section className="bos-mobile-section">
        <div className="bos-mobile-section-heading"><h2>My Tasks</h2><Link href="/crews/field">View all</Link></div>
        <div className="bos-mobile-list-card">
          {(activities.length > 0 ? activities.slice(0, 3) : fallbackTasks()).map((activity, index) => (
            <div key={typeof activity === "string" ? activity : activity.id} className="bos-mobile-task-row">
              <span className="bos-mobile-task-dot" data-tone={index === 0 ? "orange" : "blue"} />
              <div><strong>{typeof activity === "string" ? activity : activity.actionLabel || "Assigned field task"}</strong><small>{typeof activity === "string" ? "Assigned project" : activity.projectName || "B.O.S. Project"}</small></div>
              <em>{index === 0 ? "Due Today" : index === 1 ? "Due Today" : "Tomorrow"}</em>
            </div>
          ))}
        </div>
      </section>
      <section className="bos-mobile-section">
        <div className="bos-mobile-section-heading"><h2>Time Clock</h2></div>
        <div className="bos-mobile-time-card"><div><span className="bos-mobile-status-dot" /> <strong>Not Clocked In</strong></div><Link href="/crews/field">Clock In</Link></div>
      </section>
      {projects.length > 0 ? <ProjectList title="My Projects" projects={projects.slice(0, 2)} /> : null}
    </>
  );
}

function TradePartnerMobileBody({ jobs }: { jobs: TradePartnerMobileJob[] }) {
  const firstJob = jobs[0];
  return (
    <>
      <section className="bos-mobile-section">
        <div className="bos-mobile-section-heading"><h2>My Projects</h2><Link href="/partner">View all</Link></div>
        <div className="bos-mobile-list-card">
          {jobs.length === 0 ? <p className="bos-mobile-empty">No active assignments yet.</p> : jobs.slice(0, 3).map((job) => (
            <Link key={job.assignment_id} href={`/partner/${job.project_id}`} className="bos-mobile-partner-project">
              <strong>{job.project_name}</strong>
              <span>{job.trade_name}</span>
              <small>{formatLabel(job.project_status)}</small>
              <div className="bos-mobile-progress"><i style={{ width: getProjectProgress(job.project_status) }} /></div>
            </Link>
          ))}
        </div>
      </section>
      <section className="bos-mobile-section">
        <div className="bos-mobile-section-heading"><h2>Quick Actions</h2></div>
        <div className="bos-mobile-quick-actions">
          <Link href={firstJob ? `/partner/${firstJob.project_id}#photos` : "/partner"}><Camera size={21} /><span>Photos</span></Link>
          <Link href={firstJob ? `/partner/${firstJob.project_id}#plans` : "/partner"}><FileText size={21} /><span>Plans</span></Link>
          <Link href={firstJob ? `/partner/${firstJob.project_id}#messages` : "/partner"}><MessageCircle size={21} /><span>Messages</span></Link>
          <Link href={firstJob ? `/partner/${firstJob.project_id}` : "/partner"}><BriefcaseBusiness size={21} /><span>Files</span></Link>
        </div>
      </section>
      <section className="bos-mobile-section">
        <div className="bos-mobile-section-heading"><h2>Recent Updates</h2></div>
        <div className="bos-mobile-list-card">
          <UpdateRow icon={<FileText size={15} />} label="Plan update" time="2h ago" />
          <UpdateRow icon={<MessageCircle size={15} />} label="New message" time="4h ago" />
          <UpdateRow icon={<Camera size={15} />} label="Photo uploaded" time="1d ago" />
        </div>
      </section>
    </>
  );
}

function CustomerMobileBody() {
  return (
    <section className="bos-mobile-section">
      <div className="bos-mobile-section-heading"><h2>My Project</h2><Link href="/customer-portal">Open</Link></div>
      <div className="bos-mobile-list-card bos-mobile-customer-card">
        <ShieldCheck size={24} />
        <div><strong>Your project workspace is ready</strong><small>View approved project information, updates, photos, and communication.</small></div>
      </div>
    </section>
  );
}

function ProjectList({ title, projects }: { title: string; projects: ProjectHealthRow[] }) {
  return (
    <section className="bos-mobile-section">
      <div className="bos-mobile-section-heading"><h2>{title}</h2><Link href="/projects">View all</Link></div>
      <div className="bos-mobile-list-card">
        {projects.length === 0 ? <p className="bos-mobile-empty">No active projects to display.</p> : projects.map((project) => (
          <Link href={project.href} key={project.id} className="bos-mobile-project-row">
            <div><strong>{project.projectName}</strong><small>{project.currentPhase || "In Progress"}</small></div>
            <em>{project.healthScore}%</em>
            <div className="bos-mobile-progress"><i style={{ width: `${Math.max(8, Math.min(100, project.healthScore))}%` }} /></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ActivityList({ title, activities }: { title: string; activities: DashboardActivityItem[] }) {
  return (
    <section className="bos-mobile-section">
      <div className="bos-mobile-section-heading"><h2>{title}</h2><Link href="/timeline">View all</Link></div>
      <div className="bos-mobile-list-card">
        {activities.length === 0 ? (
          <>
            <UpdateRow icon={<CheckCircle2 size={15} />} label="Daily Log submitted" time="2m ago" />
            <UpdateRow icon={<CalendarDays size={15} />} label="Inspection scheduled" time="1h ago" />
            <UpdateRow icon={<MessageCircle size={15} />} label="New message received" time="2h ago" />
          </>
        ) : activities.map((activity) => (
          <UpdateRow key={activity.id} icon={<ActivityIcon category={activity.category} />} label={activity.actionLabel || "Project activity"} sublabel={activity.projectName} time={formatMinutesAgo(activity.timestampMinutesAgo)} href={activity.href} />
        ))}
      </div>
    </section>
  );
}

function UpdateRow({ icon, label, sublabel, time, href }: { icon: ReactNode; label: string; sublabel?: string; time: string; href?: string }) {
  const content = <><span className="bos-mobile-update-icon">{icon}</span><div><strong>{label}</strong>{sublabel ? <small>{sublabel}</small> : null}</div><em>{time}</em></>;
  return href ? <Link href={href} className="bos-mobile-update-row">{content}</Link> : <div className="bos-mobile-update-row">{content}</div>;
}

function MobileBottomNav({ role }: { role: CompanyRole }) {
  const items = getBottomNav(role);
  return (
    <nav className="bos-mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map(({ href, label, icon }) => (
        <Link key={`${href}-${label}`} href={href} className={label === "Home" ? "is-active" : ""}>{icon}<span>{label}</span></Link>
      ))}
    </nav>
  );
}

function getBottomNav(role: CompanyRole) {
  if (role === "subcontractor") return [
    { href: "/mobile-home", label: "Home", icon: <Home size={19} /> },
    { href: "/partner", label: "Projects", icon: <FolderKanban size={19} /> },
    { href: "/partner", label: "Messages", icon: <MessageCircle size={19} /> },
    { href: "/partner", label: "More", icon: <MoreHorizontal size={19} /> },
  ];
  if (role === "employee" || role === "foreman" || role === "superintendent") return [
    { href: "/mobile-home", label: "Home", icon: <Home size={19} /> },
    { href: "/crews/field", label: "Tasks", icon: <ListTodo size={19} /> },
    { href: "/crews/field", label: "Time", icon: <Clock3 size={19} /> },
    { href: "/projects", label: "Projects", icon: <FolderKanban size={19} /> },
    { href: getRoleHomePath(role), label: "More", icon: <MoreHorizontal size={19} /> },
  ];
  if (role === "customer") return [
    { href: "/mobile-home", label: "Home", icon: <Home size={19} /> },
    { href: "/customer-portal", label: "Project", icon: <FolderKanban size={19} /> },
    { href: "/customer-portal", label: "Messages", icon: <MessageCircle size={19} /> },
    { href: "/customer-portal", label: "More", icon: <MoreHorizontal size={19} /> },
  ];
  return [
    { href: "/mobile-home", label: "Home", icon: <Home size={19} /> },
    { href: "/projects", label: "Projects", icon: <FolderKanban size={19} /> },
    { href: "/operations", label: "Tasks", icon: <ListTodo size={19} /> },
    ...(hasBosPermission(role, "invoices.view") ? [{ href: "/invoices", label: "Finance", icon: <DollarSign size={19} /> }] : []),
    ...(hasBosPermission(role, "workforce.view") ? [{ href: "/employees", label: "People", icon: <Users size={19} /> }] : []),
    { href: getRoleHomePath(role), label: "More", icon: <MoreHorizontal size={19} /> },
  ].slice(0, 5);
}

function buildOverviewCards(roleGroup: ReturnType<typeof getRoleGroup>, data: ExecutiveDashboardData | null, jobs: TradePartnerMobileJob[]): OverviewCard[] {
  const projectCount = data?.projectHealth.projects.length ?? jobs.length;
  const taskCount = data?.topPriorities.length ?? 0;
  const messageCount = (data?.activities ?? []).filter((item) => item.category === "customer" || /message/i.test(item.actionLabel || "")).length;
  const approvalCount = data?.todaysDecisions.length ?? 0;

  if (roleGroup === "employee") return [
    { label: "My Jobs", value: projectCount, status: "Active", tone: "blue", icon: <FolderKanban size={16} /> },
    { label: "Tasks", value: taskCount, status: "Today", tone: "green", icon: <ListTodo size={16} /> },
    { label: "Messages", value: messageCount, status: "Unread", tone: "orange", icon: <MessageCircle size={16} /> },
    { label: "Time Clock", value: "—", status: "Clock In", tone: "blue", icon: <Clock3 size={16} /> },
  ];
  if (roleGroup === "subcontractor") return [
    { label: "Projects", value: jobs.length, status: "Assigned", tone: "blue", icon: <FolderKanban size={16} /> },
    { label: "Photos", value: "—", status: "Shared", tone: "green", icon: <Camera size={16} /> },
    { label: "Messages", value: "—", status: "Project", tone: "orange", icon: <MessageCircle size={16} /> },
    { label: "Plans", value: "—", status: "Approved", tone: "purple", icon: <FileText size={16} /> },
  ];
  if (roleGroup === "customer") return [
    { label: "Project", value: 1, status: "Active", tone: "blue", icon: <FolderKanban size={16} /> },
    { label: "Updates", value: "—", status: "Recent", tone: "green", icon: <CheckCircle2 size={16} /> },
    { label: "Messages", value: "—", status: "Project", tone: "orange", icon: <MessageCircle size={16} /> },
    { label: "Photos", value: "—", status: "Shared", tone: "purple", icon: <Camera size={16} /> },
  ];
  return [
    { label: "Projects", value: projectCount, status: "Active", tone: "blue", icon: <FolderKanban size={16} /> },
    { label: "Tasks", value: taskCount, status: "Open", tone: "green", icon: <ListTodo size={16} /> },
    { label: "Messages", value: messageCount, status: "Unread", tone: "orange", icon: <MessageCircle size={16} /> },
    { label: "Approvals", value: approvalCount, status: "Pending", tone: "green", icon: <CheckCircle2 size={16} /> },
  ];
}

function getRoleGroup(role: CompanyRole) {
  if (role === "owner" || role === "administrator" || role === "operations_manager" || role === "office_manager" || role === "accountant") return "owner" as const;
  if (role === "project_manager" || role === "estimator") return "manager" as const;
  if (role === "employee" || role === "foreman" || role === "superintendent") return "employee" as const;
  if (role === "subcontractor") return "subcontractor" as const;
  return "customer" as const;
}

function getPrimaryViewAllHref(role: CompanyRole) {
  if (role === "subcontractor") return "/partner";
  if (role === "customer") return "/customer-portal";
  if (role === "employee" || role === "foreman") return "/crews/field";
  return "/projects";
}
function getPrimaryViewAllLabel(role: CompanyRole) { return role === "subcontractor" ? "View jobs" : "View all"; }
function formatRole(role: CompanyRole) { return role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function getInitials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "B"; }
function formatLabel(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function getProjectProgress(status: string) { const value = status.toLowerCase(); if (value.includes("complete")) return "100%"; if (value.includes("progress") || value.includes("active")) return "65%"; if (value.includes("planning") || value.includes("scheduled")) return "28%"; return "12%"; }
function formatMinutesAgo(value: number) { if (value < 60) return `${Math.max(1, value)}m ago`; const hours = Math.floor(value / 60); if (hours < 24) return `${hours}h ago`; return `${Math.floor(hours / 24)}d ago`; }
function formatCurrency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function metricTitle(metric: DashboardMetric) { const id = metric.id.replace(/[-_]/g, " "); return id.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function defaultCurrencyMetrics(): DashboardMetric[] { return [
  { id: "Revenue", icon: "$", titleKey: "", value: 0, valueKind: "currency", href: "/invoices", tooltipKey: "", trendPercent: 12.3 },
  { id: "Profit", icon: "$", titleKey: "", value: 0, valueKind: "currency", href: "/projects", tooltipKey: "", trendPercent: 8.7 },
  { id: "Job Cost", icon: "$", titleKey: "", value: 0, valueKind: "currency", href: "/projects", tooltipKey: "", trendPercent: 5.2 },
  { id: "Cash Flow", icon: "$", titleKey: "", value: 0, valueKind: "currency", href: "/invoices", tooltipKey: "", trendPercent: 10.2 },
]; }
function fallbackTasks() { return ["Install Drywall", "Site Cleanup", "Material Delivery"]; }
function ActivityIcon({ category }: { category: DashboardActivityItem["category"] }) { if (category === "sitecam") return <Camera size={15} />; if (category === "project") return <FolderKanban size={15} />; if (category === "team") return <Users size={15} />; return <CheckCircle2 size={15} />; }
