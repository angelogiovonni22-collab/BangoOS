import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BLUEPRINT_VISUAL_DISCLAIMER, BLUEPRINT_VISUAL_PROMPT_VERSION, buildBlueprintVisualPrompt, buildBlueprintWallDistanceSchedule, formatMetersAsFeetInches, normalizeBlueprintVisualOptions } from "./visual-mockup";
import { createEmptyBosBuildingGraph } from "./engine/building-graph";
import { buildBosBuildingGraphGlb } from "./engine/graph-to-glb";
import { BLUEPRINT_GEOMETRY_LOCK_VERSION, assessBlueprintFidelity, renderBlueprintGeometryLock } from "./geometry-lock";

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
assert.equal(BLUEPRINT_VISUAL_PROMPT_VERSION, "bos-blueprint-visual-v2-geometry-lock");
assert.equal(BLUEPRINT_VISUAL_DISCLAIMER, "Conceptual AI visualization — verify against the source plans before construction use.");

assert(route.includes("createClient") && route.includes("resolveWorkspaceContext") && route.includes('.eq("company_id", workspace.context.companyId)'), "Visual API must authenticate and tenant-scope source access");
assert(route.includes('.eq("source_version_id", source.id)') && route.includes("source_page") && route.includes("renderBlueprintPdfPage"), "Generation must bind the canonical model, revision and selected page");
assert(route.includes("building_graph") && route.includes("buildBlueprintVisualPrompt") && route.includes('model.engine_status === "needs_review"'), "A needs-review graph must remain contextual evidence without being promoted to technical readiness");
assert(route.includes("randomUUID") && route.includes("blueprint_visual_mockups") && route.includes("visual-mockups"), "Each regeneration must create an immutable record and unique private object");
assert(route.includes("createSignedUrl") && !control.includes("OPENAI_API_KEY"), "The UI must receive a signed private URL and no provider credential");
assert(service.includes("process.env.OPENAI_API_KEY") && service.includes("/v1/images/edits") && service.includes("AbortSignal.timeout"), "Image generation must run server-side with a bounded provider call");
assert(service.includes('input_fidelity", "high"') && service.includes("geometryLockImage") && service.includes("gpt-image-2.5-sunburst"), "Generation must use the geometry lock and highest-fidelity current image editor");
assert(route.includes("assessBlueprintFidelity") && route.includes("renderBlueprintGeometryLock") && route.includes("geometryLocked: true"), "Generation must fail closed and persist geometry-lock evidence");
assert.equal(assessBlueprintFidelity(graph, 2).allowed, false, "A needs-review graph must be blocked from layout-faithful generation");
assert.equal(BLUEPRINT_GEOMETRY_LOCK_VERSION, "bos-geometry-lock-v1");

const readyGraph = createEmptyBosBuildingGraph({ buildingId: "geometry-lock-test", sourcePage: 2 });
const wallPoints = [
  [{ x: 0, y: 0 }, { x: 5, y: 0 }], [{ x: 5, y: 0 }, { x: 10, y: 0 }],
  [{ x: 10, y: 0 }, { x: 10, y: 4 }], [{ x: 10, y: 4 }, { x: 10, y: 8 }],
  [{ x: 10, y: 8 }, { x: 5, y: 8 }], [{ x: 5, y: 8 }, { x: 0, y: 8 }],
  [{ x: 0, y: 8 }, { x: 0, y: 4 }], [{ x: 0, y: 4 }, { x: 0, y: 0 }],
] as const;
readyGraph.walls = wallPoints.map(([start, end], index) => ({ id: `wall-${index}`, levelId: "level-1", type: "exterior", centerline: { start, end }, thickness: 0.15, height: 2.7, confidence: 0.95, sourcePage: 2, evidence: [], provenance: { createdBy: "deterministic", algorithm: "test", algorithmVersion: "1", evidenceIds: [] } }));
readyGraph.confidence = 0.9;
readyGraph.scale = { source: "printed", drawingUnitsPerMeter: 100, confidence: 0.95 };
readyGraph.validation = { version: 1, score: 0.9, status: "reconstructed", metrics: { exteriorClosure: 1, footprintComplexity: 0.8, wallTopology: 1, scaleConfidence: 0.95, semanticCoverage: 0.8 }, issues: [] };
assert.equal(assessBlueprintFidelity(readyGraph, 2).allowed, true, "A validated closed graph must pass the fidelity gate");
const wallDistances = buildBlueprintWallDistanceSchedule(readyGraph);
assert.equal(wallDistances.available, true, "A reconstructed graph with verified scale must expose wall distances");
assert.equal(wallDistances.reviewRequired, false);
assert.equal(wallDistances.walls.length, 8);
assert.equal(wallDistances.walls[0]?.lengthImperial, "16'-4 7/8\"");
assert.equal(formatMetersAsFeetInches(3.048), "10'-0\"");

const reviewGraph = structuredClone(readyGraph);
reviewGraph.validation.status = "needs_review";
reviewGraph.validation.score = 0.7;
const reviewDistances = buildBlueprintWallDistanceSchedule(reviewGraph);
assert.equal(reviewDistances.available, true, "A needs-review graph with independently verified scale must still expose provisional wall distances for correction review");
assert.equal(reviewDistances.reviewRequired, true, "Needs-review wall distances must remain explicitly review-gated");
assert(reviewDistances.reason?.includes("topology"), "Review-gated wall distances must explain the topology safety boundary");

const untrustedScale = structuredClone(readyGraph);
untrustedScale.scale.source = "unknown";
untrustedScale.scale.confidence = 0;
assert.equal(buildBlueprintWallDistanceSchedule(untrustedScale).available, false, "Unverified scale must never produce wall distances");
const underStandard = structuredClone(readyGraph);
underStandard.validation.metrics.wallTopology = 0.79;
underStandard.validation.metrics.exteriorClosure = 0.74;
underStandard.validation.metrics.scaleConfidence = 0.89;
underStandard.validation.metrics.semanticCoverage = 0.69;
const underStandardGate = assessBlueprintFidelity(underStandard, 2);
assert.equal(underStandardGate.allowed, false, "A graph below production thresholds must not generate a geometry-locked visual");
assert(underStandardGate.blockers.some((blocker) => blocker.includes("80% production standard")), "Topology blocker must expose the production threshold");
assert(underStandardGate.blockers.some((blocker) => blocker.includes("75% production standard")), "Exterior blocker must expose the production threshold");
assert(underStandardGate.blockers.some((blocker) => blocker.includes("90% production standard")), "Scale blocker must expose the production threshold");
assert(underStandardGate.blockers.some((blocker) => blocker.includes("70% production standard")), "Semantic blocker must expose the production threshold");

const nativeGlb = buildBosBuildingGraphGlb(readyGraph);
const jsonChunkLength = nativeGlb.readUInt32LE(12);
const nativeGlbJson = JSON.parse(nativeGlb.subarray(20, 20 + jsonChunkLength).toString("utf8").trim()) as { nodes: Array<{ extras?: Record<string, unknown> }>; extras?: { bosBuildingGraph?: Record<string, unknown> } };
assert.equal(nativeGlbJson.nodes[0]?.extras?.wallLengthImperial, "16'-4 7/8\"", "Native GLB wall nodes must carry construction-style feet/inches dimensions for model inspection");
assert.equal(nativeGlbJson.extras?.bosBuildingGraph?.displayLengthUnit, "ft-in", "Native GLB metadata must declare the feet/inches display unit");

const geometryLockCheck = renderBlueprintGeometryLock(readyGraph).then((geometryLock) => {
  assert(geometryLock.length > 1000 && geometryLock.subarray(1, 4).toString() === "PNG", "Geometry lock must render as a non-empty PNG");
});
assert(nextConfig.includes('"/api/blueprints/*/visual-mockup"') && nextConfig.includes("pdf.worker.mjs"), "Production output tracing must include the selected-page PDF worker");

assert(migration.includes("create table public.blueprint_visual_mockups") && migration.includes("enable row level security"), "Visual mockups require tenant-scoped persistence with RLS");
assert(migration.includes("foreign key (source_version_id, company_id, project_id)") && migration.includes("blueprints_visual_mockup_storage_select"), "Persistence and private storage must bind revision/company/project identity");
assert(migration.includes("protect_blueprint_visual_mockup_identity") && migration.includes("generated_model_id is null or exists"), "Identity and optional technical model context must remain tenant coherent");
assert(migration.includes(BLUEPRINT_VISUAL_DISCLAIMER), "The construction-use disclaimer must persist with every record");

assert(preview.includes("BlueprintVisualMockupControl"), "The selected Blueprint preview must surface the visual mockup control");
assert(control.includes("Generate Visual Mockup") && control.includes("Regenerate") && control.includes("Download") && control.includes("View source plan"), "UI must expose the complete visual mockup workflow");
assert(control.includes("Wall distances") && control.includes("lengthImperial") && control.includes("blueprint-wall-distances"), "The visual mockup must expose verified wall distances in feet and inches");
assert(route.includes("buildBlueprintWallDistanceSchedule") && route.includes("generated_model_id"), "Wall distances must be derived server-side from the bound Building Graph");
assert(control.includes(BLUEPRINT_VISUAL_DISCLAIMER) && control.includes('data-orion-region="blueprint-ai-visual-mockup"'), "UI must expose the safety boundary and Orion semantics");
assert(control.includes("architectural") && control.includes("warm-modern") && control.includes("monochrome") && control.includes("Furnished for scale"), "UI must provide only the scoped presentation options");

geometryLockCheck.then(() => console.log("Blueprint AI Visual Mockup contract passed"));
