import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const tradePartners = read("app/(app)/trade-partners/page.tsx");
const crewSummary = read("components/projects/workspace/project-crew-summary.tsx");
const dashboardLive = read("lib/dashboard/live-data.ts");
const dashboardMock = read("lib/dashboard/mock-data.ts");
const operations = read("lib/operations/command-center-normalizer.ts");
const navigation = read("lib/orion/navigation/catalog.ts");
const legacyTeamPage = read("app/(app)/team/page.tsx");

assert.doesNotMatch(tradePartners, /\?tab=trade-partners/, "Trade Partner control center must not link to a nonexistent project tab");
assert.match(tradePartners, /\?tab=subcontractors/, "Trade Partner assignments open the canonical Subcontractors project tab");

for (const [name, source] of [
  ["project crew summary", crewSummary],
  ["dashboard live data", dashboardLive],
  ["dashboard mock data", dashboardMock],
  ["operations command center", operations],
] as const) {
  assert.doesNotMatch(source, /["'`]\/team(?:["'`/?])/, `${name} must not expose the legacy Team route`);
}

assert.doesNotMatch(navigation, /id: "route-team"/, "Orion must not expose Team as a second canonical workspace");
assert.match(navigation, /aliases: \["crew", "crews", "team", "teams", "team crews", "company team"\]/, "Team language resolves to the canonical Crew workspace");
assert.match(legacyTeamPage, /redirect\("\/crews"\)/, "Legacy /team remains a compatibility redirect only");

console.log("+ B.O.S. UI consistency: canonical project tabs and workforce routes are deduplicated");
