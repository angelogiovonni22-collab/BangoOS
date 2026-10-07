import assert from "node:assert/strict";
import test from "node:test";
import { loadAccountsReceivable } from "../accounts-receivable/service";
import { loadAccountsPayableSnapshot } from "./ap-prevailing-wage";
import { loadAccountsPayableRegister } from "./accounts-payable-register";

type Row = Record<string, unknown>;
function history(failTable?: string) {
  const tables: Record<string, Row[]> = { invoices: [], customers: [], projects: [], invoice_payment_history: [], vendor_bills: [], vendors: [] };
  for (let index = 0; index < 1501; index++) {
    const id = String(index).padStart(4, "0");
    tables.invoices.push({ id, company_id: "co1", invoice_number: id, title: id, customer_id: id, project_id: id, status: "sent", issue_date: "2026-09-01", due_date: "2026-09-01", total_amount: 2, amount_paid: 1, archived_at: null });
    tables.customers.push({ id, company_id: "co1", first_name: `Customer ${id}`, last_name: "", customer_type: "residential" });
    tables.projects.push({ id, company_id: "co1", name: `Project ${id}` });
    tables.vendors.push({ id, company_id: "co1", display_name: `Vendor ${id}` });
    tables.invoice_payment_history.push({ id, company_id: "co1", amount: 1, payment_date: "2026-10-02", status: "recorded" });
    tables.vendor_bills.push({ id, company_id: "co1", vendor_id: id, project_id: id, bill_date: "2026-09-01", status: "approved", total_amount: 2, amount_paid: 1, balance_due: 1, due_date: "2026-09-01" });
  }
  for (const rows of Object.values(tables)) rows.push({ ...rows[0], id: "foreign", company_id: "other" });
  for (const status of ["draft", "paid", "void"]) tables.invoices.push({ ...tables.invoices[0], id: status, status, total_amount: 9999 });
  tables.invoices.push({ ...tables.invoices[0], id: "archived", archived_at: "2026-10-01", total_amount: 9999 });
  tables.vendor_bills.push({ ...tables.vendor_bills[0], id: "voided", status: "voided", balance_due: 9999 });
  tables.invoice_payment_history.push({ ...tables.invoice_payment_history[0], id: "old", payment_date: "2026-09-30", amount: 9999 }, { ...tables.invoice_payment_history[0], id: "voided", status: "voided", amount: 9999 });
  const pages: { table: string; from: number }[] = [];
  const client = { from(table: string) {
    let rows = [...tables[table]];
    let scoped = false;
    let ordered = false;
    let range: [number, number] | null = null;
    const query = {
      select() { return query; },
      eq(column: string, value: unknown) { if (column === "company_id") scoped = true; rows = rows.filter(row => row[column] === value); return query; },
      neq(column: string, value: unknown) { rows = rows.filter(row => row[column] !== value); return query; },
      is(column: string, value: unknown) { rows = rows.filter(row => row[column] === value); return query; },
      gte(column: string, value: string) { rows = rows.filter(row => String(row[column]) >= value); return query; },
      order(column: string) { if (column === "id") ordered = true; return query; },
      range(from: number, to: number) { assert.ok(ordered, `${table} requires stable ordering`); assert.ok(to - from < 500); range = [from, to]; return query; },
      then(resolve: (value: unknown) => unknown) {
        assert.ok(scoped, `${table} must remain company scoped`);
        const from = range?.[0] ?? 0;
        pages.push({ table, from });
        return Promise.resolve(table === failTable && from >= 500
          ? { data: null, error: { message: `${table} later page unavailable` } }
          : { data: rows.slice(from, (range?.[1] ?? 999) + 1), error: null }).then(resolve);
      },
    };
    return query;
  } };
  return { client: client as never, pages, tables };
}

test("receivable aging and current-month collections include 1501 records and late customer/project names", async () => {
  const f = history();
  const result = await loadAccountsReceivable(f.client, "co1", new Date(2026, 9, 7));
  assert.equal(result.error, null);
  assert.equal(result.data?.invoices.length, 1501);
  assert.equal(result.data?.summary.totalReceivable, 1501);
  assert.equal(result.data?.summary.overdueReceivable, 1501);
  assert.equal(result.data?.summary.aging["31-60"], 1501);
  assert.equal(result.data?.summary.collectedThisMonth, 1501);
  assert.equal(result.data?.invoices.find(row => row.id === "1500")?.customerName, "Customer 1500");
  assert.equal(result.data?.invoices.find(row => row.id === "1500")?.projectName, "Project 1500");
});

test("payable summary includes 1501 bills, excludes voids and preserves optional project scope", async () => {
  const f = history();
  const result = await loadAccountsPayableSnapshot({ supabase: f.client, companyId: "co1" });
  assert.equal(result.billCount, 1501);
  assert.equal(result.totalOpenBills, 3002);
  assert.equal(result.totalApproved, 3002);
  assert.equal(result.totalPaid, 1501);
  assert.equal(result.totalOutstanding, 1501);
  const scoped = await loadAccountsPayableSnapshot({ supabase: f.client, companyId: "co1", projectId: "1500" });
  assert.equal(scoped.billCount, 1);
  assert.equal(scoped.totalOutstanding, 1);
});

test("failed later history pages never return partial receivable or payable totals", async () => {
  for (const table of ["invoices", "customers", "projects", "invoice_payment_history"]) {
    const result = await loadAccountsReceivable(history(table).client, "co1", new Date(2026, 9, 7));
    assert.ok(result.data === null, `${table} must fail closed`);
    assert.equal(result.error, `${table} later page unavailable`);
  }
  await assert.rejects(loadAccountsPayableSnapshot({ supabase: history("vendor_bills").client, companyId: "co1" }), /vendor_bills later page unavailable/);
});

test("payable register keeps late bills, vendor names, project names and voided history", async () => {
  const result = await loadAccountsPayableRegister(history().client, "co1");
  assert.equal(result.bills.length, 1502);
  assert.equal(result.bills.find(row => row.id === "1500")?.vendor_id, "1500");
  assert.equal(result.vendors.find(row => row.id === "1500")?.display_name, "Vendor 1500");
  assert.equal(result.projects.find(row => row.id === "1500")?.name, "Project 1500");
  assert.ok(result.bills.some(row => row.status === "voided"));
  for (const table of ["vendor_bills", "vendors", "projects"]) {
    await assert.rejects(loadAccountsPayableRegister(history(table).client, "co1"), new RegExp(`${table} later page unavailable`));
  }
});
