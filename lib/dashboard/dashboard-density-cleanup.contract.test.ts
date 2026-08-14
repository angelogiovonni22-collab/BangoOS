import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const page = read("../../app/(app)/dashboard/page.tsx");
const layout = read("./use-dashboard-layout.ts");
const activity = read("../../components/dashboard/ActivityFeed.tsx");
const decisions = read("../../components/dashboard/DecisionWidgets.tsx");

assert.match(layout, /bangoos\.dashboard\.layout\.v2/, "density defaults must use a new persistence version");
assert.match(layout, /collapsed: \[/, "secondary dashboard regions must support compact defaults");
assert.match(page, /toggleWidgetCollapsed\(widgetId\)/, "expanded widgets must expose direct collapse controls");
assert.match(page, /dashboard\.collapse/, "the direct collapse control must be accessible and translated");
assert.match(activity, /useState\(5\)/, "recent activity must start with five items");
assert.doesNotMatch(activity, /IntersectionObserver/, "scrolling must not silently expand the activity feed");
assert.match(decisions, /props\.items\.slice\(0, 4\)/, "decision lists must be progressively disclosed");
assert.match(decisions, /View all/, "limited decision lists must retain access to all records");

console.log("Dashboard density cleanup contract passed");
