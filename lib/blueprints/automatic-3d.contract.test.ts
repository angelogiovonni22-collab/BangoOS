import fs from "node:fs";
import path from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "app/api/blueprints/[versionId]/generate-3d/route.ts"), "utf8");
const service = fs.readFileSync(path.join(root, "lib/blueprints/automatic-3d.ts"), "utf8");
const control = fs.readFileSync(path.join(root, "components/plans/blueprint-auto-3d-control.tsx"), "utf8");
const preview = fs.readFileSync(path.join(root, "components/plans/plans-preview.tsx"), "utf8");
const upload = fs.readFileSync(path.join(root, "components/plans/blueprint-upload-panel.tsx"), "utf8");
const revision = fs.readFileSync(path.join(root, "components/plans/blueprint-revision-panel.tsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260908004500_automatic_blueprint_to_3d.sql"), "utf8");

assert(migration.includes("create table if not exists public.blueprint_generated_models"), "Generated 3D models must have a tenant-scoped persistence record");
assert(migration.includes("enable row level security") && migration.includes("blueprint_member_of_company"), "Generated model records must remain behind company RLS");
assert(migration.includes("blueprints_generated_model_storage_select"), "Generated GLB storage must be authorized through its generated-model record");
assert(route.includes("OPENAI_API_KEY") && route.includes("input_file"), "PDF reconstruction must use server-side multimodal Blueprint analysis");
assert(route.includes("model/gltf-binary") && route.includes("buildBlueprintGlb"), "Automatic reconstruction must emit a GLB consumable by the existing 3D viewer");
assert(route.includes("needs_input"), "Low-information plans must fail safely instead of pretending to be construction-authoritative");
assert(service.includes("B.O.S. Automatic Blueprint-to-3D") && service.includes("Generated Floor"), "The generated GLB must identify its B.O.S. conceptual origin and include spatial geometry");
assert(control.includes("Generate 3D") && control.includes("View 3D") && control.includes("3D Ready"), "The Blueprint UI must expose generation, readiness, and 3D viewing states");
assert(control.includes("verify dimensions") || control.includes("verified before construction use"), "Generated models must disclose that dimensions require verification");
assert(preview.includes("BlueprintAuto3dControl"), "2D Blueprint previews must surface Automatic Blueprint-to-3D");
assert(upload.includes("generate-3d") && upload.includes("keepalive: true"), "New 2D Blueprint uploads must automatically start 3D generation");
assert(revision.includes("generate-3d") && revision.includes("automatically rebuild"), "New 2D revisions must automatically rebuild their conceptual 3D model");

console.log("Automatic Blueprint-to-3D contract passed");
