"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, PageHeader } from "@/components/ui";
import { loadAccountsPayableSnapshot, type AccountsPayableSnapshot } from "@/lib/finance/ap-prevailing-wage";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type BillRow = {
  id: string;
  vendor_id: string;
  project_id: string | null;
  bill_number: string;
  vendor_invoice_number: string | null;
  bill_date: string;
  due_date: string | null;
  status: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
};

type VendorRow = { id: string; display_name: string | null; company_name: string | null };
type ProjectRow = { id: string; name: string | null; project_number: string | null };

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  then: PromiseLike<{ data: unknown; error: { message?: string } | null }>["then"];
};

type LooseClient = { from: (table: string) => QueryBuilder };

const EMPTY_SNAPSHOT: AccountsPayableSnapshot = {
  totalOpenBills: 0,
  totalApproved: 0,
  totalPaid: 0,
  totalOutstanding: 0,
  overdueOutstanding: 0,
  billCount: 0,
  overdueBillCount: 0,
};

export default function AccountsPayablePage() {
  const supabase = useMemo(() => createClient(), []);
  const [snapshot, setSnapshot] = useState<AccountsPayableSnapshot>(EMPTY_SNAPSHOT);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setErrorMessage("Unable to connect to B.O.S. finance right now.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const workspace = await resolveWorkspaceContext(supabase);
    if (workspace.errorMessage || !workspace.context) {
      setErrorMessage(workspace.errorMessage || "Unable to load workspace.");
      setIsLoading(false);
      return;
    }

    try {
      const companyId = workspace.context.companyId;
      const db = supabase as unknown as LooseClient;
      const [nextSnapshot, billsResult, vendorsResult, projectsResult] = await Promise.all([
        loadAccountsPayableSnapshot({ supabase, companyId }),
        db.from("vendor_bills").select("id,vendor_id,project_id,bill_number,vendor_invoice_number,bill_date,due_date,status,total_amount,amount_paid,balance_due").eq("company_id", companyId),
        db.from("vendors").select("id,display_name,company_name").eq("company_id", companyId),
        db.from("projects").select("id,name,project_number").eq("company_id", companyId),
      ]);

      if (billsResult.error) throw new Error(billsResult.error.message || "Unable to load vendor bills.");
      if (vendorsResult.error) throw new Error(vendorsResult.error.message || "Unable to load vendors.");
      if (projectsResult.error) throw new Error(projectsResult.error.message || "Unable to load projects.");

      const nextBills = Array.isArray(billsResult.data) ? (billsResult.data as BillRow[]) : [];
      const vendors = Array.isArray(vendorsResult.data) ? (vendorsResult.data as VendorRow[]) : [];
      const projects = Array.isArray(projectsResult.data) ? (projectsResult.data as ProjectRow[]) : [];

      nextBills.sort((a, b) => String(b.bill_date || "").localeCompare(String(a.bill_date || "")));
      setSnapshot(nextSnapshot);
      setBills(nextBills);
      setVendorNames(Object.fromEntries(vendors.map((row) => [row.id, row.display_name || row.company_name || "Vendor"])));
      setProjectNames(Object.fromEntries(projects.map((row) => [row.id, row.name || row.project_number || "Project"])));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load accounts payable.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow="FINANCE · ACCOUNTS PAYABLE"
        title="Accounts Payable"
        description="Monitor vendor bills, approvals, payments, outstanding balances, and overdue exposure from one company-scoped command center."
        primaryAction={<Link href="/vendors"><Button size="md">View Vendors</Button></Link>}
      />

      {errorMessage ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{errorMessage}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Open Bills" value={currency(snapshot.totalOpenBills)} detail={`${snapshot.billCount} active records`} />
        <Metric label="Outstanding" value={currency(snapshot.totalOutstanding)} detail="Remaining vendor liability" />
        <Metric label="Overdue" value={currency(snapshot.overdueOutstanding)} detail={`${snapshot.overdueBillCount} overdue`} danger={snapshot.overdueOutstanding > 0} />
        <Metric label="Approved" value={currency(snapshot.totalApproved)} detail="Approved / paid bill value" />
        <Metric label="Paid" value={currency(snapshot.totalPaid)} detail="Payments recorded" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--bos-border-subtle)] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bos-text-muted)]">Vendor bill register</p>
            <h2 className="mt-1 text-lg font-semibold">Current AP activity</h2>
          </div>
          <Link href="/invoices/prevailing-wage" className="text-sm font-semibold text-blue-400 hover:text-blue-300">Prevailing Wage →</Link>
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-[var(--bos-text-secondary)]">Loading accounts payable…</p>
        ) : bills.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold">No vendor bills yet.</p>
            <p className="mt-1 text-sm text-[var(--bos-text-secondary)]">The AP foundation is active and ready for vendor bill entry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--bos-bg-control)] text-xs uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">
                <tr><th className="px-5 py-3">Bill</th><th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Project</th><th className="px-5 py-3">Due</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3 text-right">Balance</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--bos-border-subtle)]">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-[var(--bos-bg-hover)]">
                    <td className="px-5 py-4"><p className="font-semibold">{bill.bill_number}</p><p className="text-xs text-[var(--bos-text-muted)]">{bill.vendor_invoice_number || bill.bill_date}</p></td>
                    <td className="px-5 py-4">{vendorNames[bill.vendor_id] || "Vendor"}</td>
                    <td className="px-5 py-4">{bill.project_id ? projectNames[bill.project_id] || "Project" : "Company overhead"}</td>
                    <td className="px-5 py-4">{bill.due_date || "—"}</td>
                    <td className="px-5 py-4"><StatusPill status={bill.status} /></td>
                    <td className="px-5 py-4 text-right font-medium">{currency(bill.total_amount)}</td>
                    <td className="px-5 py-4 text-right font-semibold">{currency(bill.balance_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) {
  return <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--bos-text-muted)]">{label}</p><p className={`mt-2 text-2xl font-bold ${danger ? "text-red-400" : "text-[var(--bos-text-primary)]"}`}>{value}</p><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">{detail}</p></div>;
}

function StatusPill({ status }: { status: string }) {
  const normalized = (status || "draft").replaceAll("_", " ");
  return <span className="inline-flex rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-2.5 py-1 text-xs font-semibold capitalize">{normalized}</span>;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}
