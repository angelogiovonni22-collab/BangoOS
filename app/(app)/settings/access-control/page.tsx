"use client";

import { useEffect, useMemo, useState } from "react";
import { COMPANY_ROLES, isOrionConfigurableRole, type BosPermission } from "@/lib/access-control/permissions";
import { Button } from "@/components/ui";

type Membership = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  is_primary: boolean;
  department: string | null;
  vendor_id: string | null;
  customer_id: string | null;
  permission_overrides: Partial<Record<BosPermission, boolean>> | null;
};
type Profile = { id: string; first_name: string | null; last_name: string | null };
type Vendor = { id: string; name: string };
type Customer = { id: string; first_name: string | null; last_name: string | null; company_name: string | null; customer_type: string | null };
type AccessPayload = { memberships: Membership[]; profiles: Profile[]; vendors: Vendor[]; customers: Customer[] };

type EditableMembership = Membership & { department: string; permission_overrides: Partial<Record<BosPermission, boolean>> };

const DEPARTMENTS = ["Executive", "Operations", "Project Management", "Estimating", "Field Operations", "Accounting", "Office", "Safety", "Equipment", "Trade Partner", "Customer"];
const OVERRIDE_PERMISSIONS: Array<{ key: BosPermission; label: string; sensitive?: boolean }> = [
  { key: "orion.use", label: "Orion AI & Voice", sensitive: true },
  { key: "dashboard.view", label: "Executive dashboard", sensitive: true },
  { key: "projects.view", label: "Projects" },
  { key: "projects.manage", label: "Manage projects" },
  { key: "project_financials.view", label: "Project financials", sensitive: true },
  { key: "schedule.view", label: "Schedule" },
  { key: "schedule.manage", label: "Manage schedule" },
  { key: "daily_reports.view", label: "Daily reports" },
  { key: "daily_reports.manage", label: "Create/edit daily reports" },
  { key: "blueprints.view", label: "Blueprints" },
  { key: "photos.view", label: "Photos" },
  { key: "photos.manage", label: "Upload photos" },
  { key: "communications.view", label: "Communication" },
  { key: "communications.manage", label: "Send communication" },
  { key: "scope.view", label: "Scope of work" },
  { key: "customers.view", label: "Customer directory", sensitive: true },
  { key: "estimates.view", label: "Estimates", sensitive: true },
  { key: "invoices.view", label: "Invoices", sensitive: true },
  { key: "change_orders.view", label: "Change orders", sensitive: true },
  { key: "labor_rates.view", label: "Labor rates", sensitive: true },
  { key: "workforce.view", label: "Employees and crews", sensitive: true },
  { key: "equipment.view", label: "Equipment" },
  { key: "vendors.view", label: "Vendors", sensitive: true },
  { key: "settings.view", label: "Settings", sensitive: true },
];

function toEditableMembership(member: Membership): EditableMembership {
  return {
    ...member,
    department: member.department || "",
    permission_overrides: member.permission_overrides || {},
  };
}

export default function AccessControlPage() {
  const [payload, setPayload] = useState<AccessPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<EditableMembership | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setMessage("");
    const response = await fetch("/api/settings/access-control", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error || "Unable to load access control."); return; }

    const nextPayload = body as AccessPayload;
    setPayload(nextPayload);
    const preferredId = selectedId || nextPayload.memberships[0]?.id || "";
    const selectedMember = nextPayload.memberships.find((item) => item.id === preferredId) ?? nextPayload.memberships[0] ?? null;
    setSelectedId(selectedMember?.id || "");
    setDraft(selectedMember ? toEditableMembership(selectedMember) : null);
  }

  const profileMap = useMemo(() => new Map((payload?.profiles ?? []).map((profile) => [profile.id, profile])), [payload]);

  function selectMember(member: Membership) {
    setSelectedId(member.id);
    setDraft(toEditableMembership(member));
    setMessage("");
  }

  function memberName(member: Membership) {
    const profile = profileMap.get(member.user_id);
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "B.O.S. User";
  }

  async function save() {
    if (!draft) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/settings/access-control", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: draft.id,
          role: draft.role,
          department: draft.department || null,
          vendorId: draft.vendor_id,
          customerId: draft.customer_id,
          permissionOverrides: draft.permission_overrides,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save permissions.");
      setMessage("Access updated. The user's next navigation or sign-in will use the new permissions.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save permissions.");
    } finally { setBusy(false); }
  }

  return (
    <div className="container-content space-y-5">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8ec3ff]">B.O.S. Security</p>
        <h1 className="mt-2 text-2xl font-semibold">Roles, Departments & Permissions</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--bos-text-secondary)]">Control what each person can see and do. Role defaults are enforced in the interface and sensitive database tables. Individual permission overrides can further tighten or expand a trusted internal user&apos;s access.</p>
      </section>

      {message ? <div role="status" className="rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] px-4 py-3 text-sm font-semibold">{message}</div> : null}

      {!payload ? <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-6">Loading access control…</div> : (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-3 shadow-[var(--shadow-small)]">
            <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--bos-text-muted)]">Company Members</p>
            <div className="space-y-1">
              {payload.memberships.map((member) => <button key={member.id} type="button" onClick={() => selectMember(member)} className={`w-full rounded-xl px-3 py-3 text-left transition ${selectedId === member.id ? "bg-blue-600 text-white" : "hover:bg-[var(--bos-bg-hover)]"}`}><span className="block text-sm font-semibold">{memberName(member)}</span><span className={`mt-1 block text-xs ${selectedId === member.id ? "text-blue-100" : "text-[var(--bos-text-muted)]"}`}>{formatLabel(member.role)}{member.department ? ` · ${member.department}` : ""}</span></button>)}
            </div>
          </aside>

          {draft ? <section className="space-y-5 rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
            <div><h2 className="text-xl font-semibold">{memberName(draft)}</h2><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">Status: {formatLabel(draft.status)}</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="B.O.S. Role"><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} className="h-11 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3">{COMPANY_ROLES.map((role) => <option key={role} value={role}>{formatLabel(role)}</option>)}</select></Field>
              <Field label="Department"><select value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })} className="h-11 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3"><option value="">Not assigned</option>{DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select></Field>
              {draft.role === "subcontractor" ? <Field label="Linked Trade Partner / Vendor" hint="Required for this login to see assigned Trade Partner work."><select value={draft.vendor_id || ""} onChange={(event) => setDraft({ ...draft, vendor_id: event.target.value || null })} className="h-11 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3"><option value="">Select vendor</option>{payload.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></Field> : null}
              {draft.role === "customer" ? <Field label="Linked Customer" hint="Required for this login to see projects assigned to the customer profile."><select value={draft.customer_id || ""} onChange={(event) => setDraft({ ...draft, customer_id: event.target.value || null })} className="h-11 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3"><option value="">Select customer</option>{payload.customers.map((customer) => <option key={customer.id} value={customer.id}>{customerLabel(customer)}</option>)}</select></Field> : null}
            </div>

            <div>
              <div className="flex items-end justify-between gap-3"><div><h3 className="font-semibold">Individual Overrides</h3><p className="mt-1 text-xs text-[var(--bos-text-muted)]">Orion is automatic for Owner/Administrator, opt-in for approved management roles, and unavailable to field employees, Trade Partners, and customers. Other permissions stay on Role Default unless this specific account needs an exception.</p></div></div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {OVERRIDE_PERMISSIONS.map((permission) => {
                  const current = draft.permission_overrides[permission.key];
                  const isOrion = permission.key === "orion.use";
                  const orionAutomatic = isOrion && (draft.role === "owner" || draft.role === "administrator");
                  const orionConfigurable = isOrion && isOrionConfigurableRole(draft.role);
                  return <div key={permission.key} className={`rounded-xl border p-3 ${permission.sensitive ? "border-amber-300/30" : "border-[var(--bos-border-subtle)]"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{permission.label}</p>{permission.sensitive ? <p className="text-[11px] text-amber-600">Sensitive</p> : null}</div>{orionAutomatic ? <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-2 text-xs font-semibold text-emerald-500">Always On</span> : isOrion && !orionConfigurable ? <span className="rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-2.5 py-2 text-xs font-semibold text-[var(--bos-text-muted)]">Not Available</span> : <select aria-label={`${permission.label} override`} value={current === true ? "allow" : current === false ? "deny" : "default"} onChange={(event) => { const next = { ...draft.permission_overrides }; if (event.target.value === "default") delete next[permission.key]; else next[permission.key] = event.target.value === "allow"; setDraft({ ...draft, permission_overrides: next }); }} className="h-9 rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-2 text-xs"><option value="default">Role Default</option><option value="allow">Allow</option><option value="deny">Deny</option></select>}</div></div>;
                })}
              </div>
            </div>

            <div className="flex justify-end"><Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save Access"}</Button></div>
          </section> : null}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="space-y-1.5"><span className="block text-xs font-bold uppercase tracking-[0.1em] text-[var(--bos-text-muted)]">{label}</span>{children}{hint ? <span className="block text-xs leading-5 text-[var(--bos-text-muted)]">{hint}</span> : null}</label>; }
function formatLabel(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function customerLabel(customer: Customer) { const contact = [customer.first_name, customer.last_name].filter(Boolean).join(" "); return customer.company_name || contact || "Unnamed Customer"; }
