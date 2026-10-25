# Blueprint measurement audit — 2026-10-24

Production baseline: 44237a6da0a31099c34da738e22376bce8d68143, Vercel CszmB4pYzTadha3nWXzgPanCeqfR Ready and Production domain confirmed in dashboard.

User explicitly authorized the synthetic PDF upload to BOS Audit Sandbox 20261005 and normal automatic native 3D job. Uploaded one Draft Architectural sheet QA-A101-20261021, QA-r1, 46 KB. Source SHA256 c7e7d9eb96912ddece367aefefc9ecac95ee0288200ab23c8a03d8a308faad46. No customer messages, funds, approvals, or protected pilot transitions. Source/history retained.

Both landscape and portrait PDF pages rendered with embedded fonts, geometry, color/grayscale/stroke strips, rotated text, and end markers. Page navigation, zoom/pan/fit and page-scoped annotations exercised. The automatic native job declined reconstruction: insufficient topology-validated walls/low targeting confidence. This simple geometric fixture does not establish successful 3D reconstruction.

## Reproduced defect

With the 4 ft reference calibrated by pointer, a 20 ft horizontal span read20.19 ft, a 12 ft vertical span20.43 ft, and a240 sq ft rectangle412.55 sq ft. Cursor placement explains the small horizontal difference; independently normalized X/Y axes explain the systematic vertical/area distortion. The actual markup surface was1216.32x720px and includes PDF letterboxing.

## Correction

Convert both normalized axes to surface-width units: distance=hypot(dx,dy/aspect), area=abs(dx*dy)/aspect. Convert surface-width units to source-width units using the actual object-contain rendered source width, including letterboxing. Persist metric version, surface/source aspect ratios, source-width conversion and calibration ID on new measurements. Require recalibration for old metrics or a mismatched source aspect. Uniform zoom, toolbar reflow and viewport resize retain a common source metric. Preserve all existing geometry and history. Flag older measurements for verification and disable their viewer Add to estimate action; no database migration, historical quantity rewrite, or new authorization claim. Project takeoff cards exclude legacy/invalid quantities and expose the excluded count; coverage counts only verified quantities, including ft/m conversions. Existing linked estimates and direct RPC consumers require their own historical review.

## Validation

64 numerical scenarios passed: observed letterboxed surface, landscape, portrait, square/image surfaces, four zoom levels, horizontal/vertical/diagonal calibration, horizontal/vertical/diagonal distance, positive/reversed rectangle area. Invalid and legacy metric rejection, source mismatch rejection and four independent cross-layout/letterbox scenarios, and component integration checks passed. Existing Blueprints foundation contract passed. Full repository CI/lint/build and deployed visual/function regression remain required before completion.

Local tsx CLI hit the known IPC EPERM restriction; running Node with the official tsx import loader passed. No npm install was run. Browser file-selection first failed because the nested fixture was absent in the browser shared directory; an identical root shared-directory copy was verified46,212bytes and selected successfully. No product validation weakening.

## Release security gate discovered during CI

PR head ba2a4c1 passed repository checks (lint/build/contracts), but main job121046829520/run40152516014 failed npm audit: Next16.3.8 affected by GHSA-2464-fhr4-w9xw/GHSA-p3m5-59mp-jv5r/GHSA-673q-mjm6-r5xr; Zod4.4.3 affected by GHSA-mrhx-c7xc-m3w5. No merge or Production update at that point.

Verified current GitHub vendor advisories/releases: Next patched16.4.1, current stable16.4.3 (Oct23); Zod patched4.6.6. Update Next and paired eslint-config-next to16.4.3; override transitive Zod to4.6.6, supported by OpenAI7.3.0/react-hooks peers. Existing sharp0.35.5 remains. Regenerated lockfile with npm update --package-lock-only --ignore-scripts --no-audit next eslint-config-next zod; no npm install or node_modules installation. Full final-head CI and actual Production regression remain mandatory.

Primary references:
- https://github.com/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/advisories/GHSA-p3m5-59mp-jv5r
- https://github.com/advisories/GHSA-673q-mjm6-r5xr
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://github.com/vercel/next.js/releases/tag/v16.4.3
- https://github.com/colinhacks/zod/releases/tag/v4.6.6
