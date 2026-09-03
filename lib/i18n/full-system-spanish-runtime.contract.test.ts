import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const runtimeEn = JSON.parse(readFileSync(new URL("../../locales/en/runtime.json", import.meta.url), "utf8")) as Record<string, string>;
const runtimeEs = JSON.parse(readFileSync(new URL("../../locales/es/runtime.json", import.meta.url), "utf8")) as Record<string, string>;
const config = readFileSync(new URL("./config.ts", import.meta.url), "utf8");
const bridge = readFileSync(new URL("./legacy-text-localizer.tsx", import.meta.url), "utf8");

test("audited runtime English and Spanish dictionaries stay in exact parity", () => {
  assert.deepEqual(Object.keys(runtimeEs).sort(), Object.keys(runtimeEn).sort());
  for (const key of Object.keys(runtimeEn)) {
    assert.ok(runtimeEs[key]?.trim(), `missing Spanish runtime value for ${key}`);
    assert.notEqual(runtimeEs[key], runtimeEn[key], `runtime value ${key} must be genuinely localized`);
  }
});

test("major live-production English stragglers have explicit Spanish coverage", () => {
  for (const key of [
    "operationsCommandCenter",
    "dailyAssignmentBoard",
    "safetyWorkspace",
    "estimateCreateTrack",
    "equipmentEmptyDescription",
    "dailyReportDescription",
    "customerManagementDescription",
    "vendorManagementDescription",
    "orionOpenState",
    "orionDrag",
    "showDatePicker",
    "themeWorkspaceLayout",
    "voiceOffDescription",
  ]) {
    assert.ok(runtimeEn[key], `missing audited English phrase ${key}`);
    assert.ok(runtimeEs[key], `missing audited Spanish phrase ${key}`);
  }
});

test("runtime namespace participates in the shared client and server translation source", () => {
  assert.match(config, /runtimeEn from "@\/locales\/en\/runtime\.json"/);
  assert.match(config, /runtimeEs from "@\/locales\/es\/runtime\.json"/);
  assert.match(config, /runtime: NamespaceDictionary/);
  assert.match(config, /runtime: runtimeEn/);
  assert.match(config, /runtime: runtimeEs/);
});

test("legacy migration bridge covers dynamic accessibility copy and English schedule dates safely", () => {
  assert.match(bridge, /aria-label/);
  assert.match(bridge, /aria-description/);
  assert.match(bridge, /data-user-content/);
  assert.match(bridge, /SPANISH_WEEKDAYS/);
  assert.match(bridge, /SPANISH_MONTHS/);
  assert.match(bridge, /translateScheduleDate/);
  assert.match(bridge, /MON\|TUE\|WED\|THU\|FRI\|SAT\|SUN/);
});
