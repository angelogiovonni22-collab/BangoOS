import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translateLiteral } from "./literal";

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
