import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const timeline = readFileSync("components/projects/workspace/project-work-operations-timeline.tsx", "utf8");

assert.match(timeline, /loadDailyLogEvents/);
assert.match(timeline, /reference_entity", "daily_report"/);
assert.match(timeline, /payload->>project_id/);
assert.match(timeline, /loadInspectionEvents/);
assert.match(timeline, /from\("project_inspections"\)/);
assert.match(timeline, /dailyLogEvents/);
assert.match(timeline, /inspectionEvents/);

console.log("Project Work live operations feed contract passed.");
