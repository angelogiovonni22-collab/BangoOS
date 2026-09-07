import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const crewsPage = read("app/(app)/crews/page.tsx");
const crewTable = read("components/crews/crew-table.tsx");
const tradePartnerMessages = read("app/(app)/trade-partner-messages/page.tsx");
const platformAdmin = read("components/platform-admin/platform-tenant-console.tsx");

assert.match(crewsPage, /const \{ t, locale \} = useI18n\(\)/, "Crews must resolve the selected B.O.S. locale");
assert.match(crewsPage, /<CrewTable[^>]+locale=\{locale\}/, "Crews must pass the selected locale to date rendering");
assert.match(crewTable, /locale === "es" \? "es-ES" : "en-US"/, "Crew dates must map the app locale to a locale tag");
assert.doesNotMatch(crewTable, /Intl\.DateTimeFormat\("en-US"/, "Crew dates must not be hard-wired to English");

assert.match(tradePartnerMessages, /getServerLocale/, "Trade partner messaging must resolve the server locale");
assert.match(tradePartnerMessages, /locale === "es" \? "es-ES" : "en-US"/, "Trade partner timestamps must honor Spanish locale");
assert.doesNotMatch(tradePartnerMessages, /Intl\.DateTimeFormat\("en-US"/, "Trade partner timestamps must not be hard-wired to English");

assert.match(platformAdmin, /const \{ locale \} = useI18n\(\)/, "Platform Admin must resolve the selected B.O.S. locale");
assert.match(platformAdmin, /locale === "es" \? "es-ES" : "en-US"/, "Platform Admin date and number formatting must honor Spanish locale");
assert.doesNotMatch(platformAdmin, /Intl\.DateTimeFormat\("en-US"/, "Platform Admin dates must not be hard-wired to English");
assert.doesNotMatch(platformAdmin, /toLocaleString\("en-US"\)/, "Platform Admin numeric formatting must not be hard-wired to English");

console.log("B.O.S. locale-aware date surface contract checks passed.");
