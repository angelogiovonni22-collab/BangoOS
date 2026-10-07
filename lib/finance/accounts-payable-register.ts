import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { readAllSupabaseRows } from "@/lib/supabase/pagination";

export type BillRow = { id: string; vendor_id: string; project_id: string | null; bill_number: string; vendor_invoice_number: string | null; bill_date: string; due_date: string | null; status: string; total_amount: number; amount_paid: number; balance_due: number };
type VendorRow = { id: string; display_name: string | null; company_name: string | null };
type ProjectRow = { id: string; name: string | null; project_number: string | null };
type Query = {
  select(columns: string): Query;
  eq(column: string, value: string): Query;
  order(column: string, options: { ascending: boolean }): Query;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

export async function loadAccountsPayableRegister(supabase: SupabaseClient<Database>, companyId: string) {
  const db = supabase as unknown as { from(table: string): Query };
  const [bills, vendors, projects] = await Promise.all([
    readAllSupabaseRows((from, to) => db.from("vendor_bills").select("id,vendor_id,project_id,bill_number,vendor_invoice_number,bill_date,due_date,status,total_amount,amount_paid,balance_due").eq("company_id", companyId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => db.from("vendors").select("id,display_name,company_name").eq("company_id", companyId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => db.from("projects").select("id,name,project_number").eq("company_id", companyId).order("id", { ascending: true }).range(from, to)),
  ]);
  for (const result of [bills, vendors, projects]) if (result.error) throw new Error(result.error.message);
  return { bills: (bills.data ?? []) as BillRow[], vendors: (vendors.data ?? []) as VendorRow[], projects: (projects.data ?? []) as ProjectRow[] };
}
