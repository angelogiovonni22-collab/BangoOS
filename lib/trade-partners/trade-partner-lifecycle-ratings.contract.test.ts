import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const lifecycleUi = read("components/projects/workspace/subcontractor-lifecycle-actions.tsx");
const tradePartnerWorkspace = read("components/projects/workspace/project-trade-partners-workspace.tsx");
const projectHeader = read("components/projects/workspace/project-workspace-header.tsx");
const lifecycleApi = read("app/api/projects/[id]/subcontractors/[assignmentId]/lifecycle/route.ts");
const projectCompleteApi = read("app/api/projects/[id]/complete/route.ts");
const lifecycleMigration = read("supabase/migrations/20260829043000_trade_partner_lifecycle_ratings.sql");
const replacementMigration = read("supabase/migrations/20260829043100_trade_partner_replacement_helper.sql");
const deleteGuardMigration = read("supabase/migrations/20260829043200_trade_partner_delete_guard_fix.sql");
const archiveGuardAlignment = read("supabase/migrations/20260829051500_trade_partner_lifecycle_archive_guard_alignment.sql");

assert.match(lifecycleUi, /End Assignment/);
assert.match(lifecycleUi, /Remove from Project/);
assert.match(lifecycleUi, /Replace Trade Partner/);
assert.match(lifecycleUi, /Terminate \/ Fire/);
assert.match(lifecycleUi, /Delete Mistaken Assignment/);
assert.match(lifecycleUi, /Rate Trade Partner/);
assert.match(lifecycleUi, /Quality/);
assert.match(lifecycleUi, /Schedule Reliability/);
assert.match(lifecycleUi, /Communication/);
assert.match(lifecycleUi, /Safety \/ Compliance/);
assert.match(lifecycleUi, /Professionalism/);
assert.match(lifecycleUi, /Do Not Rehire/);

assert.doesNotMatch(tradePartnerWorkspace, />Archive</);
assert.match(tradePartnerWorkspace, /performanceRating/);
assert.match(tradePartnerWorkspace, /Do Not Rehire/);
assert.match(tradePartnerWorkspace, /Assign Trade Partner/);

assert.match(projectHeader, /Project Complete/);
assert.match(projectHeader, /automatically remove this project from active Trade Partner portals/);
assert.match(projectCompleteApi, /status: "completed"/);
assert.match(projectCompleteApi, /actual_end_date/);

assert.match(lifecycleApi, /manage_trade_partner_assignment_lifecycle/);
assert.match(lifecycleApi, /replace_trade_partner_assignment_with_vendor/);
assert.match(lifecycleApi, /submit_trade_partner_performance_review/);
assert.match(lifecycleApi, /delete_mistaken_trade_partner_assignment/);

assert.match(lifecycleMigration, /lifecycle_status/);
assert.match(lifecycleMigration, /project_completed/);
assert.match(lifecycleMigration, /trade_partner_performance_reviews/);
assert.match(lifecycleMigration, /performance_rating/);
assert.match(lifecycleMigration, /rehire_status/);
assert.match(lifecycleMigration, /projects_close_trade_partner_access/);
assert.match(lifecycleMigration, /tpa\.lifecycle_status='active'/);
assert.match(lifecycleMigration, /p\.status <> 'completed'/);
assert.match(replacementMigration, /v_assignment\.trade_name, v_assignment\.scope_of_work/);
assert.match(replacementMigration, /replace_trade_partner_assignment_with_vendor/);
assert.match(deleteGuardMigration, /trade_partner_messages/);
assert.match(deleteGuardMigration, /project_id=v_assignment\.project_id/);

assert.match(archiveGuardAlignment, /when contract_status = 'signed' then 'closed'/i);
assert.match(archiveGuardAlignment, /when contract_status in \('draft','pending_signature'\) then 'cancelled'/i);
assert.match(archiveGuardAlignment, /replace_trade_partner_assignment_with_vendor/);
assert.match(archiveGuardAlignment, /close_trade_partner_access_when_project_completed/);
assert.match(archiveGuardAlignment, /assignment_status = 'archived'/);

console.log("Trade Partner lifecycle, replacement, project completion, ratings, and signed archive guard contract passed.");
