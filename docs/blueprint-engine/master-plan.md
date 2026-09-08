# B.O.S. Native Blueprint Engine — Master Plan

## Mission

Build a native B.O.S. Blueprint-to-3D reconstruction engine that converts registered architectural plan sheets into a canonical, evidence-backed Building Graph and then into visual/coordination outputs such as GLB and IFC. The engine must favor deterministic reconstruction and measurable validation over visually plausible but unverifiable guesses.

## Product objective

A user should be able to upload or register a 2D architectural sheet, select or rely on the registered sheet metadata, generate a B.O.S. Building Graph, review confidence and detected issues, correct geometry when necessary, regenerate safely, and open/export the resulting 3D model without leaving the existing Blueprints workflow.

## Core architecture

1. Source registration
   - Source revision is tenant-scoped and already belongs to a B.O.S. Blueprint sheet/project.
   - Sheet number, title, discipline, MIME type, file size, and page count remain authoritative metadata inputs.

2. Sheet targeting
   - Multi-page PDFs are parsed page-by-page.
   - Target page is selected from registered sheet metadata using deterministic title/sheet/discipline scoring.
   - Wrong-sheet uncertainty must block automatic success.

3. Geometry extraction
   - Preferred path: PDF vector and text extraction.
   - Wall reconstruction: normalize vectors, identify paired wall lines, derive centerlines, merge collinear runs, snap endpoints, classify likely exterior/interior walls.
   - Raster fallback: image rendering/decoding, line extraction, scale reconciliation, then the same downstream graph pipeline.

4. Scale and dimensions
   - Printed scale parsing is preferred when present.
   - Printed dimensions are parsed and retained as evidence.
   - Dimension reconciliation can refine geometry only when multiple consistent dimensions support the correction.
   - Manual scale remains a supported correction path.

5. Architectural semantics
   - Doors/windows/openings are associated to walls.
   - Rooms, stairs, decks/porches, slabs, and later roofs/structural elements are promoted into typed graph objects when evidence supports them.
   - AI may assist classification or ambiguity resolution but may not silently overwrite deterministic evidence.

6. Canonical Building Graph
   - `BosBuildingGraph` is the durable intermediate representation.
   - Every reconstructed object carries confidence, source page, evidence, provenance, and optional correction state.
   - The graph is persisted with reconstruction version and algorithm versions.

7. Validation and withholding
   - Topology, closure, complexity, scale confidence, semantic coverage, and benchmark-specific gates are evaluated before release.
   - Four-wall rectangle collapse, under-tracing, low-confidence scale, wrong-sheet selection, and severe dangling topology are explicit failure modes.
   - Models that fail gates are withheld from `3D Ready` and marked `needs_review`, `needs_input`, or `failed`.

8. User correction loop
   - Corrections are stored as append-only tenant-scoped events.
   - Regeneration replays corrections against a reconstructed graph.
   - Manual edits update provenance instead of erasing original evidence.

9. Output generation
   - GLB is generated from the canonical graph for the existing B.O.S. viewer.
   - IFC is generated for coordination/export.
   - Additional outputs such as OBJ, floor takeoff overlays, quantity extraction, and Reality Engine alignment can be layered on later without replacing the graph.

10. Release safety
   - Every phase must pass targeted contracts plus BangoOS full validation before merge.
   - Required Supabase migrations must be applied and verified before Production features depend on them.
   - Production verification must include real registered plan flows and benchmark expectations.

## Implementation phases

### Phase A — Foundation
- Canonical Building Graph contract.
- Deterministic sheet targeting.
- Architectural dimension and printed-scale parsing.
- PDF vector/text extraction.
- Geometry normalization, paired-line wall detection, topology metrics.
- Validation engine.
- Native GLB output.
- Persistence fields for graph, validation, engine status, versions.
- Permanent Mitchell Dewitt benchmark contract.

### Phase B — Architectural Reconstruction
- Exterior/interior wall classification.
- Opening/door/window association.
- Room/garage/deck/porch/stair semantic recognition.
- Dimension-to-wall association and scale correction.
- Better corner/junction handling and nested wall filtering.
- Raster line extraction fallback.

### Phase C — Correction and Review Workspace
- Expose Building Graph and validation diagnostics to the Blueprint UI.
- Select/edit/move/add/remove/classify walls.
- Edit openings and room polygons/names.
- Set/confirm scale.
- Save corrections as append-only events.
- Replay corrections on regeneration.
- Show object-level confidence/provenance.

### Phase D — Multi-floor Reconstruction
- Detect and register level sheets.
- Reconstruct each level independently.
- Align floors using stair cores/exterior geometry/manual anchors.
- Preserve per-level source page/sheet provenance.
- Produce a single multi-level graph and 3D model.

### Phase E — Export and Downstream Intelligence
- IFC coordination export.
- Model metadata for B.O.S. takeoff/job-costing integration.
- Graph query helpers for Orion and Project Intelligence.
- Quantity/material derivation only after geometry validation.

### Phase F — Benchmark and Production Hardening
- Real uploaded benchmark execution, including Mitchell Dewitt.
- Failure corpus for bad scale, low-resolution scans, wrong page, sparse plans, and irregular footprints.
- Performance budgets for large PDFs.
- Production telemetry for status, confidence, failure codes, and regeneration outcomes.
- Visual Production verification in B.O.S. Blueprints.

## Non-goals for the native engine

- Do not claim construction-authoritative BIM when the source does not contain sufficient information.
- Do not infer hidden structure, MEP, roof framing, or structural loads without evidence.
- Do not use LLM output alone as geometry truth.
- Do not mark a result `reconstructed` simply because a GLB was generated.

## Definition of done

The native engine is production-ready when a registered architectural plan can be reconstructed through the canonical graph pipeline, validation rejects visibly bad results, corrections survive regeneration, GLB/IFC outputs come from the graph, permanent benchmarks pass, migrations and RLS are verified, CI is green, and Production behavior matches the source plan closely enough to satisfy the benchmark-specific gates.