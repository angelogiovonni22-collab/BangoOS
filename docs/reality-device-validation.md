# B.O.S. Reality Engine Physical-Device Validation

This checklist is the release gate for Apple RoomPlan/LiDAR capture.

## Required hardware
- An iPhone or iPad for which `RoomCaptureSession.isSupported == true` (Apple device with LiDAR Scanner).
- iOS/iPadOS 17 or later for the current B.O.S. native shell.

## Preflight
- Sign in to the Production B.O.S. native iOS shell.
- Open a real test project that can safely receive a Reality capture.
- Confirm the Reality capture entry point is enabled on supported LiDAR hardware.
- Confirm unsupported Apple hardware reports Reality capture unavailable instead of attempting to start RoomPlan.

## Required physical-device E2E
1. Start Reality capture from the project workspace.
2. Grant camera permission if prompted.
3. Scan one room slowly enough to capture walls, openings, doors, and windows.
4. Finish the scan and approve/process the RoomPlan result.
5. Confirm B.O.S. exports both `room.usdz` and `room.json` locally.
6. Confirm the native shell creates an authenticated tenant-scoped capture session.
7. Confirm USDZ and metadata upload through signed private Storage URLs.
8. Confirm finalize succeeds only after the uploaded object exists.
9. Confirm the resulting capture session is marked ready and references the uploaded asset paths.
10. Reopen the project and verify the capture is still associated with the same company/project.
11. Verify a different company/user cannot read the private capture asset.
12. Interrupt one scan/upload once, relaunch B.O.S., and verify the resumable queue does not duplicate finalized assets.
13. Repeat with low network quality if available and confirm retry/failure messaging is understandable.

## Pass criteria
- No crash, thermal/device-not-supported error on supported hardware, or stuck full-screen capture state.
- Room geometry is produced by RoomPlan and exported as valid USDZ + metadata JSON.
- Upload/finalize completes under the authenticated company/project/session path.
- Tenant isolation remains intact.
- The web workspace receives `bos:reality-capture-complete` with the created session and asset paths.
- An interrupted attempt can be retried without corrupting or duplicating the finalized capture.

The phase is not considered physically validated until every required physical-device E2E item above has been observed on supported LiDAR hardware.
