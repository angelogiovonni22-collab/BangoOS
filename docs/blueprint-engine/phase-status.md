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
- [~] Full CI green on current branch
- [ ] Production migration application and verification
- [ ] Production visual verification

## Phase B — Architectural Reconstruction

- [x] Gap-based opening association
- [x] Door/window typed opening output
- [x] Text-assisted garage semantic recognition
- [x] Text-assisted deck/porch semantic recognition
- [x] Direction-label stair semantic recognition
- [x] Dimension-to-wall association foundation
- [x] Dimension-based scale reconciliation foundation
- [x] Native raster line-extraction module foundation
- [ ] Raster fallback integrated into the reconstruction orchestrator
- [ ] PDF-page raster rendering fallback for vector-poor PDFs
- [ ] Robust room-boundary tracing
- [ ] Door swing/symbol recognition
- [ ] Window symbol/type recognition
- [ ] Better wall junction/corner recovery
- [ ] Nested/duplicate annotation-line filtering
- [ ] Slab/foundation recognition
- [ ] Roof geometry recognition

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

- Branch: `feat/blueprint-engine-native`
- PR: `#524 — Add B.O.S. Native Blueprint Engine foundation`
- Merge policy: do not merge until required CI gates are green and the active phase acceptance criteria are satisfied.

## Immediate execution order

1. Keep the control documents synchronized with implementation.
2. Integrate deterministic raster fallback where scale can be verified safely.
3. Extend tests for corrections, IFC, openings, dimensions, and export UI.
4. Resolve all CI failures automatically.
5. Merge only when gates are green.
6. Apply required Supabase migrations.
7. Verify Production.
8. Run strongest safe real-plan/visual benchmark.
9. Continue to the next incomplete phase automatically.