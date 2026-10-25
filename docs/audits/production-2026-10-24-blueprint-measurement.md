# Blueprint measurement audit — 2026-10-24

Production baseline: 44237a6da0a31099c34da738e22376bce8d68143, Vercel CszmB4pYzTadha3nWXzgPanCeqfR Ready and Production domain confirmed in dashboard.

User explicitly authorized the synthetic PDF upload to BOS Audit Sandbox 20261005 and normal automatic native 3D job. Uploaded one Draft Architectural sheet QA-A101-20261021, QA-r1, 46 KB. Source SHA256 c7e7d9eb96912ddece367aefefc9ecac95ee0288200ab23c8a03d8a308faad46. No customer messages, funds, approvals, or protected pilot transitions. Source/history retained.

Both landscape and portrait PDF pages rendered with embedded fonts, geometry, color/grayscale/stroke strips, rotated text, and end markers. Page navigation, zoom/pan/fit and page-scoped annotations exercised. The automatic native job declined reconstruction: insufficient topology-validated walls/low targeting confidence. This simple geometric fixture does not establish successful 3D reconstruction.

## Reproduced defect

With the 4 ft reference calibrated by pointer, a 20 ft horizontal span read20.19 ft, a 12 ft vertical span20.43 ft, and a240 sq ft rectangle412.55 sq ft. Cursor placement explains the small horizontal difference; independently normalized X/Y axes explain the systematic vertical/area distortion. The actual markup surface was1216.32x720px and includes PDF letterboxing.

## Correction

Convert both normalized axes to surface-width units: distance=hypot(dx,dy/aspect), area=abs(dx*dy)/aspect. Convert surface-width units to source-width units using the actual object-contain rendered source width, including letterboxing. Persist metric version, surface/source aspect ratios, source-width conversion and calibration ID on new measurements. Require recalibration for old metrics or a mismatched source aspect. Uniform zoom, toolbar reflow and viewport resize retain a common source metric. Preserve all existing geometry and history. Flag older measurements for verification and disable their viewer Add to estimate action; no database migration, historical quantity rewrite, or new authorization claim. Existing linked estimates and direct RPC consumers require their own historical review.

## Validation

64 numerical scenarios passed: observed letterboxed surface, landscape, portrait, square/image surfaces, four zoom levels, horizontal/vertical/diagonal calibration, horizontal/vertical/diagonal distance, positive/reversed rectangle area. Invalid and legacy metric rejection, source mismatch rejection and four independent cross-layout/letterbox scenarios, and component integration checks passed. Existing Blueprints foundation contract passed. Full repository CI/lint/build and deployed visual/function regression remain required before completion.

Local tsx CLI hit the known IPC EPERM restriction; running Node with the official tsx import loader passed. No npm install was run. Browser file-selection first failed because the nested fixture was absent in the browser shared directory; an identical root shared-directory copy was verified46,212bytes and selected successfully. No product validation weakening.
