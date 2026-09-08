# Blueprint Engine Phase Status

This file is the live execution checklist for the native Blueprint Engine. Update it in the same PR whenever a phase materially advances.

Legend:
- `[x]` implemented in the active Blueprint Engine branch/PR
- `[~]` partially implemented or present but not fully integrated/validated
- `[ ]` not yet implemented

## Phase A — Foundation

- [x] Canonical `BosBuildingGraph` schema
- [x] Source evidence/provenance/confidence contract
- [x] Deterministic multi-page sheet targeting
- [x] Printed architectural scale parser
- [x] Printed dimension parser
- [x] PDF text extraction
- [x] PDF vector path extraction
- [x] Segment snapping/merging/topology metrics
- [x] Paired-line wall-centerline detector
- [x] Basic exterior/interior wall classification
- [x] Graph validation engine
- [x] Native GLB generation from Building Graph
- [x] Generated-model persistence fields for graph/validation/version/status
- [x] Permanent Mitchell Dewitt first-floor executable benchmark
- [x] Native PDF route integration behind existing Generate 3D endpoint
- [x] Repo-level Blueprint Engine control structure and control contract
- [~] Real benchmark-source execution against the uploaded Mitchell Dewitt PDF
- [x] Full CI green through merged Phase B diagonal-corner hardening
- [x] Production migration application and verification
- [ ] Production visual verification

### Merged Phase A release checkpoint

- Branch: `feat/blueprint-engine-native`
- PR: `#524 — Add B.O.S. Native Blueprint Engine foundation`
- Merge commit: `6adfee4a28c589c2ead71f29ae3902a1d21b87a2`
- Production migration and deployment verification completed; authenticated visual verification remains tracked separately.

### Merged Phase B junction checkpoint

- Branch: `feat/blueprint-engine-reconstruction-hardening`
- PR: `#525 — Harden Blueprint room junction recovery`
- Merge commit: `0bab47a5a8cfa84aa519dff193db00a07a432bd8`
- Required CI and Vercel Production deployment completed green.

### Merged Phase B annotation checkpoint

- Branch: `feat/blueprint-engine-annotation-filtering`
- PR: `#526 — Filter Blueprint dimension annotation linework`
- Merge commit: `b809b1bbe20f42682aa5010c55eb99ec41b8dd74`
- Required CI completed green, including the production dependency audit after patching Next.js to 16.3.4.

### Merged Phase B opening-symbol checkpoint

- Branch: `feat/blueprint-engine-opening-symbols`
- PR: `#527 — Recognize Blueprint door and window symbols`
- Merge commit: `0570fa486dba597579671f68a3ed47507ca2849f`
- Required CI and Vercel Production deployment completed green.

### Merged Phase B diagonal-corner checkpoint

- Branch: `feat/blueprint-engine-junction-annotation-hardening`
- PR: `#529 — Harden Blueprint diagonal corner recovery`
- Merge commit: `99ac86664cd5785bd13dfc87d879fb564fffc3f4`
- Required CI and Vercel Production deployment completed green.

## Phase B — Architectural Reconstruction

Phase B follows `master-plan.md`: wall classification, openings, rooms/architectural semantics, dimension reconciliation, corner/junction handling, nested/annotation filtering, and raster fallback. Slab/roof semantic promotion is tracked separately below because the Master Plan and workstream boundaries describe those as future architectural semantics rather than Phase B release gates.

- [x] Gap-based opening association
- [x] Door/window typed opening output
- [x] Text-assisted garage semantic recognition
- [x] Text-assisted deck/porch semantic recognition
- [x] Direction-label stair semantic recognition
- [x] Dimension-to-wall association foundation
- [x] Dimension-based scale reconciliation foundation
- [x] Native raster line-extraction module foundation
- [x] Raster fallback integrated into the reconstruction orchestrator
- [x] Selected PDF-page raster decoding/render fallback for vector-poor PDFs when scale is verified
- [x] Wall-bounded room tracing and room polygon foundation
- [x] Room tracing recovers T/cross junctions where partitions terminate into unsplit wall runs
- [x] Room tracing bridges near-miss partition endpoints within snap tolerance without bridging larger gaps
- [x] Room tracing closes diagonal endpoint-to-endpoint corner gaps within snap tolerance without bridging separated corners
- [x] Door swing/symbol recognition from gap-anchored vector leaf/slider evidence
- [x] Window symbol/type recognition from gap-overlapping vector line evidence
- [x] Better wall junction/corner recovery foundation for exact, projected near-miss, and diagonal endpoint gaps
- [x] Nested/duplicate annotation-line filtering, including paired-wall duplicate suppression, dimension-label zones, and conservative thin witness-line suppression

### Future architectural semantics — post-Phase B

- [ ] Slab/foundation semantic promotion when explicit source evidence supports it
- [ ] Roof geometry/semantic promotion when explicit source evidence supports it

## Phase C — Correction and Review Workspace

- [x] Append-only correction contract
- [x] Correction application/replay engine foundation
- [x] Tenant-scoped correction migration/table
- [x] Correction read/write API
- [x] Building Graph exposed through correction API
- [x] Regeneration replay plumbing with tenant-scoped persisted correction loading
- [x] Persisted manual scale applied before deterministic geometry conversion
- [x] Correction history retained on regenerated model records
- [x] Correction conflict detection when object IDs no longer match
- [x] Correction replay/conflict contract regression
- [~] Native reconstruction/validation metadata surfaced in Blueprint control UI
- [ ] 2D wall selection/edit controls
- [ ] Move/add/remove/classify wall UI
- [ ] Opening correction UI
- [ ] Room correction UI
- [ ] Manual scale confirmation UI
- [ ] Object confidence/provenance inspector
- [ ] Validation issue panel linked to graph objects

## Phase D — Multi-floor Reconstruction

- [x] Multi-floor graph assembly foundation
- [x] Stair-centroid alignment foundation
- [x] Exterior-centroid fallback alignment
- [x] Manual translation anchor support
- [ ] Automatic level-sheet discovery/registration
- [ ] Per-level reconstruction orchestration
- [ ] Alignment validation/conflict handling
- [ ] Multi-level GLB verification
- [ ] Multi-level IFC verification
- [ ] Production UI level controls

## Phase E — Export and Downstream Intelligence

- [x] Native IFC graph serializer foundation
- [x] Authenticated IFC export endpoint
- [x] Native IFC export control in Blueprint UI
- [ ] IFC schema/validator regression
- [ ] Graph query helpers for Orion
- [ ] Validated quantity/takeoff derivation
- [ ] Job-cost/material integration contract
- [ ] Reality Engine alignment contract

## Phase F — Benchmark and Production Hardening

- [x] Wrong-page benchmark rule
- [x] Four-wall rectangle rejection rule
- [x] Topology/scale/semantic benchmark metrics
- [x] Control-document regression protecting the source-of-truth structure
- [ ] Execute Mitchell Dewitt source through native parser and inspect resulting graph
- [ ] Add scanned-plan benchmark fixture
- [ ] Add conflicting-dimension fixture
- [ ] Add sparse-plan `needs_input` fixture
- [x] Add correction-regeneration fixture
- [ ] Add multi-floor fixture
- [ ] Performance budget tests for dense/large PDFs
- [ ] Production telemetry for engine status/failure codes/confidence
- [ ] Authenticated Production visual walkthrough

## Current release branch

- Branch: `feat/blueprint-engine-witness-filtering`
- PR: `#530 — Filter Blueprint dimension witness linework`
- Merge policy: do not merge until required CI gates are green and the active phase acceptance criteria are satisfied.

## Immediate execution order

1. Finish and merge the remaining Phase B witness-filter hardening only when all required gates are green.
2. Verify Vercel Production for the merged Phase B completion commit.
3. Continue Phase C by wiring the existing correction API/Building Graph into the Blueprint review workspace instead of duplicating correction logic.
4. Add focused correction UI contracts during development and run full validation before merge.
5. Resolve CI failures automatically and merge only when gates are green.
6. Apply required Supabase migrations only if a phase genuinely introduces schema changes.
7. Verify Production and run the strongest safe real-plan/visual benchmark available.
8. Continue to the next incomplete phase automatically.
