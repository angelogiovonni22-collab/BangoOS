import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translateLiteral } from "./literal";
import { translate } from "./config";

const names = ["Project", "Change Orders", "BOS Pilot 20261019 — synthetic project", "CO-2026-0003 · synthetic project", "  Customer  ", "Proyecto de María & Sons"];
for (const locale of ["en", "es"] as const) {
  for (const name of names) assert.equal(translateLiteral(locale, name, true), name);
}
assert.equal(translateLiteral("es", "Project"), "Proyecto", "Interface labels still translate");
assert.equal(translateLiteral("es", "Customer"), "Cliente", "Accessible label prefixes translate independently of raw names");
assert.equal(translateLiteral("es", "  Project  "), "  Proyecto  ");
assert.notEqual(translateLiteral("es", names[2]), names[2], "Control reproduces the original name/template collision");

const read = (path: string) => readFileSync(path, "utf8");
const header = read("components/ui/page-header.tsx");
assert.ok(header.includes("translateLiteral(locale, title, titleIsUserContent)"));
assert.ok(header.includes("data-user-content={titleIsUserContent || undefined}"));
assert.ok(header.includes("translateLiteral(locale, description)"), "Static helper text retains localization");
const workspace = read("components/workspace/workspace-navigation.tsx");
assert.ok(workspace.includes("data-user-content={item.userContent || undefined}"));
assert.ok(workspace.includes("data-user-content={titleIsUserContent || undefined}"));
const project = read("components/projects/workspace/project-workspace-header.tsx");
assert.ok(project.includes("titleIsUserContent"));
assert.ok(project.includes("{ label: projectName, userContent: true }"));
assert.ok(project.includes("{ label: customerLabel, href: customerProjectsHref, userContent: true }"));
const table = read("components/projects/project-table.tsx");
assert.ok(table.includes('data-user-content-attributes="true"'));
assert.ok(table.includes('translateLiteral(locale, term("customer", "Customer"))'));
const filters = read("components/change-orders/change-orders-filters.tsx");
assert.ok(filters.includes("options={customerOptions} userContentOptions"));
assert.ok(filters.includes("options={projectOptions} userContentOptions"));
assert.ok(filters.includes('userContentOptions && option.value !== "all"'), "Named options are protected while All/status options retain translation");
assert.ok(read("components/projects/project-filters.tsx").includes('data-user-content={option.value !== "all" || undefined}'));
assert.ok(table.includes('<Link data-user-content href={`/projects/${project.id}`}'));
const localizer = read("lib/i18n/legacy-text-localizer.tsx");
assert.ok(localizer.includes('[data-user-content]'));
assert.ok(localizer.includes('element.hasAttribute("data-user-content-attributes")'));
const changeOrder = read("components/change-orders/change-order-detail.tsx");
assert.ok(changeOrder.includes("titleIsUserContent"));
assert.ok(changeOrder.includes("<span data-user-content>{projectName}</span>"));
assert.ok(changeOrder.includes("<span data-user-content>{customerName}</span>"));
assert.ok(changeOrder.includes('data-user-content={Boolean(changeOrder.description) || undefined}'));
assert.ok(changeOrder.includes('data-user-content={Boolean(changeOrder.reason) || undefined}'));
const scope = read("components/projects/workspace/project-scope-of-work.tsx");
assert.ok(scope.includes('<Link href={`/change-orders/${changeOrder.id}`} className={outlineButton}>View</Link>'), "Static View action remains translatable");
console.log("PASS: 12 exact user-name cases, original translation collision control, static-label translation, header/breadcrumb/row/description boundaries");

// New interface phrases must translate while identical customer-entered names stay raw.
const directoryLabels = [
  ["requestedDate", "Requested Date", "Fecha solicitada"],
  ["restore", "Restore", "Restaurar"],
  ["view", "View", "Ver"],
  ["day", "day", "día"],
  ["days", "days", "días"],
  ["noChangeOrdersFiltered", "No matching change orders", "No hay órdenes de cambio que coincidan"],
  ["noChangeOrdersFilteredDescription", "Adjust filters or search terms to find existing change orders.", "Ajuste los filtros o los términos de búsqueda para encontrar órdenes de cambio existentes."],
] as const;
for (const [key, english, spanish] of directoryLabels) {
  assert.equal(translate("en", `finance.${key}`), english);
  assert.equal(translate("es", `finance.${key}`), spanish);
  assert.equal(translateLiteral("es", english, true), english, "Customer content matching interface text remains unchanged");
}
console.log("PASS: directory labels/empty states translate in both languages and colliding customer names remain exact");

// Detail interface localization must not translate similarly named saved content.
const detailLabels = [
  ["scopeDescription", "Scope / Description", "Alcance / Descripción"],
  ["sendToCustomer", "Send to Customer", "Enviar al cliente"],
  ["markApproved", "Mark Approved", "Marcar como aprobada"],
  ["selectExistingInvoice", "Select existing invoice", "Seleccionar factura existente"],
  ["createNewInvoice", "Create New Invoice", "Crear factura nueva"],
  ["customerNotes", "Customer Notes", "Notas para el cliente"],
] as const;
for (const [key, english, spanish] of detailLabels) {
  assert.equal(translate("en", `finance.${key}`), english);
  assert.equal(translate("es", `finance.${key}`), spanish);
  assert.equal(translateLiteral("es", english, true), english);
}
assert.ok(changeOrder.includes('data-user-content={Boolean(changeOrder.customer_notes) || undefined}'));
assert.ok(changeOrder.includes('data-user-content={Boolean(changeOrder.internal_notes) || undefined}'));
assert.ok(changeOrder.includes('<option data-user-content key={invoiceOption.id}'));
assert.ok(changeOrder.includes('<p data-user-content className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.description}</p>'));
console.log("PASS: detail interface translations and saved note/invoice/activity content boundaries");
