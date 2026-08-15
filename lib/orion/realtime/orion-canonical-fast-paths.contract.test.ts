import fs from "node:fs";
import path from "node:path";
import { buildUniversalBosToolCatalog } from "@/lib/orion/intelligence";
import { normalizeRealtimeFastCommandParams } from "./fast-command-params";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main() {
  console.log("\nOrion canonical fast-path contract");

  const noDb = {} as never;
  const estimate = await normalizeRealtimeFastCommandParams({
    supabase: noDb,
    companyId: "company-1",
    commandId: "estimate.create",
    params: {
      values: { description: "Kitchen remodel with new cabinets" },
      lineItems: [{ description: "Cabinet installation", quantity: 2, unit: "each", unitCost: 850 }],
    },
  });
  const estimateValues = estimate.params.values as Record<string, unknown>;
  const estimateLines = estimate.params.lineItems as Array<Record<string, unknown>>;
  assert(estimate.error === null, "estimate fast path does not require database resolution when ids/names are absent");
  assert(estimateValues.title === "Kitchen remodel with new cabinets", "estimate fast path derives a useful title from scope when title is omitted");
  assert(estimateValues.status === "draft" && estimateValues.discountType === "none", "estimate fast path supplies safe draft defaults");
  assert(typeof estimateValues.issueDate === "string" && String(estimateValues.issueDate).length === 10, "estimate fast path supplies today's issue date");
  assert(estimateLines[0]?.id === "orion-estimate-line-1" && estimateLines[0]?.unitCost === "850", "estimate fast path normalizes line items and supplies transient ids");

  const invoice = await normalizeRealtimeFastCommandParams({
    supabase: noDb,
    companyId: "company-1",
    commandId: "invoice.create",
    params: {
      values: { description: "Progress billing" },
      lineItems: [{ description: "Phase 1 progress", quantity: "1", unit: "lump_sum", rate: 12500 }],
    },
  });
  const invoiceValues = invoice.params.values as Record<string, unknown>;
  const invoiceLines = invoice.params.lineItems as Array<Record<string, unknown>>;
  assert(invoiceValues.title === "Progress billing" && invoiceValues.status === "draft", "invoice fast path supplies a useful draft title and status");
  assert(invoiceLines[0]?.id === "orion-invoice-line-1" && invoiceLines[0]?.rate === "12500", "invoice fast path normalizes line items for the live invoice service");

  const customer = await normalizeRealtimeFastCommandParams({
    supabase: noDb,
    companyId: "company-1",
    commandId: "customer.create",
    params: { firstName: "John", lastName: "Smith" },
  });
  assert(customer.params.customerType === "residential", "customer fast path supplies the safe default customer type");

  const project = await normalizeRealtimeFastCommandParams({
    supabase: noDb,
    companyId: "company-1",
    commandId: "project.create",
    params: { name: "Hilliard Season Room" },
  });
  assert(project.params.status === "lead", "project fast path supplies the current safe default project status");

  const dailyReport = await normalizeRealtimeFastCommandParams({
    supabase: noDb,
    companyId: "company-1",
    commandId: "daily_report.create",
    params: { projectId: "project-1", updates: { workCompleted: [{ description: "Framing completed" }] } },
  });
  assert(typeof dailyReport.params.reportDate === "string" && String(dailyReport.params.reportDate).length === 10, "daily report fast path defaults the report date to today");
  assert((dailyReport.params.updates as Record<string, unknown>)?.workCompleted instanceof Array, "daily report fast path preserves supplied report content for one-call creation");

  const tools = buildUniversalBosToolCatalog();
  const estimateTool = tools.find((tool) => tool.name === "bos_estimate_create");
  const invoiceTool = tools.find((tool) => tool.name === "bos_invoice_create");
  const projectTool = tools.find((tool) => tool.name === "bos_project_create");
  const dailyReportTool = tools.find((tool) => tool.name === "bos_daily_report_create");
  const estimateSchema = JSON.stringify(estimateTool?.parameters || {});
  const invoiceSchema = JSON.stringify(invoiceTool?.parameters || {});
  const projectSchema = JSON.stringify(projectTool?.parameters || {});
  const dailyReportSchema = JSON.stringify(dailyReportTool?.parameters || {});
  assert(Boolean(estimateTool) && estimateSchema.includes("customerName") && estimateSchema.includes("projectName"), "estimate create tool exposes human-name aliases for one-call resolution");
  assert(Boolean(invoiceTool) && invoiceSchema.includes("customerName") && invoiceSchema.includes("projectName") && invoiceSchema.includes("estimateName"), "invoice create tool exposes human-name aliases for one-call resolution");
  assert(Boolean(projectTool) && projectSchema.includes("customerName"), "project create tool can resolve a spoken customer in the same create call");
  assert(Boolean(dailyReportTool) && dailyReportSchema.includes("projectName") && dailyReportSchema.includes("workCompleted") && dailyReportSchema.includes("labor"), "daily report create tool supports spoken project resolution and populated one-call creation");

  const session = read("app/api/orion/realtime/session/route.ts");
  const toolRoute = read("app/api/orion/realtime/tool/route.ts");
  const resolverRoute = read("app/api/orion/realtime/resolve-entity/route.ts");
  const resolver = read("lib/orion/realtime/entity-resolution.ts");
  const operational = read("lib/orion/commands/operational-command-patches.ts");
  assert(session.includes("Direct-work fast path") && session.includes("bos_estimate_create") && session.includes("bos_invoice_create"), "Realtime policy tells Orion to execute direct create/save requests without opening forms first");
  assert(session.includes("Visible-form boundary") && session.includes("If the user only asks you to create/save the estimate, use the canonical estimate fast path instead."), "visible UI operation remains available only when the user wants the form experience");
  assert(!session.includes("MANDATORY visible-create rule"), "legacy mandatory visible estimate creation rule is removed");
  assert(session.includes("issue them in the same response so they can execute concurrently"), "Realtime policy allows independent resolution/read calls to run concurrently");
  assert(toolRoute.includes("normalizeRealtimeFastCommandParams") && toolRoute.includes("resolvedAliases") && toolRoute.includes("elapsedMs"), "canonical Realtime route applies fast normalization and records latency telemetry");
  assert(resolverRoute.includes("resolveOrionEntity") && resolver.includes("scoreCandidate"), "entity matching is centralized and reused by both standalone and fast-path resolution");
  assert(operational.includes("const input = updates ? mergeDailyReportUpdates(baseInput, updates) : baseInput") && operational.includes("populatedOnCreate"), "daily report command writes supplied operational detail during initial creation instead of requiring a second update command");
  assert(operational.includes('input.header.overallStatus = "draft"'), "one-call daily report fast path cannot silently bypass the normal draft submission boundary");

  console.log(`\nOrion canonical fast-path results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

void main();