import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260904193000_reality_engine_roomplan_foundation.sql"), "utf8");
const route = fs.readFileSync(path.join(root, "app/api/reality/scans/route.ts"), "utf8");
const viewer = fs.readFileSync(path.join(root, "components/reality/reality-scan-viewer.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(root, "app/(app)/reality/reality-client.tsx"), "utf8");
const nativeBridge = fs.readFileSync(path.join(root, "native/ios/RealityEngine/RoomPlanCaptureCoordinator.swift"), "utf8");

assert(migration.includes("create table if not exists public.reality_scans"), "Reality scans must be persisted");
assert(migration.includes("reality_scans_one_target"), "A Reality scan must attach to exactly one project or estimate");
assert(migration.includes("alter table public.reality_scans enable row level security"), "Reality scans must use RLS");
assert(migration.includes("company_memberships"), "Reality scan access must remain tenant membership scoped");
assert(migration.includes("'reality-scans'"), "Reality artifacts must use a dedicated private storage bucket");
assert(migration.includes("public = false") || migration.includes("false,"), "Reality scan storage must remain private");

assert(route.includes("resolveWorkspaceContext"), "Reality Engine API must resolve authenticated company context");
assert(route.includes("eq(\"company_id\", workspace.context.companyId)"), "Target validation must be company scoped");
assert(route.includes("MAX_MODEL_BYTES"), "Reality Engine must bound USDZ uploads");
assert(route.includes("createSignedUrl"), "Private 3D models must be exposed through expiring signed URLs");
assert(route.includes("uploaded.length") && route.includes("remove(uploaded)"), "Failed scan writes must clean uploaded artifacts");
assert(!route.includes("service_role"), "Reality Engine route must not embed service-role credentials");

assert(viewer.includes("USDZLoader"), "Reality Engine must render real RoomPlan USDZ exports");
assert(viewer.includes("data-orion-region=\"reality-engine-3d-viewer\""), "Reality Engine viewer must expose Orion semantic context");
assert(workspace.includes("RoomPlan") && workspace.includes("LiDAR / ARKit"), "Reality workspace must expose RoomPlan and LiDAR capture paths");
assert(workspace.includes("/api/reality/scans"), "Reality workspace must use the authenticated scan API");

assert(nativeBridge.includes("import RoomPlan"), "Native Reality bridge must use Apple's RoomPlan framework");
assert(nativeBridge.includes("RoomCaptureView"), "Native Reality bridge must provide Apple's guided scan UI");
assert(nativeBridge.includes("supportsSceneReconstruction(.mesh)"), "Native Reality bridge must gate capture on depth-capable AR hardware");
assert(nativeBridge.includes("processedResult.export(to: usdzURL)"), "Native Reality bridge must export USDZ");
assert(nativeBridge.includes("encoder.encode(processedResult)"), "Native Reality bridge must preserve serialized RoomPlan source data");

console.log("Reality Engine contract passed");
