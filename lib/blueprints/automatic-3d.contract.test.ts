import fs from "node:fs";
import path from "node:path";
import "../../components/plans/blueprint-graph-review.contract.test";
import "./engine/control.contract.test";
import "./engine/engine.contract.test";
import "./engine/openings.contract.test";
import "./engine/room-tracing.contract.test";
import "./engine/wall-detector.contract.test";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "app/api/blueprints/[versionId]/generate-3d/route.ts"), "utf8");
const reconstruct = fs.readFileSync(path.join(root, "lib/blueprints/engine/reconstruct.ts"), "utf8");
const raster = fs.readFileSync(path.join(root, "lib/blueprints/engine/raster.ts"), "utf8");
const service = fs.readFileSync(path.join(root, "lib/blueprints/automatic-3d.ts"), "utf8");
const control = fs.readFileSync(path.join(root, "components/plans/blueprint-auto-3d-control.tsx"), "utf8");
const preview = fs.readFileSync(path.join(root, "components/plans/plans-preview.tsx"), "utf8");
const upload = fs.readFileSync(path.join(root, "components/plans/blueprint-upload-panel.tsx"), "utf8");
const revision = fs.readFileSync(path.join(root, "components/plans/blueprint-revision-panel.tsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260908004500_automatic_blueprint_to_3d.sql"), "utf8");
const correctionMigration = fs.readFileSync(path.join(root, "supabase/migrations/20260908040000_blueprint_engine_corrections.sql"), "utf8");
const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");

assert(migration.includes("create table if not exists public.blueprint_generated_models"), "Generated 3D models must have a tenant-scoped persistence record");
assert(migration.includes("enable row level security") && migration.includes("blueprint_member_of_company"), "Generated model records must remain behind company RLS");
assert(migration.includes("blueprints_generated_model_storage_select"), "Generated GLB storage must be authorized through its generated-model record");
assert(correctionMigration.includes("blueprint_model_corrections") && correctionMigration.includes("Append-only user corrections"), "Native graph corrections must have append-only persistence");
assert(correctionMigration.includes("enable row level security") && correctionMigration.includes("blueprint_member_of_company"), "Persisted graph corrections must remain behind company RLS");
assert(nextConfig.includes('serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"]'), "Production must load pdfjs and its sibling worker from the installed server package");
assert(route.includes("OPENAI_API_KEY") && route.includes("input_file"), "PDF reconstruction must retain server-side multimodal fallback support");
assert(route.includes("reconstructNativeBlueprint") && route.includes("buildBosBuildingGraphGlb"), "Registered PDFs must route through the native B.O.S. Building Graph reconstruction path");
assert(route.includes("blueprint_model_corrections") && route.includes("replayPersistedBosGraphCorrections"), "Native regeneration must load and replay persisted graph corrections");
assert(route.includes("latestPersistedManualScale") && route.includes("manualDrawingUnitsPerMeter"), "A persisted manual scale must be applied before deterministic native geometry conversion");
assert(route.indexOf("replayPersistedBosGraphCorrections") < route.indexOf("buildBosBuildingGraphGlb(graph)"), "Corrections must replay before native GLB generation");
assert(route.includes("correction_history") && route.includes("correctionHistory"), "Generated model persistence must retain correction history across regeneration");
assert(reconstruct.includes("extractRasterLineSegments") && reconstruct.includes("summary.rasterRequired || wallCandidates.length < 8"), "Vector-poor PDFs must attempt the deterministic raster fallback before being withheld");
assert(reconstruct.includes("sourceWidth: summary.page.width") && reconstruct.includes("sourceHeight: summary.page.height"), "Raster fallback must map the selected raster page back to deterministic PDF coordinates");
assert(reconstruct.includes("traceWallBoundedRooms") && reconstruct.includes("graph.rooms = traceWallBoundedRooms(graph)"), "Native reconstruction must promote closed wall faces into deterministic room polygons");
assert(raster.includes("page: isPdf ? undefined : Math.max(0, page - 1)") && raster.includes("density: options.density"), "Raster decoding must target the selected image page and avoid re-applying PDF page selection after pdfjs rendering");
assert(raster.includes("sourcePerPixelX") && raster.includes("drawingToMeters"), "Raster candidate coordinates must normalize through PDF drawing units before entering wall detection");
assert(raster.includes("renderPdfPage") && raster.includes("@napi-rs/canvas"), "Raster fallback must render the selected PDF page through the pdfjs Node canvas path before Sharp line extraction");
assert(reconstruct.includes("dominantRasterWallCluster") && reconstruct.includes("Raster structural clustering retained"), "Raster fallback must discard disconnected sheet/title-block wall clusters before graph promotion");
assert(route.includes("model/gltf-binary") && route.includes("buildBlueprintGlb"), "Automatic reconstruction must emit a GLB consumable by the existing 3D viewer");
assert(route.includes("needs_input"), "Low-information plans must fail safely instead of pretending to be construction-authoritative");
assert(route.includes("blueprint_sheet_id") && route.includes("sheet_number,title,discipline"), "3D generation must load the registered Blueprint sheet metadata");
assert(route.includes("Reconstruct ONLY that matching drawing") && route.includes("do not replace these with a four-wall bounding rectangle"), "Multi-page fallback generation must target the registered drawing and preserve its real footprint");
assert(route.includes("shouldRunFidelityPass") && route.includes("FIRST PASS JSON"), "Complex fallback floor plans must receive a second fidelity pass when the first trace is too simple");
assert(route.includes("isObviouslyUnderTracedFloorPlan") && route.includes("intentionally withheld"), "B.O.S. must withhold obviously under-traced floor-plan models instead of labeling them 3D Ready");
assert(route.includes('searchParams.get("force") === "1"'), "Ready 3D models must support intentional regeneration after reconstruction improvements");
assert(service.includes("B.O.S. Automatic Blueprint-to-3D") && service.includes("Generated Floor"), "The generated GLB must identify its B.O.S. conceptual origin and include spatial geometry");
assert(control.includes("Generate 3D") && control.includes("View 3D") && control.includes("3D Ready"), "The Blueprint UI must expose generation, readiness, and 3D viewing states");
assert(control.includes("Regenerate 3D") && control.includes("?force=1"), "Ready Blueprint models must expose a regeneration control");
assert(control.includes("verify dimensions") || control.includes("verified before construction use"), "Generated models must disclose that dimensions require verification");
assert(preview.includes("BlueprintAuto3dControl"), "2D Blueprint previews must surface Automatic Blueprint-to-3D");
assert(upload.includes("generate-3d") && upload.includes("keepalive: true"), "New 2D Blueprint uploads must automatically start 3D generation");
assert(revision.includes("generate-3d") && revision.includes("automatically rebuild"), "New 2D revisions must automatically rebuild their conceptual 3D model");

console.log("Automatic Blueprint-to-3D contract passed");
