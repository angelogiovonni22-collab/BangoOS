import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const coordinator = read("native/ios/BOSRealityCapture/RoomPlanCaptureCoordinator.swift");
const rootView = read("native/ios/BOSApp/Sources/BOSRootView.swift");
const uploadClient = read("native/ios/BOSApp/Sources/RealityCaptureUploadClient.swift");
const captureSheet = read("native/ios/BOSApp/Sources/RealityCaptureSheet.swift");
const scanRoute = read("app/api/reality/scans/route.ts");
const ticketRoute = read("app/api/reality/scans/[sessionId]/assets/upload-ticket/route.ts");
const finalizeRoute = read("app/api/reality/scans/[sessionId]/assets/finalize/route.ts");
const migration = read("supabase/migrations/20260905183000_reality_capture_storage.sql");

assert(coordinator.includes("captureView.delegate = self"), "RoomPlan view must publish its processed result");
assert(coordinator.includes("RoomCaptureViewDelegate"));
assert(coordinator.includes("captureView(didPresent processedResult: CapturedRoom"));
assert(coordinator.includes("capturedRoom = processedResult"));
assert(coordinator.includes("room.export(to: usdzURL)"));
assert(coordinator.includes("RoomCaptureSession.isSupported"), "native capture must guard unsupported non-LiDAR hardware");
assert(coordinator.includes("requires an Apple device with a LiDAR Scanner"));

assert(rootView.includes("import RoomPlan"));
assert(rootView.includes('name: "bosRealityCapture"'), "native shell must expose an explicit Reality Engine bridge");
assert(rootView.includes("message.frameInfo.isMainFrame"));
assert(rootView.includes("NativeAppConfiguration.isAllowed(currentURL)"), "native requests must originate from an allowed B.O.S. page");
assert(rootView.includes("RoomCaptureSession.isSupported"), "web/native bridge must report the actual RoomPlan device capability");
assert(rootView.includes("available: bosRealityAvailable"));
assert(rootView.includes("realityCapture: bosRealityAvailable"));
assert(rootView.includes("if (!bosRealityAvailable)"));
assert(rootView.includes("bos:reality-capture-complete"));
assert(captureSheet.includes("RoomPlanCaptureCoordinator"));
assert(captureSheet.includes("RealityCaptureUploadClient"));

assert(uploadClient.includes("WKHTTPCookieStore"), "native capture upload must reuse the authenticated B.O.S. web session");
assert(uploadClient.includes('request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")'));
assert(!uploadClient.includes("service_role"), "native code must never contain a Supabase service-role credential");
assert(!uploadClient.includes("SUPABASE_SERVICE"));
assert(uploadClient.includes('uploadRequest.httpMethod = "PUT"'), "large native assets must upload directly to signed Storage URLs");
assert(uploadClient.includes('upload-ticket'));
assert(uploadClient.includes('/assets/finalize'));
assert(uploadClient.includes("SHA256.hash"), "asset metadata must include an integrity digest");

assert(scanRoute.includes('authorization?.toLowerCase().startsWith("bearer ")'));
assert(ticketRoute.includes("resolveWorkspaceContext"));
assert(ticketRoute.includes("createSignedUploadUrl"));
assert(ticketRoute.includes('session.created_by !== user.id'));
assert(finalizeRoute.includes("resolveWorkspaceContext"));
assert(finalizeRoute.includes("storagePath.startsWith(prefix)"));
assert(finalizeRoute.includes("Uploaded Reality Engine asset was not found in private storage."));

assert(migration.includes("'bos-reality-captures'"));
assert(migration.includes("false,\n  262144000"), "Reality Engine bucket must remain private and bounded");
assert(migration.includes("bos_reality_captures_storage_insert"));
assert(migration.includes("s.created_by = auth.uid()"));
assert(migration.includes("split_part(name, '/', 3)"), "Storage RLS must bind every asset to a capture session path");

console.log("Reality Engine native capture contract passed");
