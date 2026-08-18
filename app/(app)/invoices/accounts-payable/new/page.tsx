"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";

type VendorRow = { id: string; display_name: string | null; company_name: string | null };
type ProjectRow = { id: string; name: string | null; project_number: string | null };

type SelectBuilder = {
  select: (columns: string) => SelectBuilder;
  eq: (column: string, value: unknown) => SelectBuilder;
  then: PromiseLike<{ data: unknown; error: { message?: string } | null }>["then"];
};

type LooseClient = {
  from: (table: string) => SelectBuilder;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

const AP_WRITE_ROLES = new Set(["owner", "administrator", "operations_manager", "office_manager", "accountant"]);

export default function NewVendorBillPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        if (active) { setErrorMessage("Unable to connect to B.O.S. finance."); setIsLoading(false); }
        return;
      }

      const resolved = await resolveWorkspaceContext(supabase);
      if (!resolved.context) {
        if (active) { setErrorMessage(resolved.errorMessage || "Unable to load workspace."); setIsLoading(false); }
        return;
      }

      if (!AP_WRITE_ROLES.has((resolved.context.role || "").toLowerCase())) {
        if (active) { setErrorMessage("Your role can view invoices but cannot create vendor bills."); setIsLoading(false); }
        return;
      }

      const db = supabase as unknown as LooseClient;
      const [vendorResult, projectResult] = await Promise.all([
        db.from("vendors").select("id,display_name,company_name").eq("company_id", resolved.context.companyId),
        db.from("projects").select("id,name,project_number").eq("company_id", resolved.context.companyId),
      ]);

      if (!active) return;
      if (vendorResult.error || projectResult.error) {
        setErrorMessage(vendorResult.error?.message || projectResult.error?.message || "Unable to load bill options.");
        setIsLoading(false);
        return;
      }

      const nextVendors = (Array.isArray(vendorResult.data) ? vendorResult.data : []) as VendorRow[];
      const nextProjects = (Array.isArray(projectResult.data) ? projectResult.data : []) as ProjectRow[];
      nextVendors.sort((a, b) => (a.display_name || a.company_name || "").localeCompare(b.display_name || b.company_name || ""));
      nextProjects.sort((a, b) => (a.name || a.project_number || "").localeCompare(b.name || b.project_number || ""));
      setWorkspace(resolved.context);
      setVendors(nextVendors);
      setProjects(nextProjects);
      setIsLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !workspace) return;

    const numericAmount = Number(amount);
    if (!vendorId || !billNumber.trim() || !description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMessage("Vendor, bill number, line description, and a positive amount are required.");
      return;
    }
    if (dueDate && billDate && dueDate < billDate) {
      setErrorMessage("Due date cannot be before the bill date.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const db = supabase as unknown as LooseClient;
    const result = await db.rpc("create_vendor_bill_with_line", {
      p_company_id: workspace.companyId,
      p_vendor_id: vendorId,
      p_project_id: projectId || null,
      p_bill_number: billNumber.trim(),
      p_vendor_invoice_number: vendorInvoiceNumber.trim() || null,
      p_bill_date: billDate,
      p_due_date: dueDate || null,
      p_description: description.trim(),
      p_category: category,
      p_amount: numericAmount,
    });

    if (result.error) {
      setErrorMessage(result.error.message || "Unable to create vendor bill.");
      setIsSaving(false);
      return;
    }

    router.push("/invoices/accounts-payable");
    router.refresh();
  };

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader compact eyebrow="FINANCE · ACCOUNTS PAYABLE" title="New Vendor Bill" description="Create the bill header and first cost line atomically, with company-role authorization and database overpayment protections intact." />

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-6 shadow-[var(--shadow-card)]">
        {errorMessage ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{errorMessage}</div> : null}
        {isLoading ? <p className="text-sm text-[var(--bos-text-secondary)]">Loading finance options…</p> : workspace ? (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Vendor" required><select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="bos-input" required><option value="">Select vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.display_name || vendor.company_name || "Vendor"}</option>)}</select></Field>
              <Field label="Project"><select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="bos-input"><option value="">Company overhead / not project specific</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name || project.project_number || "Project"}</option>)}</select></Field>
              <Field label="B.O.S. Bill Number" required><input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className="bos-input" placeholder="AP-0001" required /></Field>
              <Field label="Vendor Invoice Number"><input value={vendorInvoiceNumber} onChange={(e) => setVendorInvoiceNumber(e.target.value)} className="bos-input" placeholder="Vendor invoice/reference" /></Field>
              <Field label="Bill Date" required><input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="bos-input" required /></Field>
              <Field label="Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bos-input" /></Field>
            </div>

            <div className="border-t border-[var(--bos-border-subtle)] pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">Initial cost line</p>
              <div className="mt-4 grid gap-5 md:grid-cols-[1.6fr_1fr_1fr]">
                <Field label="Description" required><input value={description} onChange={(e) => setDescription(e.target.value)} className="bos-input" placeholder="Material, subcontractor, equipment, service…" required /></Field>
                <Field label="Category"><select value={category} onChange={(e) => setCategory(e.target.value)} className="bos-input"><option value="materials">Materials</option><option value="subcontractor">Subcontractor</option><option value="equipment">Equipment</option><option value="rental">Rental</option><option value="permit">Permit</option><option value="professional_service">Professional service</option><option value="overhead">Overhead</option><option value="other">Other</option></select></Field>
                <Field label="Amount" required><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="bos-input" placeholder="0.00" required /></Field>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--bos-border-subtle)] pt-5">
              <Link href="/invoices/accounts-payable" className="inline-flex h-10 items-center rounded-lg border border-[var(--bos-border-default)] px-4 text-sm font-semibold hover:bg-[var(--bos-bg-hover)]">Cancel</Link>
              <Button type="submit" size="md" disabled={isSaving}>{isSaving ? "Saving…" : "Create Vendor Bill"}</Button>
            </div>
          </>
        ) : null}
      </form>
    </div>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="space-y-2"><span className="text-sm font-semibold text-[var(--bos-text-primary)]">{label}{required ? <span className="ml-1 text-red-400">*</span> : null}</span>{children}</label>;
}
