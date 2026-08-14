import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function check(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

async function main() {
  const editPage = read("app/(app)/customers/[id]/edit/page.tsx");
  const handlers = read("lib/orion/commands/handlers.ts");
  const registry = read("lib/orion/commands/registry.ts");
  const domainService = read("lib/customers/customer-domain-service.ts");

  await test("1. customer edit page uses the shared update service", () => {
    check(editPage.includes('import { CustomerDomainError, updateCustomer } from "@/lib/customers";'), "edit page imports the shared customer domain service");
    check(editPage.includes("const result = await updateCustomer({"), "edit page submits through updateCustomer");
    check(!editPage.includes('.from("customers").update('), "edit page no longer performs a direct Supabase update");
    check(!editPage.includes("createSupabaseOrionEventPublisher"), "edit page no longer publishes customer update events directly");
  });

  await test("2. Orion customer commands reuse the shared domain service", () => {
    check(handlers.includes('archiveCustomer, restoreCustomer, updateCustomer, mapOrionCustomerUpdateParamsToInput'), "Orion handlers import the shared customer domain functions");
    check(handlers.includes("const result = await updateCustomer({"), "customer.update handler uses the shared update service");
    check(handlers.includes("const result = await archiveCustomer({"), "customer.archive handler uses the shared archive service");
    check(handlers.includes("const result = await restoreCustomer({"), "customer.restore handler uses the shared restore service");
    check(!handlers.includes('.from("customers").update('), "Orion handlers no longer update the customer table directly");
  });

  await test("3. customer command validation points at the shared update contract", () => {
    check(registry.includes("validateCustomerUpdateParams"), "registry uses the shared customer update validator");
    check(registry.includes('id: "customer.update"'), "customer.update command is still registered");
  });

  await test("4. the shared customer domain service keeps the policy surface small", () => {
    check(domainService.includes("export async function updateCustomer"), "shared update service exists");
    check(domainService.includes("export async function archiveCustomer"), "shared archive service exists");
    check(domainService.includes("export async function restoreCustomer"), "shared restore service exists");
    check(domainService.includes('eq("company_id", params.companyId)'), "company scoping is enforced in the shared service");
    check(!domainService.includes(".delete("), "shared customer domain service has no hard delete path");
    check(!domainService.toLowerCase().includes("hard delete"), "shared customer domain service does not describe a hard delete path");
  });

  console.log(`\nCustomer domain wiring results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
