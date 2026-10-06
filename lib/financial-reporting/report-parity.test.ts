import assert from "node:assert/strict";
import { buildProjectFinancialReport } from "./ap-aware-service";
import { buildCompanyFinancialReport } from "./service";

type Row = Record<string, unknown>;
function fixture(receiptCost = 20) {
  const tables: Record<string, Row[]> = {
    projects: [{ id: "p1", name: "Audit", status: "in_progress", contract_amount: 1000, estimated_cost: 900 }],
    estimates: [{ id: "e1", project_id: "p1", status: "approved", total_amount: 1000, internal_cost_total: 900, created_at: "2026-01-01" }],
    estimate_line_items: [{ estimate_id: "e1", category: "labor", quantity: 1, unit_cost: 550 }, { estimate_id: "e1", category: "materials", quantity: 1, unit_cost: 350 }],
    project_scope_items: [{ project_id: "p1", material_cost: 350, labor_cost: 150 }],
    change_orders: [{ id: "c1", project_id: "p1", status: "approved", total_amount: 0 }, { id: "c2", project_id: "p1", status: "draft", total_amount: 500 }],
    change_order_line_items: [{ change_order_id: "c1", cost_amount: 100 }, { change_order_id: "c2", cost_amount: 500 }],
    purchase_orders: [{ id: "po1", project_id: "p1", status: "approved" }, { id: "po2", project_id: "p1", status: "cancelled" }],
    purchase_order_line_items: [{ id: "pol1", project_id: "p1", purchase_order_id: "po1", quantity_ordered: 10, quantity_received: 4, quantity_damaged: 1, unit_cost: 10 }, { project_id: "p1", purchase_order_id: "po2", quantity_ordered: 100, quantity_received: 0, quantity_damaged: 0, unit_cost: 10 }],
    project_material_allocations: [{ project_id: "p1", total_cost: 25 }],
    project_receipts: [{ project_id: "p1", total_amount: receiptCost, status: "approved" }, { project_id: "p1", total_amount: 10000, status: "needs_review" }],
    trade_partner_assignments: [{ id: "v1", project_id: "p1", assignment_status: "active", contract_status: "signed", contract_amount: 40, retainage_percent: 0 }, { id: "v2", project_id: "p1", assignment_status: "archived", contract_status: "signed", contract_amount: 1000 }],
    vendor_bills: [{ id: "b1", project_id: "p1", status: "approved", total_amount: 55, amount_paid: 0, balance_due: 55, match_status: "matched" }, { id: "b2", project_id: "p1", status: "draft", total_amount: 900 }],
    vendor_bill_line_items: [{ project_id: "p1", vendor_bill_id: "b1", purchase_order_line_item_id: null, category: "rental", line_amount: 30 }, { project_id: "p1", vendor_bill_id: "b1", purchase_order_line_item_id: "pol1", category: "materials", line_amount: 25 }, { project_id: "p1", vendor_bill_id: "b2", purchase_order_line_item_id: null, category: "materials", line_amount: 900 }],
    invoices: [], invoice_payment_history: [], tasks: [], equipment: [], material_requests: [],
    cost_codes: [{ id: "cc1", budget: 10000, committed_cost: 5000, actual_cost: 5000 }],
  };
  for (const rows of Object.values(tables)) for (const row of rows) row.company_id = "co1";
  tables.project_receipts.push({ company_id: "other-company", project_id: "p1", total_amount: 50000, status: "approved" });
  const executed: string[] = [];
  const client = {
    from(table: string) {
      let rows = tables[table] ?? [];
      let scoped = false;
      let single = false;
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { if (column === "company_id") scoped = true; rows = rows.filter((row) => row[column] === value); return query; },
        neq(column: string, value: unknown) { rows = rows.filter((row) => row[column] !== value); return query; },
        in(column: string, values: unknown[]) { rows = rows.filter((row) => values.includes(row[column])); return query; },
        not(column: string, _operator: string, value: unknown) { rows = rows.filter((row) => row[column] !== value); return query; },
        order() { return query; },
        maybeSingle() { single = true; return query; },
        then(resolve: (value: { data: Row[] | Row | null; error: null }) => unknown) {
          assert.ok(scoped, `${table} must be company scoped`);
          executed.push(table);
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  return { client: client as never, executed, tables };
}

async function main() {
  for (const receiptCost of [20, 700]) {
    const { client, executed } = fixture(receiptCost);
    const project = await buildProjectFinancialReport({ supabase: client, companyId: "co1", projectId: "p1" });
    assert.equal(project.summary.revisedBudget, 600, "working scope + approved internal CO cost");
    assert.equal(project.summary.revisedContractValue, 1000, "unpriced CO does not increase customer contract");
    assert.equal(project.summary.actualCost, 25 + receiptCost + 30, "PO-linked AP and unapproved/foreign costs excluded");
    assert.equal(project.summary.committedCost, 90, "only outstanding PO quantity and active vendor contract");
    assert.equal(project.jobCostByCategory.reduce((sum, row) => sum + row.budget, 0), 600, "category budgets reconcile to working scope");
    const materials = project.jobCostByCategory.find((row) => row.category === "materials")!;
    assert.equal(materials.forecast, Math.max(350, 50 + 25 + receiptCost), "small receipt cannot erase remaining materials budget");
    executed.length = 0;
    const company = await buildCompanyFinancialReport({ supabase: client, companyId: "co1" });
    assert.equal(company.summary.projectGrossProfit, project.summary.grossProfit, "company and project forecast profit agree");
    assert.equal(company.summary.committedCost, project.summary.committedCost);
    assert.equal(company.summary.jobsOverBudget, receiptCost === 700 ? 1 : 0);
    assert.ok(executed.length <= 14, "company cost reads must be batched, not per-project reports");
  }
  const { client, tables } = fixture();
  tables.projects.push({ ...tables.projects[0], id: "p2", name: "Second", contract_amount: 500, estimated_cost: 200 });
  const company = await buildCompanyFinancialReport({ supabase: client, companyId: "co1" });
  assert.equal(company.summary.projectGrossProfit, 700, "separate project baselines sum without repeating company cost codes");
  assert.equal(company.projectsReviewed, 2);
  const mixed = fixture();
  mixed.tables.invoices.push(
    { id: "i1", company_id: "co1", project_id: "p1", status: "sent", total_amount: 100, amount_paid: 40 },
    { id: "i2", company_id: "co1", project_id: "p1", status: "sent", total_amount: 100, amount_paid: 30 },
    { id: "i3", company_id: "co1", project_id: "p1", status: "void", total_amount: 100, amount_paid: 100 },
    { id: "i4", company_id: "co1", project_id: "p1", status: "sent", total_amount: 10, amount_paid: 10 },
  );
  mixed.tables.invoice_payment_history.push(
    { company_id: "co1", invoice_id: "i1", status: "recorded", amount: 40 },
    { company_id: "co1", invoice_id: "i3", status: "recorded", amount: 100 },
    { company_id: "co1", invoice_id: "missing", status: "recorded", amount: 9000 },
    { company_id: "co1", invoice_id: "i4", status: "voided", amount: 10 },
  );
  const mixedProject = await buildProjectFinancialReport({ supabase: mixed.client, companyId: "co1", projectId: "p1" });
  const mixedCompany = await buildCompanyFinancialReport({ supabase: mixed.client, companyId: "co1" });
  assert.equal(mixedProject.summary.paymentsReceived, 70, "history + legacy fallback per invoice, excluding voids and orphans");
  assert.equal(mixedCompany.summary.companyRevenue, 70);
  assert.equal(mixedProject.summary.outstandingReceivables, 140);
  assert.equal(mixedCompany.summary.totalOutstandingReceivables, 140);

  const cents = fixture(20.004);
  cents.tables.project_material_allocations[0].total_cost = 25.004;
  cents.tables.vendor_bill_line_items[0].line_amount = 30.004;
  cents.tables.project_scope_items[0].material_cost = 350.004;
  cents.tables.change_order_line_items[0].cost_amount = 100.004;
  cents.tables.trade_partner_assignments[0].contract_amount = 40.004;
  cents.tables.purchase_order_line_items[0].unit_cost = 10.0008;
  const centsProject = await buildProjectFinancialReport({ supabase: cents.client, companyId: "co1", projectId: "p1" });
  const centsCompany = await buildCompanyFinancialReport({ supabase: cents.client, companyId: "co1" });
  assert.equal(centsCompany.summary.projectGrossProfit, centsProject.summary.grossProfit, "cent rounding matches each canonical cost source");
  assert.equal(centsCompany.summary.committedCost, centsProject.summary.committedCost);
  console.log("Financial report parity: working scope, budget floor, approved costs, tenant isolation, AP de-duplication, and multi-project fixtures passed");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
