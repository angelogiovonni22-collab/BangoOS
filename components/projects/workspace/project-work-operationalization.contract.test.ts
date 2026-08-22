import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const projectPage = readFileSync("app/(app)/projects/[id]/page.tsx", "utf8");
const workspace = readFileSync("components/projects/workspace/project-work-workspace.tsx", "utf8");
const executionBoard = readFileSync("components/projects/workspace/project-work-execution-board.tsx", "utf8");
const operationsTimeline = readFileSync("components/projects/workspace/project-work-operations-timeline.tsx", "utf8");
const dailyReportPage = readFileSync("app/(app)/daily-reports/new/page.tsx", "utf8");
const dailyReportHook = readFileSync("lib/daily-reports/use-daily-report.ts", "utf8");

assert.match(projectPage, /activeTab === "tasks"[\s\S]*?<ProjectWorkWorkspace/);
assert.match(projectPage, /tasks=\{workspace\.tasks\}/);
assert.match(workspace, /\.from\("tasks"\)[\s\S]*?\.insert\(\{/);
assert.match(workspace, /company_id: companyId/);
assert.match(workspace, /project_id: projectId/);
assert.match(workspace, /phase_id: selectedPhaseId/);
assert.match(executionBoard, /filters\.status/);
assert.match(executionBoard, /filters\.assignee/);
assert.match(executionBoard, /filters\.search/);
assert.match(executionBoard, /filters\.sort/);
assert.match(workspace, /\/schedule\?projectId=\$\{projectId\}/);
assert.match(workspace, /\/daily-reports\/new\?projectId=\$\{projectId\}&projectName=/);
assert.match(workspace, /\?tab=inspections/);
assert.match(workspace, /#punch-list/);
assert.doesNotMatch(operationsTimeline, /\?tab=work/);
assert.match(dailyReportPage, /searchParams\.get\("projectId"\)/);
assert.match(dailyReportHook, /projectId: initialProjectId/);

console.log("Project Work operationalization contract passed.");
