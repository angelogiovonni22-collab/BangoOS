import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function main() {
  const customerDetailsPage = readFileSync(join(process.cwd(), "app", "(app)", "customers", "[id]", "page.tsx"), "utf8");
  const projectNewPage = readFileSync(join(process.cwd(), "app", "(app)", "projects", "new", "page.tsx"), "utf8");

  test("1. customer detail route keeps New Project deep-link behavior", () => {
    check(
      customerDetailsPage.includes("/projects/new?customerId=${customerProfile.customer.id}"),
      "customer page links New Project with customerId query parameter",
    );
  });

  test("2. project creation consumes customerId query parameter", () => {
    check(
      projectNewPage.includes('new URLSearchParams(window.location.search).get("customerId")'),
      "project new page reads customerId from URL query string",
    );
    check(
      projectNewPage.includes("requestedCustomerId"),
      "project new page keeps resolved requestedCustomerId",
    );
  });

  test("3. customer preselection and snapshot prefill are wired", () => {
    check(
      projectNewPage.includes("applyCustomerSnapshot(current, matchedCustomer"),
      "matching customer from query pre-fills project snapshot fields",
    );
    check(
      projectNewPage.includes("customerId: customer.id"),
      "snapshot application keeps customer preselected",
    );
    check(
      projectNewPage.includes("jobSiteName")
      && projectNewPage.includes("primaryContactName")
      && projectNewPage.includes("primaryContactPhone")
      && projectNewPage.includes("primaryContactEmail"),
      "snapshot includes job site and contact fields",
    );
  });

  test("4. invalid customerId degrades gracefully", () => {
    check(
      projectNewPage.includes('t("projects.prefillCustomerUnavailable")'),
      "invalid customerId shows friendly fallback message",
    );
    check(
      projectNewPage.includes('updateField("customerId", customerId)'),
      "manual customer selection still works when prefill fails",
    );
  });

  test("5. editing project fields never mutates customer record", () => {
    check(
      !projectNewPage.includes('.from("customers").update('),
      "project page does not update customers table",
    );
    check(
      projectNewPage.includes("customer_id: formData.customerId"),
      "project payload stores customer relationship via customer_id",
    );
  });

  test("6. existing project creation flow remains intact", () => {
    check(
      projectNewPage.includes('.from("projects")') && projectNewPage.includes(".insert({"),
      "project creation still inserts into projects table",
    );
    check(
      projectNewPage.includes("router.push(`/projects/${createdProjectId}`)"),
      "project creation still redirects to project workspace",
    );
  });

  test("7. contract and financial section uses display-only payment preview", () => {
    check(
      projectNewPage.includes('t("projects.sectionContractFinancials")')
      && projectNewPage.includes('t("projects.requiredDownPayment")'),
      "new contract and down-payment fields are rendered",
    );
    check(
      projectNewPage.includes("paymentsReceivedValue = 0")
      && projectNewPage.includes("remainingBalanceValue"),
      "payments received and remaining balance are derived display values",
    );
  });

  console.log(`\nCustomer to project workflow contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
