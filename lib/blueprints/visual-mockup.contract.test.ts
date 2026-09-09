import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BLUEPRINT_VISUAL_DISCLAIMER, BLUEPRINT_VISUAL_PROMPT_VERSION, buildBlueprintVisualPrompt, normalizeBlueprintVisualOptions } from "./visual-mockup";
import { createEmptyBosBuildingGraph } from "./engine/building-graph";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const route = read("app/api/blueprints/[versionId]/visual-mockup/route.ts");
const service = read("lib/blueprints/visual-mockup.ts");
const migration = read("supabase/migrations/20260909060000_blueprint_visual_mockups.sql");
const control = read("components/plans/blueprint-visual-mockup-control.tsx");
const preview = read("components/plans/plans-preview.tsx");
const nextConfig = read("next.config.ts");

const graph = createEmptyBosBuildingGraph({ buildingId: "visual-test", sourcePage: 2, sourceSheetTitle: "FIRST FLOOR PLAN" });
graph.validation.status = "needs_review";
graph.rooms.push({ id: "garage", levelId: "level-1", type: "room", name: "Garage", polygon: { points: [] }, confidence: 0.7, sourcePage: 2, evidence: [], provenance: { createdBy: "deterministic", algorithm: "test", algorithmVersion: "1", evidenceIds: [] } });
const prompt = buildBlueprintVisualPrompt({ sheetIdentity: "A1 · FIRST FLOOR PLAN", sourcePage: 2, options: normalizeBlueprintVisualOptions({ furnished: false, style: "monochrome" }), graph });
assert(prompt.includes("selected source page: 2") && prompt.includes('"garagePresent":true'), "Locked prompt must bind the selected page and include Building Graph facts");
assert(prompt.includes("Do not invent another floor") && prompt.includes("No roof, labels, dimensions, people"), "Locked prompt must prohibit unsupported geometry and presentation artifacts");
assert.equal(BLUEPRINT_VISUAL_PROMPT_VERSION, "bos-blueprint-visual-v1");
assert.equal(BLUEPRINT_VISUAL_DISCLAIMER, "Conceptual AI visualization — verify against the source plans before construction use.");

assert(route.includes("createClient") && route.includes("resolveWorkspaceContext") && route.includes('.eq("company_id", workspace.context.companyId)'), "Visual API must authenticate and tenant-scope source access");
assert(route.includes('.eq("source_version_id", source.id)') && route.includes("source_page") && route.includes("renderBlueprintPdfPage"), "Generation must bind the canonical model, revision and selected page");
assert(route.includes("building_graph") && route.includes("buildBlueprintVisualPrompt") && route.includes('model.engine_status === "needs_review"'), "A needs-review graph must remain contextual evidence without being promoted to technical readiness");
assert(route.includes("randomUUID") && route.includes("blueprint_visual_mockups") && route.includes("visual-mockups"), "Each regeneration must create an immutable record and unique private object");
assert(route.includes("createSignedUrl") && !control.includes("OPENAI_API_KEY"), "The UI must receive a signed private URL and no provider credential");
assert(service.includes("process.env.OPENAI_API_KEY") && service.includes("/v1/images/edits") && service.includes("AbortSignal.timeout"), "Image generation must run server-side with a bounded provider call");
assert(nextConfig.includes('"/api/blueprints/*/visual-mockup"') && nextConfig.includes("pdf.worker.mjs"), "Production output tracing must include the selected-page PDF worker");

assert(migration.includes("create table public.blueprint_visual_mockups") && migration.includes("enable row level security"), "Visual mockups require tenant-scoped persistence with RLS");
assert(migration.includes("foreign key (source_version_id, company_id, project_id)") && migration.includes("blueprints_visual_mockup_storage_select"), "Persistence and private storage must bind revision/company/project identity");
assert(migration.includes("protect_blueprint_visual_mockup_identity") && migration.includes("generated_model_id is null or exists"), "Identity and optional technical model context must remain tenant coherent");
assert(migration.includes(BLUEPRINT_VISUAL_DISCLAIMER), "The construction-use disclaimer must persist with every record");

assert(preview.includes("BlueprintVisualMockupControl"), "The selected Blueprint preview must surface the visual mockup control");
assert(control.includes("Generate Visual Mockup") && control.includes("Regenerate") && control.includes("Download") && control.includes("View source plan"), "UI must expose the complete visual mockup workflow");
assert(control.includes(BLUEPRINT_VISUAL_DISCLAIMER) && control.includes('data-orion-region="blueprint-ai-visual-mockup"'), "UI must expose the safety boundary and Orion semantics");
assert(control.includes("architectural") && control.includes("warm-modern") && control.includes("monochrome") && control.includes("Furnished for scale"), "UI must provide only the scoped presentation options");

console.log("Blueprint AI Visual Mockup contract passed");
