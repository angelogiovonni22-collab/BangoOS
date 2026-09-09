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
- [~] Exact Mitchell Dewitt source is registered in Production and its historical generated-model record was inspected; a forced Production native regeneration is still required because that record predates persisted Building Graph output
- [x] Full CI green through merged Mitchell benchmark fixes
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

### Merged Phase B completion checkpoint

- Branch: `feat/blueprint-engine-witness-filtering`
- PR: `#530 — Filter Blueprint dimension witness linework`
- Merge commit: `c95e4fe1b2de5487f03f0c6fa2c8561aa4e6e4f0`
- Master Plan Phase B is complete; required CI and Vercel Production deployment completed green.

### Merged Phase C review-workspace checkpoint

- Branch: `feat/blueprint-engine-review-workspace`
- PR: `#531 — Add Blueprint Building Graph review workspace`
- Merge commit: `c856d1d58696a328414daaa7396e136260bcb737`
- Master Plan Phase C is complete; focused contracts, full required CI, and Vercel Production deployment completed green.

### Merged Phase D multi-floor checkpoint

- Branch: `feat/blueprint-engine-multifloor-orchestration`
- PR: `#532 — Add Blueprint multi-floor reconstruction orchestration`
- Merge commit: `bc0714f67ae19c6c1533cf17f6c7e01c52b334a5`
- Master Plan Phase D is complete; deterministic level discovery, per-level orchestration, alignment validation, multi-level GLB/IFC regression coverage, and full required CI completed green.

### Merged Phase E downstream-intelligence checkpoint

- Branch: `feat/blueprint-engine-downstream-intelligence`
- PR: `#533 — Add Blueprint downstream graph intelligence`
- Merge commit: `264e3041de06bcbbec76eb339f1eddc4d8f9660d`
- Master Plan Phase E is complete; IFC integrity validation, Orion graph queries, validated quantities, safe costing/material adapters, Reality Engine alignment, full required CI, and production dependency audit completed green.

### Merged Phase F production-hardening checkpoint

- Branch: `feat/blueprint-engine-production-hardening`
- PR: `#534 — Harden Blueprint production benchmarks and telemetry`
- Merge commit: `b316b85f27eb82d56d2502312f2637d1c8ba5d5c`
- Sparse/conflicting/scanned-plan fixtures, dense performance budget, tenant-scoped telemetry, full required CI, dependency audit, and Vercel Production deployment completed green.

### Merged Mitchell real-source benchmark checkpoint

- Branch: `fix/blueprint-pdf-raster-benchmark`
- PR: `#535 — Fix native raster reconstruction for Mitchell benchmark`
- Merge commit: `8a45c59ab396338a365209b59078f2e7fb9d6a9b`
- Exact private Mitchell source passed the permanent native benchmark locally against the merged engine: page 2 selected, 80 walls, 16 exterior walls, footprint complexity 1.0, topology closure 0.6875, scale confidence 0.98, garage/deck/stair semantics present, rectangle rejection intact, and validation not failed.
- All required CI gates and the Vercel Production deployment completed green.

## Phase B — Architectural Reconstruction

Phase B follows `master-plan.md`: wall classification, openings, rooms/architectural semantics, dimension reconciliation, corner/junction handling, nested/annotation filtering, and raster fallback. Slab/roof semantic promotion is tracked separately below because the Master Plan and workstream boundaries describe those as future architectural semantics rather than Phase B or current release gates.

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

### Future architectural semantics — post-release enhancements, not current Definition of Done

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
- [x] Native reconstruction/validation metadata surfaced in Blueprint control UI
- [x] 2D wall selection/edit controls
- [x] Move/add/remove/classify wall UI
- [x] Opening correction UI
- [x] Room correction UI
- [x] Manual scale confirmation UI
- [x] Object confidence/provenance inspector
- [x] Validation issue panel linked to graph objects

## Phase D — Multi-floor Reconstruction

- [x] Multi-floor graph assembly foundation
- [x] Stair-centroid alignment foundation
- [x] Exterior-centroid fallback alignment
- [x] Manual translation anchor support
- [x] Automatic level-sheet discovery/registration over existing registered Blueprint sheets
- [x] Per-level reconstruction orchestration through the existing native Generate 3D endpoint
- [x] Alignment validation/conflict handling with confidence and implausible-translation withholding
- [x] Multi-level GLB verification including level elevation
- [x] Multi-level IFC verification with one IFC building storey per level
- [x] Production UI level controls for full-building or individual-floor viewing

## Phase E — Export and Downstream Intelligence

- [x] Native IFC graph serializer foundation
- [x] Authenticated IFC export endpoint
- [x] Native IFC export control in Blueprint UI
- [x] IFC schema/reference validator regression for STEP header/footer, IFC4, required spatial entities, reference integrity, storey count, and wall count
- [x] Graph query helpers for Orion with level/object/room filtering and compact graph summary
- [x] Validated quantity/takeoff derivation that fails closed unless the graph is reconstructed with >=70% validation score
- [x] Job-cost/material integration contract that remains unpriced and requires existing cost-code/category review
- [x] Reality Engine alignment contract using blueprint version identity, metric plan coordinates, levels, and evidence-backed anchors
- [x] Tenant-scoped downstream intelligence API over the authoritative persisted `building_graph`

## Phase F — Benchmark and Production Hardening

- [x] Wrong-page benchmark rule
- [x] Four-wall rectangle rejection rule
- [x] Topology/scale/semantic benchmark metrics
- [x] Control-document regression protecting the source-of-truth structure
- [x] Execute the exact private Mitchell Dewitt source through the current native engine runtime and inspect the resulting graph; the permanent benchmark passes locally on page 2 with 80 walls, 16 exterior walls, footprint complexity 1.0, 0.6875 topology closure, 0.98 scale confidence, garage/deck/stair semantics present, and validation not failed
- [x] Add scanned-plan-like raster benchmark fixture with scale-normalized orthogonal extraction
- [x] Add conflicting-dimension fixture that refuses incompatible scale correction
- [x] Add sparse-plan `needs_input`/withholding fixture
- [x] Add correction-regeneration fixture
- [x] Add multi-floor fixture
- [x] Performance budget test for a dense 3,200-segment vector fixture
- [x] Production telemetry endpoint for tenant-scoped engine status, failure codes, confidence, validation score, reconstruction versions, and latest update time
- [ ] Forced native regeneration of the registered Mitchell Dewitt Production revision and persisted Building Graph verification
- [ ] Authenticated Production visual walkthrough

## Current release state

- Engine implementation and real-source benchmark fixes are merged through PR #535.
- Production deployment for merge commit `8a45c59ab396338a365209b59078f2e7fb9d6a9b` is green.
- No active product-development PR remains for the current Blueprint Engine Definition of Done.
- Remaining release checks require an authenticated B.O.S. Production browser session.

## Immediate execution order

1. Force the exact registered Mitchell Dewitt Production revision through the authenticated Generate/Regenerate route and inspect the persisted Building Graph against the permanent benchmark.
2. Complete the authenticated Production visual Blueprint/3D walkthrough.
3. Resolve only defects exposed by those two release checks; do not add unrelated or post-release semantics.
4. Mark the current Blueprint Engine Definition of Done complete when both Production checks pass.
