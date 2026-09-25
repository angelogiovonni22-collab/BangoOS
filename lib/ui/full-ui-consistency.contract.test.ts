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
const plansRedirect = read("app/(app)/projects/[id]/plans/page.tsx");
const orionCommandCenter = read("lib/orion/command-center/service.ts");
const projectReadouts = read("lib/orion/commands/project-operational-readouts.ts");
const businessGraph = read("components/business-graph/RelationshipEngine.ts");
const sitecamWorkspace = read("app/(app)/projects/[id]/components/sitecam-workspace.tsx");
const sitecamPanel = read("components/projects/workspace/project-work-sitecam-panel.tsx");

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

assert.match(plansRedirect, /\?tab=blueprints/, "Legacy project Plans route opens the canonical Blueprints tab");
for (const staleTab of ["tab=plans", "tab=budget", "tab=timeline", "tab=health", "tab=change-orders", "tab=trade-partners"]) {
  assert.doesNotMatch(orionCommandCenter + projectReadouts + tradePartners, new RegExp(staleTab), `stale project tab ${staleTab} is not exposed`);
}
assert.match(orionCommandCenter, /tab=financials/, "Orion Budget shortcut opens Financials");
assert.match(orionCommandCenter, /tab=activity/, "Orion Timeline shortcut opens Activity");
assert.match(projectReadouts, /tab=change_orders/, "project operational readout opens canonical Change Orders tab");
assert.doesNotMatch(businessGraph, /label: "Photos"[^\n]+tab=documents/, "business graph Photos nodes do not open Documents");
assert.match(businessGraph, /label: "Photos"[^\n]+tab=photos/, "business graph Photos nodes open Photos");
assert.doesNotMatch(sitecamWorkspace + sitecamPanel, /tab=documents/, "SiteCam project links no longer send users to Documents");
assert.match(sitecamWorkspace + sitecamPanel, /tab=photos/, "SiteCam project links open Photos");

console.log("+ B.O.S. UI consistency: canonical tabs, workforce routes, and photo destinations are deduplicated");
