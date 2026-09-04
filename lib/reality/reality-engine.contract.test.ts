import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { summarizeRoomPlan, validateRealityCaptureInput } from "./capture";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260904194000_reality_engine_capture_foundation.sql"), "utf8");
const route = fs.readFileSync(path.join(root, "app/api/reality/scans/route.ts"), "utf8");
const swift = fs.readFileSync(path.join(root, "native/ios/BOSRealityCapture/RoomPlanCaptureCoordinator.swift"), "utf8");
const routeLower = route.toLowerCase();

assert(migration.includes("create table public.reality_capture_sessions"));
assert(migration.includes("create table public.reality_capture_assets"));
assert(migration.includes("create table public.reality_capture_measurements"));
assert.match(migration, /enable row level security/g);
assert(routeLower.includes("authorization") && routeLower.includes("bearer "), "Native clients must be able to authenticate with a Supabase bearer token");
assert(route.includes("Project not found in this company."), "Capture ingestion must remain tenant-scoped");
assert(swift.includes("import RoomPlan") && swift.includes("RoomCaptureView") && swift.includes("room.export"), "iOS capture must use Apple's RoomPlan pipeline and export a real room model");

const roomPlan = {
  schemaVersion:1 as const,
  capturedAt:new Date().toISOString(),
  walls:[{ id:"wall-1", category:"wall", dimensions:{ width:3, height:2.4, length:0.1 } }],
  doors:[], windows:[], openings:[], objects:[],
};
assert.deepEqual(validateRealityCaptureInput({ projectId:"project", captureType:"roomplan", sourcePlatform:"ios", roomPlan }), []);
assert.equal(summarizeRoomPlan(roomPlan).wallCount, 1);
assert(validateRealityCaptureInput({ projectId:"", captureType:"roomplan", sourcePlatform:"ios", roomPlan:null }).length >= 2);

console.log("Reality Engine capture contract passed");
