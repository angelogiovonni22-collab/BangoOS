import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateProjectCloseoutReadiness } from "./project-closeout-readiness";
import { calculateProjectComplianceReadiness } from "./project-compliance-readiness";
import { calculateProjectExecutionReadiness } from "./project-execution-readiness";

const root = process.cwd();
const migration = readFileSync(resolve(root, "supabase/migrations/20260824050000_estimate_approved_project_workspace_bootstrap.sql"), "utf8");
const projectPage = readFileSync(resolve(root, "app/(app)/projects/[id]/page.tsx"), "utf8");
const panel = readFileSync(resolve(root, "components/projects/workspace/project-operating-system-panel.tsx"), "utf8");
const commandCenter = readFileSync(resolve(root, "components/projects/workspace/project-command-center-foundation.tsx"), "utf8");
const redesignedOverview = readFileSync(resolve(root, "components/projects/workspace/project-overview-command-center.tsx"), "utf8");
const workWorkspace = readFileSync(resolve(root, "components/projects/workspace/project-work-workspace.tsx"), "utf8");
const superintendentBriefing = readFileSync(resolve(root, "components/projects/workspace/project-superintendent-briefing.tsx"), "utf8");

assert.match(migration, /pg_advisory_xact_lock/, "workspace bootstrap must serialize concurrent retries");
assert.match(migration, /partition by lower\(btrim\(s\.name\)\)/, "estimate section phase names must be deduplicated deterministically");
assert.match(migration, /order by s\.sort_order, s\.id/, "duplicate section selection must preserve exact deterministic ordering");
assert.match(migration, /'Pre-Construction', 100[\s\S]*'Execution', 200[\s\S]*'Closeout', 300/, "fallback phase order must be Pre-Construction, Execution, Closeout");
assert.match(migration, /project\.workspace_bootstrapped/, "the canonical workspace bootstrap event must be recorded");
assert.match(migration, /on conflict \(company_id, event_type, idempotency_key\)/, "bootstrap event retries must be idempotent");
assert.match(migration, /after insert or update of status, project_id, converted_project_id/, "approved conversions must trigger workspace bootstrap automatically");
assert.match(migration, /revoke all on function public\.bootstrap_estimate_project_workspace\(uuid, uuid\) from public, anon, authenticated/, "workspace bootstrap must be server-only");
assert.match(projectPage, /<ProjectOverviewCommandCenter/, "the project workspace must render the project-centered B.O.S. overview command center");
assert.match(projectPage, /permitsOpen=\{workspace\.counts\.openPermits\}/, "the project overview must receive live permit signals");
assert.match(projectPage, /pendingInspections=\{workspace\.counts\.pendingInspections\}/, "the project overview must receive live inspection signals");
assert.match(projectPage, /openPunchItems=\{workspace\.counts\.openPunchItems\}/, "the project overview must receive live punch-list signals");
assert.match(projectPage, /closeoutStatusLabel=\{closeoutStatusLabel\}/, "the redesigned project overview must receive the live closeout workflow status");
assert.match(projectPage, /closeoutReady=\{closeoutReady\}/, "the redesigned project overview must receive deterministic closeout readiness");
assert.match(panel, /Operating Score/);
assert.match(panel, /Delivery Risk/);
assert.match(panel, /Budget Remaining/);
assert.match(panel, /Workflow Coverage/);
assert.match(panel, /Orion Recommended Actions/);
assert.match(panel, /Compliance Readiness/);
assert.match(panel, /Execution Readiness/);
assert.match(panel, /Next operating action/);
assert.match(panel, /data-testid="project-execution-readiness"/);
assert.match(commandCenter, /Closeout Readiness/);
assert.match(commandCenter, /Next closeout action/);
assert.match(commandCenter, /data-testid="project-closeout-readiness"/);
assert.equal(calculateProjectComplianceReadiness({ permitsTotal: 1, openPermits: 0, inspectionsTotal: 1, pendingInspections: 0, documentsTotal: 1 }).status, "Ready");
assert.equal(calculateProjectComplianceReadiness({ permitsTotal: 0, openPermits: 0, inspectionsTotal: 0, pendingInspections: 0, documentsTotal: 0 }).status, "Setup required");
assert.equal(calculateProjectExecutionReadiness({ complianceScore: 100, overdueTasks: 0, blockedTasks: 0, activeTasks: 1, documentationPresent: true }).status, "Ready");
assert.equal(calculateProjectExecutionReadiness({ complianceScore: 10, overdueTasks: 0, blockedTasks: 0, activeTasks: 0, documentationPresent: false }).nextAction, "compliance");
assert.equal(calculateProjectCloseoutReadiness({ closeoutStarted: false, closeoutReady: false, projectProgress: 0, openPunchItems: 0, pendingInspections: 0, openPermits: 0 }).nextAction, "start_closeout");
assert.equal(calculateProjectCloseoutReadiness({ closeoutStarted: true, closeoutReady: true, projectProgress: 100, openPunchItems: 0, pendingInspections: 0, openPermits: 0 }).status, "Ready");

console.log("project workspace bootstrap contract passed");

assert.match(projectPage, /projectStatus=\{project\.status \|\| ""\}/, "project overview must receive the canonical project status");
assert.match(redesignedOverview, /const projectCompleted = normalizeStatus\(props\.projectStatus\) === "completed"/, "redesigned overview must derive completion from canonical project status");
assert.match(redesignedOverview, /projectCompleted \? 100/, "completed projects must render 100 percent progress in the redesigned overview");
assert.match(redesignedOverview, /Closeout checklist required/, "completed projects without closeout readiness must surface a closeout requirement in the redesigned overview");
assert.match(redesignedOverview, /Schedule Not Established/, "unscheduled projects must use a dedicated schedule empty state instead of a misleading milestone track");
assert.match(redesignedOverview, /Project Setup/, "missing project setup fields must be grouped into an intentional setup notice");
assert.match(redesignedOverview, /Recent Project Media/, "overview media must not imply every project image is a field photo");
assert.match(redesignedOverview, /grid gap-3 sm:grid-cols-2 lg:grid-cols-3/, "workforce metrics must use readable multi-row layout rather than five cramped columns");
assert.match(redesignedOverview, /Projected Gross Margin/, "financial overview must label projected profitability explicitly");
assert.match(commandCenter, /const projectCompleted = status\(props\.projectStatus\) === "completed"/, "completed projects must drive completed overview semantics");
assert.match(commandCenter, /projectCompleted \? 100/, "completed projects must render 100 percent project progress even when task history is empty");
assert.match(commandCenter, /Project marked complete/, "completed projects with zero tasks must not render 0 of 0 as incomplete work");
assert.match(commandCenter, /Closeout checklist required/, "completed projects without a closeout record must surface the closeout checklist requirement");
assert.match(panel, /Project execution is complete/, "completed projects must not receive active execution recommendations");
assert.match(panel, /Records incomplete/, "completed projects with missing historical compliance records must not be presented as active setup blockers");

const newProject = readFileSync(resolve(root, "app/(app)/projects/new/page.tsx"), "utf8");
assert.match(newProject, /PROJECT_STATUSES\.filter\(\(option\) => !\["completed", "cancelled"\]\.includes\(option\.value\)\)/, "new projects cannot be created directly in terminal statuses");

const completionRoute = readFileSync(resolve(root, "app/api/projects/[id]/complete/route.ts"), "utf8");
assert.match(completionRoute, /actual_end_date: now\.slice\(0, 10\)/, "canonical project completion records the actual completion date");
assert.match(completionRoute, /startCloseout/, "canonical project completion initializes the closeout workflow");

const orionHandlers = readFileSync(resolve(root, "lib/orion/commands/handlers.ts"), "utf8");
assert.match(orionHandlers, /projectPatch\.actual_end_date = statusUpdatedAt\.slice\(0, 10\)/, "Orion completion records the actual completion date");
assert.match(orionHandlers, /project-closeout/, "Orion completion initializes closeout");

const invoiceService = readFileSync(resolve(root, "lib/invoices/service.ts"), "utf8");
assert.match(invoiceService, /ensureProjectCompletionInvoice/, "invoice service must expose automatic completion invoice creation");
assert.match(invoiceService, /Final Invoice -/, "completion invoice must be created as a final draft invoice");
assert.match(invoiceService, /status: "draft"/, "completion invoice must remain draft until the user sends it");
assert.match(invoiceService, /previouslyInvoiced/, "completion invoice must account for prior project invoices such as deposits");
assert.match(invoiceService, /change_order_invoice_links/, "approved uninvoiced change orders must be linked into the completion invoice");

assert.match(completionRoute, /ensureProjectCompletionInvoice/, "canonical project completion must create or reuse a draft completion invoice");
assert.match(orionHandlers, /ensureProjectCompletionInvoice/, "Orion project completion must create or reuse a draft completion invoice");

assert.match(workWorkspace, /const isProjectCompleted = normalizeStatus\(projectStatus\) === "completed"/, "Tasks workspace must derive completed state from the canonical project status");
assert.match(workWorkspace, /completionPercent: 100/, "completed project Tasks snapshot must render 100 percent completion");
assert.match(workWorkspace, /recommendedActions: \[\]/, "completed project Tasks view must suppress active execution recommendations");
assert.match(workWorkspace, /workCompletedTitle/, "completed projects must replace the active phase board with a closeout-safe completed state");
assert.doesNotMatch(workWorkspace, /<StaggerGroup className="grid min-w-0 gap-6 xl:grid-cols/, "Tasks layout must not rely on StaggerGroup wrappers for grid column spans");
assert.match(workWorkspace, /xl:col-span-2 lg:grid-cols-2/, "active Tasks lower workspace must reflow full width below the execution board");
assert.match(superintendentBriefing, /briefingRisksCompletedState/, "completed Tasks briefing must not tell users to continue active project execution");

assert.match(workWorkspace, /executiveSummaryKey: "briefingCompletedSummary"/, "completed Tasks briefing must not prompt users to start or schedule execution work");
