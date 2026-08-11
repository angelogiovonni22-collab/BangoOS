import fs from "node:fs";
import path from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const projectPage = fs.readFileSync(path.join(root, "app/(app)/projects/[id]/page.tsx"), "utf8");
const tabs = fs.readFileSync(path.join(root, "components/projects/workspace/project-workspace-tabs.ts"), "utf8");
const navigation = fs.readFileSync(path.join(root, "lib/orion/navigation/catalog.ts"), "utf8");
const blueprintsPage = fs.readFileSync(path.join(root, "app/(app)/blueprints/page.tsx"), "utf8");
const planRoom = fs.readFileSync(path.join(root, "lib/blueprints/plan-room.ts"), "utf8");
const uploadPanel = fs.readFileSync(path.join(root, "components/plans/blueprint-upload-panel.tsx"), "utf8");
const revisionPanel = fs.readFileSync(path.join(root, "components/plans/blueprint-revision-panel.tsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260812090000_blueprints_plan_room_foundation.sql"), "utf8");
const membershipAlignment = fs.readFileSync(path.join(root, "supabase/migrations/20260812103000_blueprints_membership_rls_alignment.sql"), "utf8");

assert(tabs.includes('key: "blueprints"'), "Project workspace must expose a Blueprints tab");
assert(projectPage.includes('activeTab === "blueprints"'), "Project workspace must render the Blueprint Plan Room");
assert(projectPage.includes("<PlansWorkspace"), "Blueprints must reuse the existing plans foundation");
assert(navigation.includes('href: "/blueprints"'), "The BOS and Orion route catalog must include Blueprints");
assert(navigation.includes('routeId: "route-blueprints"'), "Orion must recognize Blueprint navigation language");
assert(blueprintsPage.includes("company_id"), "Company plan-room discovery must be tenant-scoped");
assert(blueprintsPage.includes("?tab=blueprints"), "Global plan-room entries must deep-link to the project Blueprints tab");
assert(planRoom.includes('BLUEPRINTS_BUCKET = "blueprints"'), "Blueprint files must use the private Blueprint bucket");
assert(planRoom.includes("validateBlueprintFile"), "Blueprint uploads must be type and size validated");
assert(planRoom.includes("createSignedUrls"), "Blueprint previews must use expiring signed URLs");
assert(planRoom.includes("storagePath") && planRoom.includes(".remove([storagePath])"), "Failed metadata writes must clean up uploaded files");
assert(uploadPanel.includes('data-orion-region="blueprint-upload"'), "The upload workflow must expose semantic Orion context");
assert(uploadPanel.includes('data-orion-action="') === false, "The upload form must not introduce ambiguous duplicate Orion actions");
assert(revisionPanel.includes("uploadBlueprintRevision"), "Existing sheets must support new revision uploads");
assert(migration.includes("create table public.blueprint_sets"), "Blueprint plan sets must be persisted");
assert(migration.includes("create table public.blueprint_sheets"), "Blueprint sheets must be persisted");
assert(migration.includes("create table public.blueprint_versions"), "Blueprint revision records must be persisted");
assert(migration.includes("enable row level security"), "Blueprint records must enable RLS");
assert(migration.includes("public.blueprint_member_of_company"), "Blueprint RLS must enforce company membership");
assert(migration.includes("register_blueprint_revision"), "Revision registration must be transactional");
assert(migration.includes("set status = 'superseded'"), "A new revision must supersede the previous working version");
assert(migration.includes("public = excluded.public") && migration.includes("false, 104857600"), "The Blueprint bucket must remain private and size-limited");
assert(membershipAlignment.includes("public.is_company_member(tenant_id)"), "Blueprint RLS must use active multi-company membership");
assert(membershipAlignment.includes("drop policy if exists blueprints_storage_insert"), "The legacy storage insert policy must be replaced");
assert(membershipAlignment.includes("project.id::text = (storage.foldername(name))[2]"), "Storage writes must remain project-scoped");

console.log("BOS Blueprints Phase 1 navigation foundation contract passed");
