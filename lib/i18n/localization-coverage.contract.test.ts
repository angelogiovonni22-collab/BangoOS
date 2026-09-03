import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) { passed += 1; console.log(`  + ${message}`); }
  else { failed += 1; console.error(`  x FAIL: ${message}`); }
}

function test(name: string, run: () => void) { console.log(`\n${name}`); run(); }
function json(path: string) { return JSON.parse(readFileSync(path, "utf8")) as Record<string, string>; }

const root = process.cwd();
const enDir = join(root, "locales", "en");
const esDir = join(root, "locales", "es");
const enFiles = readdirSync(enDir).filter((name) => name.endsWith(".json")).sort();
const esFiles = readdirSync(esDir).filter((name) => name.endsWith(".json")).sort();

for (const filename of enFiles) {
  test(`Locale parity: ${filename}`, () => {
    const esPath = join(esDir, filename);
    check(existsSync(esPath), `Spanish namespace exists for ${filename}`);
    if (!existsSync(esPath)) return;
    const en = json(join(enDir, filename));
    const es = json(esPath);
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();
    check(JSON.stringify(enKeys) === JSON.stringify(esKeys), `${filename} has exact English/Spanish key parity`);
    check(enKeys.every((key) => typeof es[key] === "string" && es[key].trim().length > 0), `${filename} has no blank Spanish values`);
  });
}

test("Namespace sets match", () => {
  check(JSON.stringify(enFiles) === JSON.stringify(esFiles), "English and Spanish expose the same namespace files");
  for (const required of ["blueprints.json", "finance.json", "partners.json", "resources.json", "settings.json"]) {
    check(enFiles.includes(required), `major namespace ${required} is present`);
  }
});

test("Shared localization architecture", () => {
  const config = readFileSync(join(root, "lib", "i18n", "config.ts"), "utf8");
  const provider = readFileSync(join(root, "lib", "i18n", "provider.tsx"), "utf8");
  const server = readFileSync(join(root, "lib", "i18n", "server.ts"), "utf8");
  const selector = readFileSync(join(root, "components", "ui", "language-selector.tsx"), "utf8");
  const bridge = readFileSync(join(root, "lib", "i18n", "legacy-text-localizer.tsx"), "utf8");
  check(config.includes('blueprints: blueprintsEs'), "shared config registers Spanish blueprints");
  check(config.includes('finance: financeEs'), "shared config registers Spanish finance");
  check(config.includes('resources: resourcesEs'), "shared config registers Spanish resources");
  check(config.includes('settings: settingsEs'), "shared config registers Spanish settings");
  check(provider.includes('<LegacyTextLocalizer locale={locale} />'), "provider mounts legacy hard-coded text migration bridge");
  check(provider.includes('throw new Error("useI18n must be used within an I18nProvider.")'), "strict provider ownership remains intact");
  check(server.includes("getServerTranslator"), "server-rendered pages share the localization source of truth");
  check(selector.includes("router.refresh()"), "language switch refreshes server-rendered content");
  check(bridge.includes('[data-user-content]'), "migration bridge explicitly excludes user content");
  check(bridge.includes("MutationObserver"), "migration bridge covers dynamically rendered UI copy");
});

test("Representative previously-English-only pages are localized", () => {
  const blueprints = readFileSync(join(root, "app", "(app)", "blueprints", "page.tsx"), "utf8");
  check(blueprints.includes('useI18n'), "Blueprints uses i18n directly");
  check(blueprints.includes('t("blueprints.title")'), "Blueprints page title is translated through a key");
  const financeEs = json(join(esDir, "finance.json"));
  const resourcesEs = json(join(esDir, "resources.json"));
  const settingsEs = json(join(esDir, "settings.json"));
  check(financeEs.invoices === "Facturas", "Invoices Spanish translation is present");
  check(financeEs.changeOrders === "Órdenes de cambio", "Change Orders Spanish translation is present");
  check(resourcesEs.materialsTitle === "Gestión de materiales", "Materials Spanish translation is present");
  check(resourcesEs.unitsTitle === "Unidades de medida", "Units Spanish translation is present");
  check(settingsEs.themeTitle === "Tema", "Settings Spanish translation is present");
});

console.log(`\nLocalization coverage contract results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
