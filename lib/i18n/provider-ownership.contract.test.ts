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

function countMatches(source: string, expression: RegExp) {
  return (source.match(expression) || []).length;
}

function main() {
  const appLayout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
  const appShell = readFileSync(join(process.cwd(), "app", "(app)", "app-shell.tsx"), "utf8");
  const authLayout = readFileSync(join(process.cwd(), "app", "(app)", "layout.tsx"), "utf8");
  const i18nProvider = readFileSync(join(process.cwd(), "lib", "i18n", "provider.tsx"), "utf8");

  test("1. Root layout mounts I18nProvider once", () => {
    check(appLayout.includes("<I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>"), "root layout wraps children with I18nProvider");
    check(countMatches(appLayout, /<I18nProvider/g) === 1, "root layout mounts exactly one I18nProvider instance");
  });

  test("2. Authenticated shell remains under root layout tree", () => {
    check(authLayout.includes("<AppShell"), "authenticated layout renders AppShell");
    check(authLayout.includes("<CompanyProvider workspace={workspace.context}>"), "company provider ownership remains in authenticated layout");
  });

  test("3. Persistent Orion remains in app shell tree", () => {
    check(appShell.includes("<PersistentOrion />"), "persistent Orion is rendered by app shell");
    check(appShell.includes("<GlobalOrionVoiceProvider>"), "global Orion provider remains nested in app shell composition");
  });

  test("4. useI18n follows strict provider policy", () => {
    check(i18nProvider.includes("throw new Error(\"useI18n must be used within an I18nProvider.\")"), "useI18n throws when provider is missing");
    check(!i18nProvider.includes("FALLBACK_I18N_CONTEXT"), "silent fallback context is not used");
  });

  console.log(`\nI18n provider ownership contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
