import { readFileSync } from "node:fs";

const en = JSON.parse(readFileSync(new URL("../../locales/en/dashboard.json", import.meta.url), "utf8"));
const es = JSON.parse(readFileSync(new URL("../../locales/es/dashboard.json", import.meta.url), "utf8"));

const missingInSpanish = Object.keys(en).filter((key) => !(key in es)).sort();
const extraInSpanish = Object.keys(es).filter((key) => !(key in en)).sort();
const blankSpanish = Object.keys(en).filter((key) => typeof es[key] !== "string" || !es[key].trim()).sort();

console.log("DASHBOARD_MISSING_IN_SPANISH=" + JSON.stringify(missingInSpanish));
console.log("DASHBOARD_EXTRA_IN_SPANISH=" + JSON.stringify(extraInSpanish));
console.log("DASHBOARD_BLANK_IN_SPANISH=" + JSON.stringify(blankSpanish));
console.log(`Dashboard locale counts: en=${Object.keys(en).length} es=${Object.keys(es).length}`);
