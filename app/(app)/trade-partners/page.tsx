import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAdmin } from "@/lib/supabase/authorization";

type VendorRow = { id: string; display_name: string; company_name: string; status: string; preferred_vendor: boolean; first_name: string | null; last_name: string | null; email: string | null; phone: string | null };
type AssignmentRow = { id: string; project_id: string; vendor_id: string; trade_name: string; scope_of_work: string | null; assignment_status: string; contract_status: string; start_date: string | null; target_completion_date: string | null; mobilization_status: string; mobilization_blockers: unknown };
type MembershipRow = { id: string; user_id: string; vendor_id: string | null; role: string; status: string };
type ProfileRow = { id: string; first_name: string | null; last_name: string | null };
type ProjectRow = { id: string; name: string; status: string };
type RequirementRow = { assignment_id: string; status: string; required: boolean };

type QueryResult<T> = { data: T[] | null; error: { message: string } | null };
type UntypedDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string | boolean) => any;
      order: (column: string, options?: { ascending?: boolean }) => any;
    };
  };
};

export default async function TradePartnersControlCenterPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  let membership;
  try { membership = await requireCompanyAdmin(supabase); }
  catch { redirect("/app-entry"); }

  const companyId = membership.company_id;
  const db = supabase as unknown as UntypedDb;

  const [vendorsResponse, assignmentsResponse, membershipsResponse, profilesResponse, projectsResponse, requirementsResponse] = await Promise.all([
    db.from("vendors").select("id,display_name,company_name,status,preferred_vendor,first_name,last_name,email,phone").eq("company_id", companyId).order("display_name") as Promise<QueryResult<VendorRow>>,
    db.from("trade_partner_assignments").select("id,project_id,vendor_id,trade_name,scope_of_work,assignment_status,contract_status,start_date,target_completion_date,mobilization_status,mobilization_blockers").eq("company_id", companyId).order("created_at", { ascending: false }) as Promise<QueryResult<AssignmentRow>>,
    db.from("company_memberships").select("id,user_id,vendor_id,role,status").eq("company_id", companyId).eq("role", "subcontractor") as Promise<QueryResult<MembershipRow>>,
    db.from("profiles").select("id,first_name,last_name").eq("company_id", companyId) as Promise<QueryResult<ProfileRow>>,
    db.from("projects").select("id,name,status").eq("company_id", companyId) as Promise<QueryResult<ProjectRow>>,
    db.from("subcontractor_mobilization_requirements").select("assignment_id,status,required").eq("company_id", companyId) as Promise<QueryResult<RequirementRow>>,
  ]);

  const error = vendorsResponse.error || assignmentsResponse.error || membershipsResponse.error || profilesResponse.error || projectsResponse.error || requirementsResponse.error;
  if (error) return <LoadError message={error.message} />;

  const vendors = vendorsResponse.data ?? [];
  const assignments = assignmentsResponse.data ?? [];
  const partnerMemberships = membershipsResponse.data ?? [];
  const profiles = profilesResponse.data ?? [];
  const projects = projectsResponse.data ?? [];
  const requirements = requirementsResponse.data ?? [];

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const assignmentsByVendor = groupBy(assignments, (assignment) => assignment.vendor_id);
  const membershipsByVendor = groupBy(partnerMemberships.filter((item) => item.vendor_id), (item) => item.vendor_id as string);
  const requirementsByAssignment = groupBy(requirements, (requirement) => requirement.assignment_id);
  const partnerVendorIds = new Set(assignments.map((assignment) => assignment.vendor_id));
  partnerMemberships.forEach((member) => { if (member.vendor_id) partnerVendorIds.add(member.vendor_id); });
  const tradePartners = vendors.filter((vendor) => partnerVendorIds.has(vendor.id));

  const activeAssignments = assignments.filter((assignment) => assignment.assignment_status === "active");
  const linkedAccounts = partnerMemberships.filter((item) => item.status === "active" && item.vendor_id).length;
  const clearedAssignments = activeAssignments.filter((assignment) => assignment.mobilization_status === "cleared").length;
  const needsAttention = tradePartners.filter((vendor) => {
    const vendorAssignments = assignmentsByVendor.get(vendor.id) ?? [];
    const vendorMemberships = membershipsByVendor.get(vendor.id) ?? [];
    return vendorMemberships.every((item) => item.status !== "active") || vendorAssignments.some((assignment) => assignment.assignment_status === "active" && assignment.mobilization_status !== "cleared");
  }).length;

  return (
    <div className="container-content space-y-5">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8ec3ff]">B.O.S. Operations</p>
            <h1 className="mt-2 text-2xl font-semibold">Trade Partners Control Center</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--bos-text-secondary)]">Manage the connection between each trade partner, their restricted B.O.S. login, assigned projects, scope, agreement status, and mobilization readiness. Partner accounts continue to see only projects assigned to their linked vendor.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/vendors/new" className="inline-flex h-10 items-center rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-4 text-sm font-semibold transition hover:bg-[var(--bos-bg-hover)]">Add Trade Partner</Link>
            <Link href="/settings/access-control" className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500">Manage Partner Logins</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Trade Partners" value={tradePartners.length} detail="Assigned or portal-linked" />
        <Metric label="Active Assignments" value={activeAssignments.length} detail="Current project scopes" />
        <Metric label="Linked Logins" value={linkedAccounts} detail="Active subcontractor accounts" />
        <Metric label="Needs Attention" value={needsAttention} detail={`${clearedAssignments}/${activeAssignments.length} active assignments cleared`} emphasize={needsAttention > 0} />
      </section>

      {tradePartners.length === 0 ? <EmptyTradePartners /> : (
        <div className="space-y-4">
          {tradePartners.map((vendor) => {
            const vendorAssignments = assignmentsByVendor.get(vendor.id) ?? [];
            const activeVendorAssignments = vendorAssignments.filter((assignment) => assignment.assignment_status === "active");
            const activeVendorMemberships = (membershipsByVendor.get(vendor.id) ?? []).filter((item) => item.status === "active");
            const portalReady = activeVendorMemberships.length > 0 && activeVendorAssignments.length > 0;

            return (
              <article key={vendor.id} className="overflow-hidden rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] shadow-[var(--shadow-small)]">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--bos-border-subtle)] p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{vendor.display_name || vendor.company_name}</h2>
                      <StatusPill label={vendor.status} />
                      {vendor.preferred_vendor ? <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-500">Preferred</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{contactLabel(vendor)}</p>
                  </div>
                  <div className={`rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] ${portalReady ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-600" : "border-amber-400/30 bg-amber-500/10 text-amber-700"}`}>{portalReady ? "Portal Ready" : "Portal Setup Needed"}</div>
                </div>

                <div className="grid gap-5 p-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">Restricted B.O.S. Login</p>
                      {activeVendorMemberships.length ? activeVendorMemberships.map((partner) => {
                        const profile = profileMap.get(partner.user_id);
                        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Linked subcontractor";
                        return <div key={partner.id} className="mt-3"><p className="text-sm font-semibold">{name}</p><p className="mt-1 text-xs text-emerald-600">Active · linked to this vendor</p></div>;
                      }) : <div className="mt-3"><p className="text-sm font-semibold text-amber-700">No active partner login</p><p className="mt-1 text-xs text-[var(--bos-text-muted)]">Link a subcontractor membership to this vendor before field login testing.</p></div>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Link href={`/vendors/${vendor.id}`} className="rounded-lg border border-[var(--bos-border-default)] px-3 py-2 text-center text-xs font-semibold transition hover:bg-[var(--bos-bg-hover)]">Vendor Profile</Link>
                      <Link href="/settings/access-control" className="rounded-lg border border-[var(--bos-border-default)] px-3 py-2 text-center text-xs font-semibold transition hover:bg-[var(--bos-bg-hover)]">Login Access</Link>
                      <Link href="/trade-partner-messages" className="col-span-2 rounded-lg border border-[var(--bos-border-default)] px-3 py-2 text-center text-xs font-semibold transition hover:bg-[var(--bos-bg-hover)]">Trade Partner Messages</Link>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">Project Assignments</p>
                    <p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{activeVendorAssignments.length} active · {vendorAssignments.length} total</p>
                    {vendorAssignments.length === 0 ? <div className="mt-3 rounded-xl border border-dashed border-[var(--bos-border-default)] p-5 text-sm text-[var(--bos-text-secondary)]">No project assignment exists for this trade partner.</div> : (
                      <div className="mt-3 space-y-2">
                        {vendorAssignments.map((assignment) => {
                          const project = projectMap.get(assignment.project_id);
                          const assignmentRequirements = requirementsByAssignment.get(assignment.id) ?? [];
                          const openRequirements = assignmentRequirements.filter((item) => item.required && !["verified", "waived"].includes(item.status)).length;
                          return (
                            <div key={assignment.id} className="rounded-xl border border-[var(--bos-border-subtle)] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div><p className="text-sm font-semibold">{project?.name || "Project"}</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#6ea8e8]">{assignment.trade_name}</p></div>
                                <div className="flex flex-wrap gap-2"><StatusPill label={assignment.assignment_status} /><StatusPill label={assignment.contract_status} /><StatusPill label={assignment.mobilization_status} warning={assignment.mobilization_status !== "cleared"} /></div>
                              </div>
                              <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--bos-text-secondary)]">{assignment.scope_of_work || "Scope of work has not been entered."}</p>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--bos-text-muted)]"><span>{formatDateRange(assignment.start_date, assignment.target_completion_date)}</span><span>{openRequirements > 0 ? `${openRequirements} mobilization requirement${openRequirements === 1 ? "" : "s"} open` : "No open mobilization requirements"}</span></div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Link href={`/projects/${assignment.project_id}?tab=trade-partners`} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500">Manage Assignment</Link>
                                <Link href={`/partner/${assignment.project_id}`} className="rounded-lg border border-[var(--bos-border-default)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bos-bg-hover)]">Partner Workspace Route</Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoadError({ message }: { message: string }) { return <div className="container-content"><section className="rounded-2xl border border-red-300/40 bg-red-50 p-6 text-red-900"><p className="text-xs font-bold uppercase tracking-[0.18em]">B.O.S. Trade Partners</p><h1 className="mt-2 text-xl font-semibold">Unable to load the Trade Partners control center</h1><p className="mt-2 text-sm">{message}</p></section></div>; }
function EmptyTradePartners() { return <section className="rounded-2xl border border-dashed border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-8 text-center"><h2 className="text-lg font-semibold">No Trade Partners are connected yet</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--bos-text-secondary)]">Create or use an existing vendor, assign that company to a project as a trade partner, then link a subcontractor login to the same vendor in Access Control.</p><div className="mt-5 flex justify-center gap-2"><Link href="/vendors" className="rounded-lg border border-[var(--bos-border-default)] px-4 py-2 text-sm font-semibold">Open Vendors</Link><Link href="/settings/access-control" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Open Access Control</Link></div></section>; }
function Metric({ label, value, detail, emphasize = false }: { label: string; value: number; detail: string; emphasize?: boolean }) { return <div className={`rounded-2xl border bg-[var(--bos-bg-panel)] p-4 shadow-[var(--shadow-small)] ${emphasize ? "border-amber-400/40" : "border-[var(--bos-border-default)]"}`}><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">{detail}</p></div>; }
function StatusPill({ label, warning = false }: { label: string; warning?: boolean }) { return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${warning ? "border-amber-400/30 bg-amber-500/10 text-amber-700" : "border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-secondary)]"}`}>{formatLabel(label)}</span>; }
function groupBy<T>(items: T[], getKey: (item: T) => string) { const map = new Map<string, T[]>(); for (const item of items) { const key = getKey(item); map.set(key, [...(map.get(key) ?? []), item]); } return map; }
function contactLabel(vendor: VendorRow) { const name = [vendor.first_name, vendor.last_name].filter(Boolean).join(" "); return [name, vendor.email, vendor.phone].filter(Boolean).join(" · ") || "No primary contact entered"; }
function formatDateRange(start: string | null, end: string | null) { if (!start && !end) return "Schedule not published"; return `${formatDate(start)} → ${formatDate(end)}`; }
function formatDate(value: string | null) { if (!value) return "Open"; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date); }
function formatLabel(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
