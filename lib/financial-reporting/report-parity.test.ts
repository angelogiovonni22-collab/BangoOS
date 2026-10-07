import assert from "node:assert/strict";
import { buildProjectFinancialReport } from "./ap-aware-service";
import { buildCompanyFinancialReport } from "./service";

type Row = Record<string, unknown>;
function fixture(receiptCost = 20, failTable?: string, failCode = "XX000", failFirst = false) {
  const tables: Record<string, Row[]> = {
    projects: [{ id: "p1", name: "Audit", status: "in_progress", contract_amount: 1000, estimated_cost: 900 }],
    estimates: [{ id: "e1", project_id: "p1", status: "approved", total_amount: 1000, internal_cost_total: 900, created_at: "2026-01-01" }],
    estimate_line_items: [{ estimate_id: "e1", category: "labor", quantity: 1, unit_cost: 550 }, { estimate_id: "e1", category: "materials", quantity: 1, unit_cost: 350 }],
    project_scope_items: [{ project_id: "p1", material_cost: 350, labor_cost: 150 }],
    change_orders: [{ id: "c1", project_id: "p1", status: "approved", total_amount: 0 }, { id: "c2", project_id: "p1", status: "draft", total_amount: 500 }],
    change_order_line_items: [{ change_order_id: "c1", cost_amount: 100 }, { change_order_id: "c2", cost_amount: 500 }],
    purchase_orders: [{ id: "po1", project_id: "p1", status: "approved" }, { id: "po2", project_id: "p1", status: "cancelled" }, { id: "po3", project_id: "p1", status: "draft" }],
    purchase_order_line_items: [{ id: "pol1", project_id: "p1", purchase_order_id: "po1", cost_code_id: "cc1", quantity_ordered: 10, quantity_received: 4, quantity_damaged: 1, unit_cost: 10 }, { project_id: "p1", purchase_order_id: "po2", quantity_ordered: 100, quantity_received: 0, quantity_damaged: 0, unit_cost: 10 }, { project_id: "p1", purchase_order_id: "po3", cost_code_id: "cc1", quantity_ordered: 100, quantity_received: 0, quantity_damaged: 0, unit_cost: 25 }, { project_id: "p1", purchase_order_id: "missing-order", cost_code_id: "cc1", quantity_ordered: 100, quantity_received: 0, quantity_damaged: 0, unit_cost: 30 }],
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
  const pages: { table: string; from: number; lastId?: unknown }[] = [];
  const filterBatches = new Map<string, number>();
  const client = {
    from(table: string) {
      let rows = tables[table] ?? [];
      let scoped = false;
      let single = false;
      let range: [number, number] | null = null;
      let idOrdered = false;
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { if (column === "company_id") scoped = true; rows = rows.filter((row) => row[column] === value); return query; },
        neq(column: string, value: unknown) { rows = rows.filter((row) => row[column] !== value); return query; },
        in(column: string, values: unknown[]) { assert.ok(values.length <= 100, "parent-ID filters must be bounded"); filterBatches.set(table, (filterBatches.get(table) ?? 0) + 1); rows = rows.filter((row) => values.includes(row[column])); return query; },
        not(column: string, _operator: string, value: unknown) { rows = rows.filter((row) => row[column] !== value); return query; },
        order(column: string) { if (column === "id") idOrdered = true; return query; },
        range(from: number, to: number) { range = [from, to]; assert.ok(idOrdered, `${table} pages must have stable ID ordering`); return query; },
        maybeSingle() { single = true; return query; },
        then(resolve: (value: { data: Row[] | Row | null; error: { message: string; code?: string } | null }) => unknown) {
          assert.ok(scoped, `${table} must be company scoped`);
          executed.push(table);
          const from = range?.[0] ?? 0;
          pages.push({ table, from, lastId: rows.slice(from, (range?.[1] ?? 999) + 1).at(-1)?.id });
          if (table === failTable && (failFirst || from >= 500 || (filterBatches.get(table) ?? 0) > 1)) return Promise.resolve({ data: null, error: { message: `${table} history unavailable`, code: failCode } }).then(resolve);
          return Promise.resolve({ data: single ? rows[0] ?? null : rows.slice(from, (range?.[1] ?? 999) + 1), error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  return { client: client as never, executed, tables, pages };
}

function historyFixture(failTable?: string) {
  const result = fixture(20, failTable);
  const sources: Record<string, Row> = {
    estimates: { status: "approved", total_amount: 1000, internal_cost_total: 900, created_at: "2026-01-01" },
    estimate_line_items: { estimate_id: "e1", category: "materials", quantity: 1, unit_cost: 1 },
    project_scope_items: { material_cost: 1, labor_cost: 1 },
    change_orders: { status: "approved", total_amount: 1 },
    change_order_line_items: { change_order_id: "c1", cost_amount: 1 },
    purchase_orders: { status: "approved" },
    purchase_order_line_items: { purchase_order_id: "po1", cost_code_id: "cc1", quantity_ordered: 1, quantity_received: 0, quantity_damaged: 0, unit_cost: 1 },
    project_material_allocations: { cost_code_id: "cc1", total_cost: 1 },
    project_receipts: { total_amount: 1, status: "approved" },
    trade_partner_assignments: { assignment_status: "active", contract_status: "signed", contract_amount: 1, retainage_percent: 0 },
    vendor_bills: { status: "approved", total_amount: 1, amount_paid: 1, balance_due: 0, match_status: "matched" },
    vendor_bill_line_items: { vendor_bill_id: "b1", purchase_order_line_item_id: null, category: "rental", line_amount: 1 },
    invoices: { status: "paid", total_amount: 1, amount_paid: 1 },
    invoice_payment_history: { invoice_id: "i1", status: "recorded", amount: 1 },
    tasks: { actual_hours: 1 },
    equipment: { assigned_job_id: "p1", daily_internal_cost: 1 },
    material_requests: {},
    cost_codes: { code: "HISTORY", name: "History", budget: 1 },
  };
  const prefixes: Record<string, string> = { estimates: "e1", change_orders: "c1", purchase_orders: "po1", vendor_bills: "b1", invoices: "i1", cost_codes: "cc1" };
  for (const [table, source] of Object.entries(sources)) {
    result.tables[table] = Array.from({ length: 1501 }, (_, index) => {
      const suffix = String(index).padStart(4, "0");
      const row: Row = { ...source, id: `${prefixes[table] ?? table}-${suffix}`, company_id: "co1", project_id: "p1" };
      for (const key of ["estimate_id", "change_order_id", "purchase_order_id", "vendor_bill_id", "invoice_id", "cost_code_id"]) {
        if (row[key]) row[key] = `${row[key]}-${suffix}`;
      }
      return row;
    });
    result.tables[table].push({ ...result.tables[table][0], id: "foreign", company_id: "other-company" });
  }
  return { ...result, sourceTables: Object.keys(sources) };
}

async function main() {
  for (const receiptCost of [20, 700]) {
    const { client, executed } = fixture(receiptCost);
    const project = await buildProjectFinancialReport({ supabase: client, companyId: "co1", projectId: "p1" });
    assert.equal(project.summary.revisedBudget, 600, "working scope + approved internal CO cost");
    assert.equal(project.summary.revisedContractValue, 1000, "unpriced CO does not increase customer contract");
    assert.equal(project.summary.actualCost, 25 + receiptCost + 30, "PO-linked AP and unapproved/foreign costs excluded");
    assert.equal(project.summary.committedCost, 90, "draft, cancelled and orphan PO lines are excluded from commitments");
    assert.equal(project.costCodeVariance.find((row) => row.costCodeId === "cc1")?.committed, 50, "cost-code commitments exclude drafts and missing parents");
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
  const history = historyFixture();
  const historyProject = await buildProjectFinancialReport({ supabase: history.client, companyId: "co1", projectId: "p1" });
  assert.equal(historyProject.summary.revisedBudget, 4503, "full scope and approved change-order cost history");
  assert.equal(historyProject.summary.revisedContractValue, 2501);
  assert.equal(historyProject.summary.committedCost, 3002);
  assert.equal(historyProject.summary.actualCost, 4503);
  assert.equal(historyProject.summary.forecastFinalCost, 7505);
  assert.equal(historyProject.summary.grossProfit, -5004);
  assert.equal(historyProject.summary.paymentsReceived, 1501);
  assert.equal(historyProject.materials.purchaseOrderCount, 1501);
  assert.equal(historyProject.materials.requestCount, 1501);
  assert.equal(historyProject.labor.employeeHours, 1501);
  assert.equal(historyProject.equipment.assignedEquipmentCount, 1501);
  assert.equal(historyProject.accountsPayable?.approvedBillCost, 1501);
  assert.equal(historyProject.costCodeVariance.find((row) => row.costCodeId === "cc1-1500")?.code, "HISTORY", "last-page cost-code reference loaded");
  for (const table of history.sourceTables) assert.ok(history.pages.some((page) => page.table === table && String(page.lastId).endsWith("-1500")), `${table} must load its last history page`);
  const historyCompany = await buildCompanyFinancialReport({ supabase: history.client, companyId: "co1" });
  assert.equal(historyCompany.summary.projectGrossProfit, historyProject.summary.grossProfit);
  assert.equal(historyCompany.summary.committedCost, historyProject.summary.committedCost);
  assert.equal(historyCompany.summary.companyRevenue, 1501);
  for (const table of history.sourceTables) {
    const failed = historyFixture(table);
    await assert.rejects(buildProjectFinancialReport({ supabase: failed.client, companyId: "co1", projectId: "p1" }), new RegExp(`${table} history unavailable`));
  }
  for (const table of ["estimates", "change_orders", "invoices", "invoice_payment_history", "trade_partner_assignments", "project_scope_items", "change_order_line_items", "purchase_orders", "purchase_order_line_items", "project_material_allocations", "project_receipts", "vendor_bills", "vendor_bill_line_items"]) {
    const failed = historyFixture(table);
    await assert.rejects(buildCompanyFinancialReport({ supabase: failed.client, companyId: "co1" }), new RegExp(`${table} history unavailable`));
  }
  for (const table of ["project_receipts", "vendor_bills"]) {
    for (const code of ["42P01", "PGRST205", "42501"]) {
      const unavailable = fixture(20, table, code, true);
      await assert.rejects(buildProjectFinancialReport({ supabase: unavailable.client, companyId: "co1", projectId: "p1" }), new RegExp(`${table} history unavailable`), "unavailable approved costs must not silently disappear");
    }
  }
  const manyProjects = fixture();
  manyProjects.tables.projects = Array.from({ length: 1501 }, (_, index) => ({ ...manyProjects.tables.projects[0], id: `project-${index}`, contract_amount: 2, estimated_cost: 1 }));
  const projectsReport = await buildCompanyFinancialReport({ supabase: manyProjects.client, companyId: "co1" });
  assert.equal(projectsReport.projectsReviewed, 1501);
  assert.equal(projectsReport.summary.projectGrossProfit, 1501);
  const failedProjects = fixture(20, "projects");
  failedProjects.tables.projects = manyProjects.tables.projects;
  await assert.rejects(buildCompanyFinancialReport({ supabase: failedProjects.client, companyId: "co1" }), /projects history unavailable/);
  console.log("Financial report parity: working scope, budget floor, approved costs, tenant isolation, AP de-duplication, multi-project and 1501-row history/failure fixtures passed");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
