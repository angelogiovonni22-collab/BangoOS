import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const panel = fs.readFileSync(path.join(root, "components/plans/blueprint-graph-review-panel.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(root, "components/plans/blueprint-plan-workspace.tsx"), "utf8");
const correctionRoute = fs.readFileSync(path.join(root, "app/api/blueprints/[versionId]/generated-3d/corrections/route.ts"), "utf8");

assert(workspace.includes("BlueprintGraphReviewPanel") && workspace.includes("Reconstruction review"), "The full Blueprint workspace must expose the canonical Building Graph review panel");
assert(panel.includes("generated-3d/corrections") && panel.includes('method: "POST"'), "Graph review must use the existing append-only correction API instead of creating client-side geometry persistence");
assert(panel.includes('type: "move_wall"') && panel.includes('type: "add_wall"') && panel.includes('type: "remove_wall"') && panel.includes('type: "classify_wall"'), "Wall review must support move/add/remove/classify corrections");
assert(panel.includes('type: "update_opening"') && panel.includes('type: "update_room"') && panel.includes('type: "set_scale"'), "Opening, room, and manual-scale corrections must be available from the review workspace");
assert(panel.includes("Selectable reconstructed wall map") && panel.includes("setSelectedWallId"), "The review workspace must expose interactive 2D wall selection");
assert(panel.includes("Confidence & provenance") && panel.includes("selectedObject.provenance") && panel.includes("selectedObject.evidence.length"), "Selected graph objects must expose confidence, provenance, and evidence counts");
assert(panel.includes("Validation issues") && panel.includes("issue.objectIds"), "Validation issues must link back to reconstructed graph objects");
assert(panel.includes("window.confirm") && panel.includes("remove_wall"), "Removing a wall must require an explicit in-UI confirmation before a correction event is written");
assert(panel.includes("Correction saved. Regenerate 3D") && !panel.includes("method: \"DELETE\""), "Review edits must remain append-only and explicitly require regeneration rather than mutating generated models destructively");
assert(correctionRoute.includes("blueprint_model_corrections") && correctionRoute.includes("workspace.userId"), "Review corrections must remain tenant-scoped and attributable to the authenticated user");

console.log("B.O.S. Blueprint Building Graph review workspace contract: PASS");
