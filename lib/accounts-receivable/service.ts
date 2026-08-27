import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type AccountsReceivableInvoice = {
  id: string;
  invoiceNumber: string;
  title: string;
  customerId: string | null;
  customerName: string;
  projectId: string | null;
  projectName: string;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  daysOutstanding: number;
  agingBucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
};

export type AccountsReceivableSummary = {
  totalReceivable: number;
  overdueReceivable: number;
  currentReceivable: number;
  collectedThisMonth: number;
  overdueCount: number;
  openInvoiceCount: number;
  aging: Record<AccountsReceivableInvoice["agingBucket"], number>;
};

type InvoiceSource = Pick<Database["public"]["Tables"]["invoices"]["Row"], "id" | "invoice_number" | "title" | "customer_id" | "project_id" | "status" | "issue_date" | "due_date" | "total_amount" | "amount_paid">;
type CustomerSource = Pick<Database["public"]["Tables"]["customers"]["Row"], "id" | "first_name" | "last_name" | "company_name" | "customer_type">;
type ProjectSource = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "name">;

function displayCustomer(customer: CustomerSource | undefined) {
  if (!customer) return "Not linked";
  const company = customer.company_name?.trim() || "";
  const person = [customer.first_name?.trim(), customer.last_name?.trim()].filter(Boolean).join(" ");
  return customer.customer_type?.toLowerCase() === "commercial" && company ? company : person || company || "Unnamed customer";
}

function dayDiff(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

function agingBucket(dueDate: string | null, now: Date): AccountsReceivableInvoice["agingBucket"] {
  if (!dueDate) return "current";
  const due = new Date(`${dueDate}T00:00:00`);
  if (due >= now) return "current";
  const days = dayDiff(due, now);
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export async function loadAccountsReceivable(supabase: SupabaseClient<Database>, companyId: string, now = new Date()) {
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [invoiceResult, customerResult, projectResult, paymentResult] = await Promise.all([
    supabase.from("invoices").select("id, invoice_number, title, customer_id, project_id, status, issue_date, due_date, total_amount, amount_paid").eq("company_id", companyId).is("archived_at", null).order("due_date", { ascending: true }),
    supabase.from("customers").select("id, first_name, last_name, company_name, customer_type").eq("company_id", companyId),
    supabase.from("projects").select("id, name").eq("company_id", companyId),
    supabase.from("invoice_payment_history").select("amount, payment_date, status").eq("company_id", companyId).eq("status", "recorded").gte("payment_date", monthStart),
  ]);

  const error = invoiceResult.error || customerResult.error || projectResult.error || paymentResult.error;
  if (error) return { data: null, error: error.message };

  const customers = new Map((customerResult.data ?? []).map((row) => [row.id, row as CustomerSource]));
  const projects = new Map((projectResult.data ?? []).map((row) => [row.id, row as ProjectSource]));
  const invoices: AccountsReceivableInvoice[] = ((invoiceResult.data ?? []) as InvoiceSource[])
    .filter((row) => !["draft", "paid", "void"].includes(row.status))
    .map((row) => {
      const balanceDue = Math.max(Number(row.total_amount || 0) - Number(row.amount_paid || 0), 0);
      const bucket = agingBucket(row.due_date, now);
      const issued = row.issue_date ? new Date(`${row.issue_date}T00:00:00`) : now;
      return {
        id: row.id,
        invoiceNumber: row.invoice_number || "Unassigned",
        title: row.title,
        customerId: row.customer_id,
        customerName: displayCustomer(row.customer_id ? customers.get(row.customer_id) : undefined),
        projectId: row.project_id,
        projectName: row.project_id ? projects.get(row.project_id)?.name || "Not linked" : "Not linked",
        status: bucket === "current" ? row.status : "overdue",
        issueDate: row.issue_date,
        dueDate: row.due_date,
        totalAmount: Number(row.total_amount || 0),
        amountPaid: Number(row.amount_paid || 0),
        balanceDue,
        daysOutstanding: dayDiff(issued, now),
        agingBucket: bucket,
      };
    })
    .filter((row) => row.balanceDue > 0);

  const aging: AccountsReceivableSummary["aging"] = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const invoice of invoices) aging[invoice.agingBucket] += invoice.balanceDue;
  const totalReceivable = invoices.reduce((sum, row) => sum + row.balanceDue, 0);
  const currentReceivable = aging.current;
  const overdueReceivable = totalReceivable - currentReceivable;
  const collectedThisMonth = (paymentResult.data ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const summary: AccountsReceivableSummary = { totalReceivable, overdueReceivable, currentReceivable, collectedThisMonth, overdueCount: invoices.filter((row) => row.agingBucket !== "current").length, openInvoiceCount: invoices.length, aging };
  return { data: { invoices, summary }, error: null };
}
